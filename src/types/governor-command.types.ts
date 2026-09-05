// governor-command.types.ts
// Amaç:    Madde #7 için Governor→Recovery karar iletiminin resmi, tip-güvenli
//          sözleşmesini (RecoveryCommandPort) tanımlar.
// Katman:  types
// Risk:    Bu dosyadaki AnomalyType/AnomalyScope/SemanticAnomaly/GovernorAction
//          tanımları VARSAYIMDIR — gerçek src/types/index.ts görülmeden,
//          yalnızca AdaptiveGovernor.ts'in mevcut kullanım şekline bakılarak
//          yeniden üretildi. Gerçek dosyayla alan adı/enum değeri uyuşmazlığı
//          varsa derleme hatası verir (bu istenen davranış — sessiz fallback yok).
// Dokunma: src/types/index.ts (bu dosyayı `export * from './governor-command.types'`
//          ile yeniden dışa aktarmalı — mevcut tanımlarla çakışma varsa BU dosya
//          silinip gerçek tipler kullanılmalı), AdaptiveGovernor.ts (tüketici),
//          ileride PersistentStateEngine.ts (RecoveryCommandPort'u implement edecek
//          — ayrı KARAR BİLDİRİMİ, bu turda dokunulmadı).

/**
 * VARSAYIM: AdaptiveGovernor.ts'in switch-case'inde kullanılan değerlerden
 * türetildi. Gerçek dosyada farklıysa (örn. string literal union yerine
 * enum, ya da ek üye) burası güncellenmeli.
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
 * VARSAYIM: AdaptiveGovernor.ts yalnızca `AnomalyScope.SESSION`'ı referans
 * alıyor (HTTP_429 case'inde). PROXY/GLOBAL, mimari tutarlılık için makul
 * tahmin olarak eklendi — gerçek dosyada olmayabilir.
 */
export enum AnomalyScope {
  SESSION = 'SESSION',
  PROXY = 'PROXY',
  GLOBAL = 'GLOBAL',
}

/**
 * VARSAYIM: `enqueueAnomaly`'deki dedupe mantığı (.type, .scope, .timestamp
 * karşılaştırması) ve `evaluatePolicy`'nin (.type) kullanımından türetildi.
 * `sessionId`/`details` alanları eklenmedi çünkü kullanım yerinde referans
 * yoktu — gerekiyorsa gerçek dosyadan tamamlanmalı.
 */
export interface SemanticAnomaly {
  type: AnomalyType;
  scope: AnomalyScope;
  /** Unix ms timestamp — dedupe penceresi (duplicateWindowMs) buna göre hesaplanıyor. */
  timestamp: number;
}

/**
 * VARSAYIM: `evaluatePolicy`'nin switch-case dönüş değerlerinden birebir
 * türetildi — bu kısım yüksek güvenle doğru olmalı (kod zaten bu değerleri
 * kullanıyordu, sadece enum'a bağladım).
 */
export enum GovernorAction {
  ROTATE_SESSION_ONLY = 'ROTATE_SESSION_ONLY',
  THROTTLE = 'THROTTLE',
  QUARANTINE_PROXY = 'QUARANTINE_PROXY',
  FULL_RECOVERY = 'FULL_RECOVERY',
  NO_ACTION = 'NO_ACTION',
}

/**
 * Madde #7 öncesi AdaptiveGovernor.ts'te tanımlıydı; merkezi sözleşme
 * olması için types katmanına taşındı (Madde 33 ruhu — port/adapter
 * sözleşmeleri types'ta yaşar).
 */
export interface GovernorDecisionEvent {
  anomaly: SemanticAnomaly;
  action: GovernorAction;
}

/**
 * Madde #7 çözümü: Governor artık kararını ham EventEmitter.emit() ile
 * "atmıyor" — bu portu implement eden bir tüketiciye (örn. gelecekteki
 * PersistentStateEngine) enjekte edilmiş bir bağımlılık olarak veriyor.
 * Kontrat açık: handleDecision() bir Promise döner ve Governor bu
 * promise'i bekleyene kadar kuyruktaki bir sonraki anomaliye geçmez
 * (Madde 6'nın sıralılık garantisiyle aynı disiplin).
 */
export interface RecoveryCommandPort {
  handleDecision(decision: GovernorDecisionEvent): Promise<void>;
}
