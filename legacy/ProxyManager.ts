/**
 * Playwright'ın proxy config formatıyla birebir uyumlu tip.
 * https://playwright.dev/docs/api/class-browser#browser-new-context-option-proxy
 */
export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
}

interface ProxyState {
  config: ProxyConfig;
  quarantinedUntil: number | null; // epoch ms, null => aktif
  failureCount: number;
}

export interface ProxyManagerOptions {
  /** Karantina süresi (ms). Varsayılan: 60_000 (1 dakika) */
  quarantineMs?: number;
  /**
   * Ardışık kaç hatadan sonra karantina süresi katlanarak artsın (exponential backoff).
   * false verilirse backoff kapalı, her seferinde sabit quarantineMs kullanılır.
   */
  exponentialBackoff?: boolean;
  /** Backoff açıkken uygulanacak maksimum karantina süresi (ms). Varsayılan: 30 dk */
  maxQuarantineMs?: number;
}

export class ProxyManager {
  private readonly proxies: ProxyState[];
  private readonly quarantineMs: number;
  private readonly exponentialBackoff: boolean;
  private readonly maxQuarantineMs: number;
  private cursor = 0;

  constructor(proxyConfigs: ProxyConfig[], options: ProxyManagerOptions = {}) {
    if (!proxyConfigs || proxyConfigs.length === 0) {
      throw new Error("ProxyManager en az bir ProxyConfig ile başlatılmalıdır.");
    }

    this.quarantineMs = options.quarantineMs ?? 60_000;
    this.exponentialBackoff = options.exponentialBackoff ?? true;
    this.maxQuarantineMs = options.maxQuarantineMs ?? 30 * 60_000;

    this.proxies = proxyConfigs.map((config) => ({
      config,
      quarantinedUntil: null,
      failureCount: 0,
    }));
  }

  /**
   * Round-robin mantığıyla bir sonraki aktif (karantinada olmayan) proxy'yi döndürür.
   * Karantina süresi dolmuş proxy'ler otomatik olarak tekrar aktif hale gelir.
   * Tüm proxy'ler karantinadaysa, en yakın zamanda serbest kalacak olanı döndürür (fail-open).
   */
  getNextProxy(): ProxyConfig {
    this.releaseExpiredQuarantines();

    const total = this.proxies.length;
    let bestFallback: ProxyState | null = null;

    for (let i = 0; i < total; i++) {
      const index = (this.cursor + i) % total;
      const candidate = this.proxies[index];

      if (candidate.quarantinedUntil === null) {
        this.cursor = (index + 1) % total;
        return candidate.config;
      }

      // Fallback için en erken serbest kalacak proxy'yi takip et
      if (
        !bestFallback ||
        candidate.quarantinedUntil < (bestFallback.quarantinedUntil ?? Infinity)
      ) {
        bestFallback = candidate;
      }
    }

    // Hiçbir aktif proxy yok — sistemin tamamen durmaması için
    // en yakın zamanda açılacak proxy'yi döndür.
    this.cursor = (this.proxies.indexOf(bestFallback!) + 1) % total;
    return bestFallback!.config;
  }

  /**
   * Verilen proxy'yi belirli bir süre karantinaya alır.
   * exponentialBackoff aktifse, ardışık her hatada süre katlanarak artar (maxQuarantineMs'e kadar).
   */
  markFailed(proxyServer: string): void {
    const state = this.proxies.find((p) => p.config.server === proxyServer);
    if (!state) {
      // Bilinmeyen bir server ile çağrılırsa sessizce yok say —
      // jenerik bileşen olduğu için exception fırlatıp akışı bozmuyoruz.
      return;
    }

    state.failureCount += 1;

    const duration = this.exponentialBackoff
      ? Math.min(
          this.quarantineMs * 2 ** (state.failureCount - 1),
          this.maxQuarantineMs
        )
      : this.quarantineMs;

    state.quarantinedUntil = Date.now() + duration;
  }

  /** Bir proxy'nin başarılı çalıştığını bildirir, hata sayacını sıfırlar. */
  markSuccess(proxyServer: string): void {
    const state = this.proxies.find((p) => p.config.server === proxyServer);
    if (state) {
      state.failureCount = 0;
      state.quarantinedUntil = null;
    }
  }

  /** Manuel olarak bir proxy'yi karantinadan çıkarmak için. */
  release(proxyServer: string): void {
    const state = this.proxies.find((p) => p.config.server === proxyServer);
    if (state) {
      state.quarantinedUntil = null;
    }
  }

  /** Debug/monitoring amaçlı: tüm proxy'lerin anlık durumunu döndürür. */
  getStatus(): Array<{
    server: string;
    active: boolean;
    quarantinedUntil: number | null;
    failureCount: number;
  }> {
    this.releaseExpiredQuarantines();
    return this.proxies.map((p) => ({
      server: p.config.server,
      active: p.quarantinedUntil === null,
      quarantinedUntil: p.quarantinedUntil,
      failureCount: p.failureCount,
    }));
  }

  private releaseExpiredQuarantines(): void {
    const now = Date.now();
    for (const state of this.proxies) {
      if (state.quarantinedUntil !== null && state.quarantinedUntil <= now) {
        state.quarantinedUntil = null;
      }
    }
  }
  }
