/**
 * AdaptiveGovernor
 * ------------------------------------------------------------------
 * Generic health-state governor for a `PersistentStateEngine`-like
 * consumer. Tracks anomaly signals, drives an exponential backoff
 * cooldown, and escalates into a quarantine state when a configurable
 * threshold of anomalies is reached within a rolling window.
 *
 * This module is intentionally domain-agnostic: it knows nothing about
 * HTTP, sessions, or any specific transport. It only reasons about
 * "anomaly events in -> health state / delay recommendation out".
 * ------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Types carried over from earlier stages
// ---------------------------------------------------------------------------

export type AnomalyType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'ACCESS_RESTRICTED'
  | 'SESSION_EXPIRED'
  | 'CHALLENGE_DETECTED';

export interface AnomalyPayload {
  type: AnomalyType;
  timestamp: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Governor-specific types
// ---------------------------------------------------------------------------

/** Overall health state machine for the governed resource. */
export type GovernorState = 'HEALTHY' | 'COOLING_DOWN' | 'QUARANTINED';

/** Per-anomaly-type tuning knobs. */
export interface AnomalyPolicy {
  /** How many occurrences of this anomaly (within `windowMs`) trigger quarantine. */
  quarantineThreshold: number;
  /** Rolling window, in ms, used to count recent occurrences of this anomaly. */
  windowMs: number;
  /** Base delay, in ms, used as the seed for exponential backoff. */
  baseDelayMs: number;
  /** Multiplier applied per consecutive occurrence when computing backoff. */
  backoffMultiplier: number;
  /** Hard ceiling on any computed backoff delay. */
  maxDelayMs: number;
  /** How long a quarantine triggered by this anomaly type lasts, in ms. */
  quarantineDurationMs: number;
}

export interface AdaptiveGovernorConfig {
  /** Policy per anomaly type. Any type not listed falls back to `defaultPolicy`. */
  policies?: Partial<Record<AnomalyType, Partial<AnomalyPolicy>>>;
  /** Fallback policy for anomaly types without an explicit entry. */
  defaultPolicy?: Partial<AnomalyPolicy>;
  /** Consecutive successes required to fully reset backoff to zero. */
  successResetThreshold?: number;
  /** Optional clock override, mainly for testing. Returns epoch ms. */
  now?: () => number;
  /** Optional callback fired on every state transition. */
  onTransition?: (event: GovernorTransitionEvent) => void;
}

export interface GovernorTransitionEvent {
  from: GovernorState;
  to: GovernorState;
  reason: AnomalyType | 'SUCCESS_RESET' | 'QUARANTINE_EXPIRED' | 'MANUAL_RESET';
  at: string;
}

export interface GovernorDecision {
  /** Whether the caller is currently allowed to proceed. */
  allowed: boolean;
  /** Current state after evaluation. */
  state: GovernorState;
  /** If not allowed, how long (ms) until the caller should retry. */
  retryAfterMs: number;
  /** Diagnostic reason for the current decision. */
  reason: string;
}

interface AnomalyRecord {
  type: AnomalyType;
  at: number;
}

