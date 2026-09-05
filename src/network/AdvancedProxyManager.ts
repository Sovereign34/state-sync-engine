import { ProxyMetrics } from '../types';

export class AdvancedProxyManager {
  private proxies: Map<string, ProxyMetrics> = new Map();

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

  public acquireProxy(): ProxyMetrics {
    const now = Date.now();
    const allProxies = Array.from(this.proxies.values());

    if (allProxies.length === 0) {
      throw new Error('[AdvancedProxyManager] Proxy havuzu tamamen boş. En az bir proxy tanımlanmalı.');
    }

    // Karantina süresi dolmuş, sağlıklı adayları filtrele
    const healthyCandidates = allProxies.filter((p) => p.quarantineUntil <= now);

    // Bütün proxy'ler karantinadaysa (Fail-Closed Güvencesi - Rapordaki Madde 3)
    if (healthyCandidates.length === 0) {
      // Karantinası ilk bitecek olan proxy'nin kalan süresini bul
      const minQuarantineTime = Math.min(...allProxies.map((p) => p.quarantineUntil));
      const waitMs = Math.max(minQuarantineTime - now, 1000);
      
      throw new Error(
        `[AdvancedProxyManager] Bütün proxy'ler karantinada! Unhealthy proxy dönülmüyor. En yakın karantina bitişi: ${Math.ceil(waitMs / 1000)}s`
      );
    }

    // Sağlık skoruna göre sırala (Latans ve başarı oranına dayalı)
    healthyCandidates.sort((a, b) => this.calculateHealthScore(b) - this.calculateHealthScore(a));

    const selected = healthyCandidates[0];
    selected.lastUsed = now;
    return selected;
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

  public getProxyMetrics(server: string): ProxyMetrics | undefined {
    return this.proxies.get(server);
  }

  public getAllMetrics(): ProxyMetrics[] {
    return Array.from(this.proxies.values());
  }
}
