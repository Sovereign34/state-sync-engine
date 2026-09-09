// Config.ts
// Amaç:    STATE-SYNC-ENGINE genelinde dağınık halde hardcoded duran
//          operasyonel tuning değerlerinin (lease süresi, karantina
//          süreleri, health score ağırlıkları) TEK merkezi, immutable
//          sözleşmesi. Şu an tüm alanlar `src/network/AdvancedProxyManager.ts`
//          içinde satır satır hardcoded — bu dosya o değerlerin TİP
//          tanımını verir, `loadConfig.ts` gerçek değerleri (env var veya
//          varsayılan) üretir.
// Katman:  config (Madde #27, yeni katman)
// Risk:    Bu arayüz `AdvancedProxyManager.ts`'teki gerçek kullanım
//          yerleriyle (satır numaraları KARAR BİLDİRİMİ'nde referans
//          verildi) alan alan eşleşmezse, ileride bir tüketici bu config'i
//          kullanmaya başladığında sessizce yanlış bir değer okur —
//          field isimleri BİLİNÇLİ OLARAK AdvancedProxyManager.ts'teki
//          yorum/değişken adlarıyla birebir örtüşecek şekilde seçildi.
// Dokunma: Bu turda HİÇBİR tüketici (`AdvancedProxyManager`,
//          `PersistentStateEngine`, `index.ts`, `ConsoleJsonLogger`) bu
//          dosyayı import ETMİYOR — sadece sözleşme + `loadConfig()`
//          verildi (Kural #5, Madde #13/#2/#15'te izlenen "önce sözleşme,
//          sonra ayrı onaylı turlarda wiring" deseni). Tüketicilere
//          bağlama HER BİRİ için ayrı bir KARAR BİLDİRİMİ gerektirir.

export interface ProxyQuarantineConfig {
  /** HTTP 403 için üstel artan karantinanın taban süresi (ms). */
  readonly http403BaseMs: number;
  /** HTTP 403 karantinasının üst sınırı (ms) — üstel artış bunu aşamaz. */
  readonly http403CapMs: number;
  /** HTTP 429 için üstel artan karantinanın taban süresi (ms). */
  readonly http429BaseMs: number;
  /** HTTP 429 karantinasının üst sınırı (ms). */
  readonly http429CapMs: number;
  /** DNS çözümleme hatası sonrası sabit karantina süresi (ms). */
  readonly dnsFailMs: number;
  /** TLS handshake hatası sonrası sabit karantina süresi (ms). */
  readonly tlsFailMs: number;
  /** Sınıflandırılmamış/genel ağ hatası sonrası sabit karantina süresi (ms). */
  readonly networkFailMs: number;
}

export interface ProxyHealthScoreConfig {
  /** Latans cezası hesaplanırken latencyMs'nin bölüneceği değer. */
  readonly latencyPenaltyDivisor: number;
  /** Her bir HTTP 403 olayının health score'dan düştüğü puan. */
  readonly http403Penalty: number;
  /** Her bir DNS hatasının health score'dan düştüğü puan. */
  readonly dnsFailurePenalty: number;
  /** Her bir TLS hatasının health score'dan düştüğü puan. */
  readonly tlsFailurePenalty: number;
  /**
   * Exponential Moving Average'da YENİ ölçümün ağırlığı (0-1 arası).
   * Eski değerin ağırlığı örtük olarak `1 - emaAlpha`'dır — iki ayrı alan
   * OLARAK tutulmuyor, tek kaynak burası (tutarsızlık riski önlenir).
   */
  readonly emaAlpha: number;
}

export interface ProxyConfig {
  /** Bir lease'in reclaim edilmeden önce ne kadar süre geçerli kalacağı (ms). */
  readonly leaseDurationMs: number;
  readonly quarantine: ProxyQuarantineConfig;
  readonly healthScore: ProxyHealthScoreConfig;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Kök sözleşme. Tamamı `readonly` (derleme zamanı) + `loadConfig()`
 * tarafından `deepFreeze()` ile (runtime zamanı) immutable yapılır — ikisi
 * birbirinin YERİNE geçmez, `readonly` sadece TypeScript'i durdurur, JS'e
 * derlendikten sonra hiçbir koruma sağlamaz.
 */
export interface Config {
  readonly proxy: ProxyConfig;
  /**
   * (Madde #15'in ertelediği takip) Şu an HİÇBİR `ILogger` implementasyonu
   * bunu okumuyor — `ConsoleJsonLogger` hâlâ verilen her `debug/info/warn/
   * error` çağrısını koşulsuz basıyor. Bu alan sadece sözleşmede yer
   * tutuyor, filtreleme mantığı ayrı bir onaylı tur.
   */
  readonly logLevel: LogLevel;
}
