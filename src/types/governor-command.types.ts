// governor-command.types.ts
// Amac:    Governor/Recovery/Proxy/State katmanlari arasinda paylasilan
//          domain tiplerinin merkezi kaynagi + Madde #7 icin
//          RecoveryCommandPort sozlesmesi.
// Katman:  types
// Risk:    src/types/index.ts bu dosyayi VE (Madde #9 ile birlikte)
//          auth-validation.types.ts'i re-export eder - burada yanlis bir
//          alan/enum degeri, PersistentStateEngine.ts / AdvancedProxyManager.ts
//          ile derleme zamaninda uyusmazlik yaratir (Madde 22 - sessiz fallback
//          yasak, hata gorunur olmali).
// Dokunma: AdaptiveGovernor.ts (tuketici + GovernorDecisionEvent re-export;
//          Madde #9 ile AUTH_VALIDATION_FAILED icin yeni bir evaluatePolicy
//          case'i eklendi), PersistentStateEngine.ts (tuketici, Madde #9 ile
//          handleGovernorDecision'in catch'inde bu tipi enqueue ediyor),
//          AdvancedProxyManager.ts (ProxyLease/ProxyMetrics tuketicisi),
//          auth-validation.types.ts (bu dosyadaki PreservedSessionState'i
//          AuthValidationPort imzasinda kullanir).
//
// KAYNAK: Bu tanimlar artik VARSAYIM degil - src/engine/PersistentStateEngine.ts'in
// tam icerigi (attachLifecycleObservers, createSessionWithFreshState, handleGovernorDecision)
// grep/cat ile dogrulanarak cikarildi. ProxyMetrics alanlari (server/username/password)
// PersistentStateEngine.ts'teki `metrics.server/username/password` kullanimindan
// cikarildi - AdvancedProxyManager.ts'in TAMAMI goruldu (asagida DOGRULANDI notu
// guncellendi).

/**
 * DOGRULANDI (PersistentStateEngine.ts attachLifecycleObservers): HTTP_429,
 * HTTP_403, PAGE_CRASH, NETWORK_FAILURE bu dosyanin dort orijinal enqueue
 * noktasi. CHALLENGE_DETECTED / WEBSOCKET_DISCONNECT, AdaptiveGovernor.ts'in
 * evaluatePolicy() switch-case'inde referans aliniyor ama PersistentStateEngine.ts'te
 * henuz hicbir yerde enqueue edilmiyor - yine de policy tarafinda kullanildigi
 * icin tipte kaliyor.
 * Madde #9 (bu tur) - AUTH_VALIDATION_FAILED eklendi: attachLifecycleObservers'daki
 * dort cagridan FARKLI bir tetikleme noktasi var - handleGovernorDecision'in
 * catch blogunda, createSessionWithFreshState() bir AuthRestoreFailedError
 * firlattiginda enqueue ediliyor (bkz. auth-validation.types.ts).
 */
export enum AnomalyType {
  HTTP_429 = 'HTTP_429',
  HTTP_403 = 'HTTP_403',
  PAGE_CRASH = 'PAGE_CRASH',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  CHALLENGE_DETECTED = 'CHALLENGE_DETECTED',
  WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',
  AUTH_VALIDATION_FAILED = 'AUTH_VALIDATION_FAILED',
}

/**
 * DOGRULANDI (PersistentStateEngine.ts): HTTP_429 -> SESSION, HTTP_403 -> IP,
 * PAGE_CRASH/NETWORK_FAILURE -> INFRASTRUCTURE. Onceki varsayimim (PROXY/GLOBAL)
 * YANLISTI, kaldirildi. AUTH_VALIDATION_FAILED (Madde #9) -> SESSION verildi
 * (HTTP_429 ile ayni mantik: sorun tek bir session'in state'inde, IP/proxy'de
 * degil) - evaluatePolicy'de bu tip icin ayri, scope'tan bagimsiz bir case
 * oldugundan bu deger politikayi degistirmez, sadece SemanticAnomaly'yi
 * anlamli sekilde doldurur.
 */
export enum AnomalyScope {
  SESSION = 'SESSION',
  IP = 'IP',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
}

/**
 * DOGRULANDI (PersistentStateEngine.ts attachLifecycleObservers - dort
 * enqueueAnomaly() cagrisinin tamami, artik bes - handleGovernorDecision'daki
 * besinci enqueueAnomaly cagrisi Madde #9 ile eklendi): id/type/scope/timestamp
 * her zaman var; statusCode sadece HTTP_429/HTTP_403'te, sourceUrl PAGE_CRASH
 * haric hepsinde, rawError NETWORK_FAILURE'da VE (Madde #9 ile) AUTH_VALIDATION_FAILED'da
 * (AuthRestoreFailedError.message) dolduruluyor - bu yuzden hepsi opsiyonel.
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
 * switch-case) - degerler daha once de doğruydu, degisiklik yok. Madde #9,
 * AUTH_VALIDATION_FAILED'i FULL_RECOVERY'e yonlendiriyor - burada yeni bir
 * GovernorAction degeri EKLENMEDI, sadece evaluatePolicy'de yeni bir case.
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
