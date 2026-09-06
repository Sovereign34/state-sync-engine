// governor-command.types.ts
// Amac:    Governor/Recovery/Proxy/State katmanlari arasinda paylasilan
//          domain tiplerinin merkezi kaynagi + Madde #7 icin
//          RecoveryCommandPort sozlesmesi.
// Katman:  types
// Risk:    Bu dosya src/types/index.ts'in TEK icerigidir - burada yanlis bir
//          alan/enum degeri, PersistentStateEngine.ts / AdvancedProxyManager.ts
//          ile derleme zamaninda uyusmazlik yaratir (Madde 22 - sessiz fallback
//          yasak, hata gorunur olmali).
// Dokunma: AdaptiveGovernor.ts (tuketici + GovernorDecisionEvent re-export),
//          PersistentStateEngine.ts (tuketici), AdvancedProxyManager.ts (ProxyLease/
//          ProxyMetrics tuketicisi).
//
// KAYNAK: Bu tanimlar artik VARSAYIM degil - src/engine/PersistentStateEngine.ts'in
// tam icerigi (attachLifecycleObservers, createSessionWithFreshState, handleGovernorDecision)
// grep/cat ile dogrulanarak cikarildi. ProxyMetrics alanlari (server/username/password)
// PersistentStateEngine.ts'teki `metrics.server/username/password` kullanimindan
// cikarildi - AdvancedProxyManager.ts'in TAMAMI henuz gorulmedi, bu tek acik nokta.

/**
 * DOGRULANDI (PersistentStateEngine.ts attachLifecycleObservers): sadece bu
 * dort deger tetikleniyor. CHALLENGE_DETECTED / WEBSOCKET_DISCONNECT,
 * AdaptiveGovernor.ts'in evaluatePolicy() switch-case'inde referans aliniyor
 * ama PersistentStateEngine.ts'te henuz hicbir yerde enqueue edilmiyor -
 * yine de policy tarafinda kullanildigi icin tipte kaliyor.
 */
export enum AnomalyType {
  HTTP_429 = 'HTTP_429',
  HTTP_403 = 'HTTP_403',
  PAGE_CRASH = 'PAGE_CRASH',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  CHALLENGE_DETECTED = 'CHALLENGE_DETECTED',
  WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',
}

/**
 * DOGRULANDI (PersistentStateEngine.ts): HTTP_429 -> SESSION, HTTP_403 -> IP,
 * PAGE_CRASH/NETWORK_FAILURE -> INFRASTRUCTURE. Onceki varsayimim (PROXY/GLOBAL)
 * YANLISTI, kaldirildi.
 */
export enum AnomalyScope {
  SESSION = 'SESSION',
  IP = 'IP',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
}

/**
 * DOGRULANDI (PersistentStateEngine.ts attachLifecycleObservers - dort
 * enqueueAnomaly() cagrisinin tamami): id/type/scope/timestamp her zaman var;
 * statusCode sadece HTTP_429/HTTP_403'te, sourceUrl PAGE_CRASH haric hepsinde,
 * rawError sadece NETWORK_FAILURE'da dolduruluyor - bu yuzden hepsi opsiyonel.
 */
export interface SemanticAnomaly {
  id: string;
  type: AnomalyType;
  scope: AnomalyScope;
  /** Unix ms timestamp - AdaptiveGovernor'daki dedupe penceresi buna gore hesaplaniyor. */
  timestamp: number;
  statusCode?: number;
  sourceUrl?: string;
  rawError?: string;
}

/**
 * DOGRULANDI (PersistentStateEngine.ts evaluatePolicy tuketimi + handleGovernorDecision
 * switch-case) - degerler daha once de doğruydu, degisiklik yok.
 */
export enum GovernorAction {
  ROTATE_SESSION_ONLY = 'ROTATE_SESSION_ONLY',
  THROTTLE = 'THROTTLE',
  QUARANTINE_PROXY = 'QUARANTINE_PROXY',
  FULL_RECOVERY = 'FULL_RECOVERY',
  NO_ACTION = 'NO_ACTION',
}

export interface GovernorDecisionEvent {
  anomaly: SemanticAnomaly;
  action: GovernorAction;
}

/**
 * Madde #7 cozumu: Governor kararini artik sadece ham EventEmitter.emit() ile
 * atmiyor - bu portu implement eden bir tuketiciye enjekte edilmis bir
 * bagimlilik olarak da verebiliyor (legacy .on('decision',...) ile birlikte,
 * ikisi de ayni Promise.allSettled turunda bekleniyor).
 */
export interface RecoveryCommandPort {
  handleDecision(decision: GovernorDecisionEvent): Promise<void>;
}

/**
 * DOGRULANDI - AdvancedProxyManager.ts'in TAMAMI goruldu (acquireProxy,
 * reclaimExpiredLeases, releaseProxy). Tum alanlar orada birebir kullaniliyor.
 */
export interface ProxyLease {
  leaseId: string;
  proxyId: string;
  sessionId: string;
  acquiredAt: number;
  expiresAt: number;
}

/**
 * DOGRULANDI - AdvancedProxyManager.ts'in TAMAMI goruldu (registerProxy,
 * calculateHealthScore, markFailed). Tum alanlar orada birebir kullaniliyor.
 * UYARI: getAllMetrics(): ProxyMetrics[] username/password dahil TUM alanlari
 * ciplak dondurur - bu Madde #23'un (credential izolasyonu) konusu. Burada
 * SADECE tipi dogru yaziyorum, izolasyonu bu turda COZMUYORUM (kapsam disi,
 * ayri KARAR BILDIRIMI gerekir - tek problem tek cozum kurali).
 */
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

/**
 * DOGRULANDI (PersistentStateEngine.ts captureCurrentState/applyPreservedState):
 * cookies alan listesi Playwright Cookie tipinin bir alt kumesi (name/value/domain/
 * path/expires/httpOnly/secure/sameSite), localStorage/sessionStorage duz
 * Record<string,string>.
 */
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
}