const DEFAULT_POLICY: AnomalyPolicy = {
  quarantineThreshold: 5,
  windowMs: 5 * 60 * 1000,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 5 * 60 * 1000,
  quarantineDurationMs: 15 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// AdaptiveGovernor
// ---------------------------------------------------------------------------

/**
 * Generic governor that a `PersistentStateEngine` (or any long-lived,
 * fallible resource) can consult before performing an operation, and
 * report back to whenever an anomaly or a success occurs.
 *
 * Usage:
 *
 * ```ts
 * const governor = new AdaptiveGovernor();
 *
 * const decision = governor.evaluate();
 * if (!decision.allowed) {
 *   await sleep(decision.retryAfterMs);
 * }
 *
 * try {
 *   await doWork();
 *   governor.recordSuccess();
 * } catch (err) {
 *   governor.recordAnomaly({ type: 'RATE_LIMIT_EXCEEDED', timestamp: new Date().toISOString() });
 * }
 * ```
 */
export class AdaptiveGovernor {
  private state: GovernorState = 'HEALTHY';
  private readonly policies: Record<AnomalyType, AnomalyPolicy>;
  private readonly successResetThreshold: number;
  private readonly now: () => number;
  private readonly onTransition?: (event: GovernorTransitionEvent) => void;

  private history: AnomalyRecord[] = [];
  private consecutiveSuccesses = 0;
  private consecutiveAnomaliesByType: Partial<Record<AnomalyType, number>> = {};

  private cooldownUntil = 0;
  private quarantineUntil = 0;
  private lastAnomaly?: AnomalyPayload;

  constructor(config: AdaptiveGovernorConfig = {}) {
    this.now = config.now ?? (() => Date.now());
    this.successResetThreshold = config.successResetThreshold ?? 3;
    this.onTransition = config.onTransition;

    const anomalyTypes: AnomalyType[] = [
      'RATE_LIMIT_EXCEEDED',
      'ACCESS_RESTRICTED',
      'SESSION_EXPIRED',
      'CHALLENGE_DETECTED',
    ];

    const mergedDefault: AnomalyPolicy = {
      ...DEFAULT_POLICY,
      ...(config.defaultPolicy ?? {}),
    };

    this.policies = anomalyTypes.reduce((acc, type) => {
      acc[type] = {
        ...mergedDefault,
        ...(config.policies?.[type] ?? {}),
      };
      return acc;
    }, {} as Record<AnomalyType, AnomalyPolicy>);
  }

  /**
   * Evaluate whether the caller may proceed right now. Call this before
   * every attempt against the governed resource.
   */
  public evaluate(): GovernorDecision {
    const nowMs = this.now();
    this.expireQuarantineIfDue(nowMs);

    if (this.state === 'QUARANTINED') {
      return {
        allowed: false,
        state: this.state,
        retryAfterMs: Math.max(0, this.quarantineUntil - nowMs),
        reason: `Quarantined until ${new Date(this.quarantineUntil).toISOString()}`,
      };
    }

    if (this.state === 'COOLING_DOWN' && nowMs < this.cooldownUntil) {
      return {
        allowed: false,
        state: this.state,
        retryAfterMs: this.cooldownUntil - nowMs,
        reason: `Cooling down until ${new Date(this.cooldownUntil).toISOString()}`,
      };
    }

    if (this.state === 'COOLING_DOWN' && nowMs >= this.cooldownUntil) {
      // Cooldown window elapsed naturally; allow a probing attempt but stay
      // in COOLING_DOWN until an explicit success/failure is recorded.
      return {
        allowed: true,
        state: this.state,
        retryAfterMs: 0,
        reason: 'Cooldown elapsed; probing attempt allowed',
      };
    }

    return {
      allowed: true,
      state: this.state,
      retryAfterMs: 0,
      reason: 'Healthy',
    };
  }

  /** Report a successful operation against the governed resource. */
  public recordSuccess(): void {
    this.consecutiveSuccesses += 1;
    this.consecutiveAnomaliesByType = {};

    if (this.consecutiveSuccesses >= this.successResetThreshold) {
      this.transition(this.state === 'HEALTHY' ? 'HEALTHY' : 'HEALTHY', 'SUCCESS_RESET');
      this.cooldownUntil = 0;
      this.consecutiveSuccesses = 0;
    }
  }

  /** Report an anomaly detected against the governed resource. */
  public recordAnomaly(payload: AnomalyPayload): GovernorDecision {
    const nowMs = this.now();
    this.lastAnomaly = payload;
    this.consecutiveSuccesses = 0;

    this.history.push({ type: payload.type, at: nowMs });
    this.pruneHistory(nowMs);

    const policy = this.policies[payload.type];
    const consecutive = (this.consecutiveAnomaliesByType[payload.type] ?? 0) + 1;
    this.consecutiveAnomaliesByType[payload.type] = consecutive;

    const recentCount = this.history.filter(
      (r) => r.type === payload.type && nowMs - r.at <= policy.windowMs,
    ).length;

    if (recentCount >= policy.quarantineThreshold) {
      this.enterQuarantine(payload.type, policy, nowMs);
    } else {
      this.enterCooldown(payload.type, policy, consecutive, nowMs);
    }

    return this.evaluate();
  }

  /** Current state, for observability/logging. */
  public getState(): GovernorState {
    return this.state;
  }

  /** Most recent anomaly seen, if any. */
  public getLastAnomaly(): AnomalyPayload | undefined {
    return this.lastAnomaly;
  }

  /** Force the governor back to HEALTHY, e.g. after an operator intervention. */
  public reset(): void {
    this.history = [];
    this.consecutiveSuccesses = 0;
    this.consecutiveAnomaliesByType = {};
    this.cooldownUntil = 0;
    this.quarantineUntil = 0;
    this.transition('HEALTHY', 'MANUAL_RESET');
  }

  // -------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------

  private enterCooldown(
    type: AnomalyType,
    policy: AnomalyPolicy,
    consecutiveCount: number,
    nowMs: number,
  ): void {
    const delay = Math.min(
      policy.baseDelayMs * Math.pow(policy.backoffMultiplier, consecutiveCount - 1),
      policy.maxDelayMs,
    );
    this.cooldownUntil = nowMs + delay;
    this.transition('COOLING_DOWN', type);
  }

  private enterQuarantine(type: AnomalyType, policy: AnomalyPolicy, nowMs: number): void {
    this.quarantineUntil = nowMs + policy.quarantineDurationMs;
    this.cooldownUntil = 0;
    this.transition('QUARANTINED', type);
  }

  private expireQuarantineIfDue(nowMs: number): void {
    if (this.state === 'QUARANTINED' && nowMs >= this.quarantineUntil) {
      this.quarantineUntil = 0;
      this.history = [];
      this.consecutiveAnomaliesByType = {};
      this.transition('COOLING_DOWN', 'QUARANTINE_EXPIRED');
      // Give a short cooldown after quarantine before fully HEALTHY,
      // so a single probing success doesn't instantly clear a long ban.
      this.cooldownUntil = nowMs + DEFAULT_POLICY.baseDelayMs;
    }
  }

  private pruneHistory(nowMs: number): void {
    const maxWindow = Math.max(...Object.values(this.policies).map((p) => p.windowMs));
    this.history = this.history.filter((r) => nowMs - r.at <= maxWindow);
  }

  private transition(to: GovernorState, reason: GovernorTransitionEvent['reason']): void {
    if (this.state === to && reason !== 'SUCCESS_RESET') {
      // Still emit for anomaly-driven re-entries into the same state
      // (e.g. repeated COOLING_DOWN triggers), since retryAfterMs changed.
    }
    const from = this.state;
    this.state = to;
    this.onTransition?.({
      from,
      to,
      reason,
      at: new Date(this.now()).toISOString(),
    });
  }
}

export default AdaptiveGovernor;
