// AdvancedProxyManager.ts
// Amaç:    Proxy havuzunu yönetir; health-score'a göre proxy seçer ve seçilen
//          proxy'yi bir lease ile "meşgul" işaretleyerek paralel session'ların
//          aynı proxy'yi paylaşmasını engeller (Madde #5).
// Katman:  network
// Risk:    Lease mekanizması bozulursa iki session aynı proxy'yi paralel
//          kullanabilir (orijinal Madde #5 sorunu geri döner) veya expire
//          olmayan lease'ler proxy'yi kalıcı olarak "meşgul" bırakıp havuzu
//          tüketebilir. Madde #23: getAllMetrics() dışa credential
//          (username/password) sızdırırsa, bu bilgi log/telemetry/monitoring
//          API'sine çıplak ulaşabilir — getProxyMetrics() ise BİLİNÇLİ olarak
//          credential'lı kalır (bkz. Dokunma), çünkü PersistentStateEngine
//          gerçek proxy bağlantısı için ona ihtiyaç duyar; bu ikisini
//          KARIŞTIRMAMAK bu dosyanın en kritik kuralı.
// Dokunma: `ProxyLease` tipi (types/index.ts) ve bu sınıfı kullanan her yer
//          (şu an yalnızca src/engine/PersistentStateEngine.ts — hem
//          `acquireProxy()` hem de credential için `getProxyMetrics()`
//          çağırıyor, satır ~218). `PublicProxyMetrics` tipi
//          (types/governor-command.types.ts) — Madde #23 ile SADECE
//          `getAllMetrics()` bu tipi döner. `getProxyMetrics()` ham
//          `ProxyMetrics`'i (credential dahil) dönmeye DEVAM EDER — bu bir
//          önceki turda yanlışlıkla `PublicProxyMetrics`'e çevrilip
//          `src/index.ts`/`PersistentStateEngine.ts` derlemesini kırmıştı
//          (`tsc --noEmit` ile yakalandı), bu tur o hatayı düzeltiyor.

import { ProxyMetrics, ProxyLease, PublicProxyMetrics } from '../types';

// Lease süresi dolduğunda otomatik reclaim edilir (crash/unclean-shutdown
// senaryosu için güvenlik ağı). Kalıcı transaction modeli Madde #8 ile gelecek;
// bu değer o zamana kadarki geçici varsayılandır.
const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000;

export class AdvancedProxyManager {
  private proxies: Map<string, ProxyMetrics> = new Map();

  // leaseId -> lease (aktif lease'lerin tam kaydı)
  private activeLeases: Map<string, ProxyLease> = new Map();
  // proxyId (server) -> leaseId (bir proxy'nin şu an leased olup olmadığını O(1) kontrol için)
  private leasedProxyIds: Map<string, string> = new Map();

  constructor(initialProxies: Array<{ server: string; username?: string; password?: string }> = []) {
    for (const proxy of initialProxies) {
      this.registerProxy(proxy.server, proxy.username, proxy.password);
    }
  }

  public registerProxy(server: string, username?: string, password?: string): void {
    if (!this.proxies.has(server)) {
      this.proxies.set(server, {
        server,
        username,
        password,
        latencyMs: 0,
        dnsFailures: 0,
        tlsFailures: 0,
        http403Count: 0,
        http429Count: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: 0,
        quarantineUntil: 0,
      });
    }
  }

  /**
   * Sağlıklı VE şu anda leased olmayan bir proxy seçer, seçileni lease'ler
   * ve lease kaydını döner. Aynı proxy, releaseProxy() çağrılana veya lease
   * süresi dolana kadar başka bir sessionId'ye tekrar verilmez.
   */
  public acquireProxy(sessionId: string): ProxyLease {
    const now = Date.now();
    this.reclaimExpiredLeases(now);

    const allProxies = Array.from(this.proxies.values());
    if (allProxies.length === 0) {
      throw new Error('[AdvancedProxyManager] Proxy havuzu tamamen boş. En az bir proxy tanımlanmalı.');
    }

    const notQuarantined = allProxies.filter((p) => p.quarantineUntil <= now);

    // Fail-Closed Güvencesi: tüm proxy'ler karantinadaysa unhealthy proxy dönme
    if (notQuarantined.length === 0) {
      const minQuarantineTime = Math.min(...allProxies.map((p) => p.quarantineUntil));
      const waitMs = Math.max(minQuarantineTime - now, 1000);
      throw new Error(
        `[AdvancedProxyManager] Bütün proxy'ler karantinada! Unhealthy proxy dönülmüyor. En yakın karantina bitişi: ${Math.ceil(waitMs / 1000)}s`
      );
    }

    const healthyCandidates = notQuarantined.filter((p) => !this.leasedProxyIds.has(p.server));

    // Karantinada olmayan proxy var ama hepsi başka session'lar tarafından leased
    if (healthyCandidates.length === 0) {
      const leases = Array.from(this.activeLeases.values()).filter((l) =>
        notQuarantined.some((p) => p.server === l.proxyId)
      );
      const earliestExpiry = leases.length > 0 ? Math.min(...leases.map((l) => l.expiresAt)) : now + DEFAULT_LEASE_DURATION_MS;
      const waitMs = Math.max(earliestExpiry - now, 1000);
      throw new Error(
        `[AdvancedProxyManager] Sağlıklı tüm proxy'ler şu anda başka session'lara leased. En yakın serbest kalma: ~${Math.ceil(waitMs / 1000)}s`
      );
    }

    healthyCandidates.sort((a, b) => this.calculateHealthScore(b) - this.calculateHealthScore(a));
    const selected = healthyCandidates[0];
    selected.lastUsed = now;

    const lease: ProxyLease = {
      leaseId: this.generateLeaseId(),
      proxyId: selected.server,
      sessionId,
      acquiredAt: now,
      expiresAt: now + DEFAULT_LEASE_DURATION_MS,
    };

    this.activeLeases.set(lease.leaseId, lease);
    this.leasedProxyIds.set(selected.server, lease.leaseId);

    return lease;
  }

