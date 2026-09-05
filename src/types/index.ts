import { BrowserContext, Page } from 'playwright';

export enum AnomalyScope {
  IP = 'IP',
  SESSION = 'SESSION',
  ACCOUNT = 'ACCOUNT',
  INFRASTRUCTURE = 'INFRASTRUCTURE'
}

export enum AnomalyType {
  HTTP_403 = 'HTTP_403',
  HTTP_429 = 'HTTP_429',
  PAGE_CRASH = 'PAGE_CRASH',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',
  CHALLENGE_DETECTED = 'CHALLENGE_DETECTED'
}

export interface SemanticAnomaly {
  id: string;
  type: AnomalyType;
  statusCode?: number;
  scope: AnomalyScope;
  sourceUrl?: string;
  timestamp: number;
  rawError?: unknown;
}

export enum GovernorAction {
  THROTTLE = 'THROTTLE',
  ROTATE_PROXY_ONLY = 'ROTATE_PROXY_ONLY',
  ROTATE_SESSION_ONLY = 'ROTATE_SESSION_ONLY',
  FULL_RECOVERY = 'FULL_RECOVERY',
  QUARANTINE_PROXY = 'QUARANTINE_PROXY',
  NO_ACTION = 'NO_ACTION'
}

export interface ProxyMetrics {
  server: string;
  username?: string;
  password?: string;
  latencyMs: number;
  dnsFailures: number;
  tlsFailures: number;
  http403Count: number;
  http429Count: number;
  successCount: number;
  failureCount: number;
  lastUsed: number;
  quarantineUntil: number;
}

export interface PreservedSessionState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  webSocketSubscriptions?: Array<unknown>;
}

export interface EngineTelemetry {
  totalSessions: number;
  blockedSessions: number;
  http403Rate: number;
  http429Rate: number;
  challengeRate: number;
  proxyFailureRate: number;
  lastMetricsUpdate: number;
}

export interface SessionContext {
  context: BrowserContext;
  page: Page;
  proxy?: ProxyMetrics;
}