  /**
   * Proxy'yi tekrar havuza (AVAILABLE) döndürür. Bilinmeyen veya zaten
   * release edilmiş / expire olup reclaim edilmiş bir leaseId için sessiz
   * no-op yapar (idempotent — çift release çağrısı hata fırlatmaz).
   */
  public releaseProxy(leaseId: string): void {
    const lease = this.activeLeases.get(leaseId);
    if (!lease) return;

    this.activeLeases.delete(leaseId);
    this.leasedProxyIds.delete(lease.proxyId);
  }

  public recordSuccess(server: string, latencyMs: number): void {
    const metrics = this.proxies.get(server);
    if (!metrics) return;

    metrics.successCount++;
    // Exponential Moving Average (EMA) ile yumuşatılmış latans takibi
    metrics.latencyMs = metrics.latencyMs === 0 
      ? latencyMs 
      : Math.round(metrics.latencyMs * 0.7 + latencyMs * 0.3);
  }

  public markFailed(server: string, failureType: 'HTTP_403' | 'HTTP_429' | 'DNS_FAIL' | 'TLS_FAIL' | 'NETWORK_FAIL'): void {
    const metrics = this.proxies.get(server);
    if (!metrics) return;

    metrics.failureCount++;
    const now = Date.now();

    switch (failureType) {
      case 'HTTP_403':
        metrics.http403Count++;
        // 403 için üstel artan karantina süresi (1. hata 2dk, 2. hata 4dk, 3. hata 8dk...)
        metrics.quarantineUntil = now + Math.min(120000 * Math.pow(2, metrics.http403Count - 1), 3600000);
        break;

      case 'HTTP_429':
        metrics.http429Count++;
        // 429 için daha kısa karantina (30 sn base)
        metrics.quarantineUntil = now + Math.min(30000 * Math.pow(2, metrics.http429Count - 1), 600000);
        break;

      case 'DNS_FAIL':
        metrics.dnsFailures++;
        metrics.quarantineUntil = now + 60000;
        break;

      case 'TLS_FAIL':
        metrics.tlsFailures++;
        metrics.quarantineUntil = now + 90000;
        break;

      case 'NETWORK_FAIL':
      default:
        metrics.quarantineUntil = now + 45000;
        break;
    }
  }

  private calculateHealthScore(proxy: ProxyMetrics): number {
    const totalRequests = proxy.successCount + proxy.failureCount;
    if (totalRequests === 0) return 100; // Henüz kullanılmamış temiz proxy

    const successRate = (proxy.successCount / totalRequests) * 100;
    const latencyPenalty = proxy.latencyMs / 50; // Her 50ms latans 1 puan düşürür
    const failurePenalty = (proxy.http403Count * 20) + (proxy.dnsFailures * 15) + (proxy.tlsFailures * 15);

    return Math.max(0, successRate - latencyPenalty - failurePenalty);
  }

  private reclaimExpiredLeases(now: number): void {
    for (const [leaseId, lease] of this.activeLeases.entries()) {
      if (lease.expiresAt <= now) {
        this.activeLeases.delete(leaseId);
        this.leasedProxyIds.delete(lease.proxyId);
      }
    }
  }

  private generateLeaseId(): string {
    return `lease_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * Madde #23 çözümü — DÜZELTME (bkz. dosya başlığı): credential alanları
   * (username/password) SADECE bu helper'ın çağrıldığı yerde elenir.
   * `metrics` içindeki geri kalan tüm alanlar bir KOPYA olarak (spread ile)
   * döner — çağıran taraf döndürülen objeyi mutasyona uğratsa bile sınıfın
   * içindeki gerçek `ProxyMetrics` etkilenmez.
   */
  private toPublicMetrics(metrics: ProxyMetrics): PublicProxyMetrics {
    const { username, password, ...publicFields } = metrics;
    return { ...publicFields };
  }

  /**
   * İÇ KULLANIM İÇİNDİR — credential'lı (username/password dahil) tam
   * `ProxyMetrics` döner. Bu, motorun gerçek proxy bağlantısını kurmak
   * için (bkz. PersistentStateEngine.createSessionWithFreshState,
   * `browser.newContext({ proxy: {...} })`) credential'a ulaştığı TEK
   * meşru yoldur — Madde #23 kapsamına GİRMEZ.
   * ⚠️ Bu metodun sonucu asla log'a, telemetriye veya dışa açık bir
   * monitoring/API response'una yazılmamalı (Madde #22 bu metoda değil,
   * getAllMetrics()'in credential'sız çıktısına bağlanmalı). Dışa dönük /
   * toplu bir görünüm gerekiyorsa getAllMetrics() kullanılır.
   */
  public getProxyMetrics(server: string): ProxyMetrics | undefined {
    return this.proxies.get(server);
  }

  /**
   * DIŞA AÇIK / TOPLU görünümdür (monitoring, gelecekteki Madde #22
   * telemetry entegrasyonu, health/readiness endpoint vb.). Madde #23
   * çözümü tam olarak burada: credential alanları YOK, her öğe bir kopya.
   */
  public getAllMetrics(): PublicProxyMetrics[] {
    return Array.from(this.proxies.values()).map((metrics) => this.toPublicMetrics(metrics));
  }
}
