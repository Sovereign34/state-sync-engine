// ProxyHealthStore.ts
// Amaç:    Proxy health/quarantine metriklerini (latencyMs, dnsFailures,
//          tlsFailures, http403Count, http429Count, successCount,
//          failureCount, lastUsed, quarantineUntil) SQLite'a kalıcı hale
//          getirir — Madde #2'nin ProxyCredentialStore'un KASITLI olarak
//          kapsam dışı bıraktığı geri kalanı (bkz. ProxyCredentialStore.ts
//          başlığı). Credential store ile AYNI DB dosyasını paylaşır, AYRI
//          bir tabloda (`proxy_health`) tutar — health verisi şifreli/hassas
//          değildir, credential ile aynı sınıfta KARIŞTIRILMAZ (KOD KALİTESİ
//          Kural #1, tek sınıf → tek sorumluluk → tek katman).
// Katman:  state
// Risk:    `save()` ASLA throw ETMEMELİDİR — çağıran taraf
//          (AdvancedProxyManager.markFailed()) bir hot-path fonksiyonu, DB
//          yazma hatası onun in-memory karantina mantığını KIRMAMALI
//          (kararlaştırılan karar: yazma hatası → best-effort, logla, devam
//          et). `loadAll()` ise başlatma anında çağrılır; ProxyCredentialStore
//          ile TAM TERSİ bir edge-case kararı bilerek verildi: tek bir bozuk
//          health kaydı (veya DB'nin tamamı okunamazsa) tüm hydration'ı
//          düşürmez, sessizce atlanır — çünkü health verisi credential'ın
//          aksine KRİTİK DEĞİLDİR, motor sıfır health ile de güvenle başlar.
//          TTL (varsayılan 24 saat) süresi geçmiş kayıtlar da aynı şekilde
//          sonuca dahil edilmez (stale health, restart sonrası "temiz sayfa"
//          ile başlar — kararlaştırılan karar).
// Dokunma: `AdvancedProxyManager.ts` constructor'ı (opsiyonel 4. parametre
//          `healthStore`) ve `markFailed()` (quarantineUntil güncellendiği
//          ANDA `save()` çağrılır — write-through DEĞİL, kararlaştırılan
//          yazma stratejisi). Aynı DB dosyasını kullanan
//          `ProxyCredentialStore.ts` ile composition-root'ta `dbPath`
//          senkron tutulmalı (ikisi aynı yolu almalı, aksi hâlde iki ayrı
//          SQLite dosyası oluşur ve health/credential birbirinden kopar).
//          (Yeni — Madde #15) Opsiyonel `logger?: ILogger` 2. parametre
//          eklendi — verilmezse `ConsoleJsonLogger('ProxyHealthStore')`
//          varsayılan olur (bkz. `../telemetry/ILogger`,
//          `../telemetry/ConsoleJsonLogger`). Eskiden burada elle üretilen
//          `{"level","component","message",...}` JSON'ı artık bu sınıf
//          tarafından merkezi olarak üretiliyor — çıktı ŞEKLİ DEĞİŞMEDİ,
//          sadece üretim yeri merkezileşti.

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { ILogger } from '../telemetry/ILogger';
import { ConsoleJsonLogger } from '../telemetry/ConsoleJsonLogger';

export interface PersistedProxyHealth {
  server: string;
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

// Kararlaştırılan varsayım (KARAR BİLDİRİMİ'nde "Açık varsayımlar" olarak
// işaretlendi) — bu süreden eski health kaydı stale kabul edilir ve
// hydration'a dahil edilmez.
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export class ProxyHealthStore {
  private readonly db: DatabaseType;
  private readonly logger: ILogger;

  constructor(dbPath: string, logger: ILogger = new ConsoleJsonLogger('ProxyHealthStore')) {
    this.db = new Database(dbPath);
    this.logger = logger;
    this.ensureSchema();
  }

  private ensureSchema(): void {
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS proxy_health (
           server TEXT PRIMARY KEY,
           latency_ms INTEGER NOT NULL,
           dns_failures INTEGER NOT NULL,
           tls_failures INTEGER NOT NULL,
           http403_count INTEGER NOT NULL,
           http429_count INTEGER NOT NULL,
           success_count INTEGER NOT NULL,
           failure_count INTEGER NOT NULL,
           last_used INTEGER NOT NULL,
           quarantine_until INTEGER NOT NULL,
           updated_at INTEGER NOT NULL
         )`
      )
      .run();
  }

  /**
   * `AdvancedProxyManager.markFailed()` içinde, quarantineUntil güncellendiği
   * ANDA çağrılır (kararlaştırılan yazma stratejisi: write-through değil,
   * sadece karantina tetiklendiğinde — recordSuccess() ara güncellemeleri
   * bu turda BİLEREK persist edilmiyor, kararlaştırılan trade-off).
   *
   * Best-effort: hata durumunda throw ETMEZ, structured JSON log basar ve
   * sessizce döner. Çağıran tarafın in-memory mantığı bu sınıftan tamamen
   * bağımsız çalışmaya devam etmeli (bkz. dosya başlığı Risk notu).
   */
  public save(health: PersistedProxyHealth): void {
    try {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO proxy_health (
             server, latency_ms, dns_failures, tls_failures, http403_count,
             http429_count, success_count, failure_count, last_used,
             quarantine_until, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          health.server,
          health.latencyMs,
          health.dnsFailures,
          health.tlsFailures,
          health.http403Count,
          health.http429Count,
          health.successCount,
          health.failureCount,
          health.lastUsed,
          health.quarantineUntil,
          Date.now()
        );
    } catch (err) {
      this.logger.error('health kaydı yazılamadı — best-effort, in-memory state etkilenmedi', {
        server: health.server,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Kalıcı health kayıtlarını okur ve TTL uygular (varsayılan
   * `DEFAULT_TTL_MS` = 24 saat — kararlaştırılan varsayım, çağıran taraf
   * override edebilir). `updated_at` TTL'den eskiyse kayıt SONUCA DAHİL
   * EDİLMEZ — `AdvancedProxyManager` zaten yeni proxy'leri sıfır değerlerle
   * başlattığı için "dahil etmemek" fiilen "sıfırla" anlamına gelir.
   *
   * Fail-open: DB/tablo okunamazsa (ör. dosya bozuk) TÜM hydration atlanır,
   * boş dizi döner — throw EDİLMEZ (ProxyCredentialStore'un fail-closed
   * davranışının BİLİNÇLİ TERSİ, bkz. dosya başlığı).
   */
  public loadAll(ttlMs: number = DEFAULT_TTL_MS): PersistedProxyHealth[] {
    const now = Date.now();
    let rows: Array<PersistedProxyHealth & { updated_at: number }>;

    try {
      rows = this.db
        .prepare(
          `SELECT server, latency_ms AS latencyMs, dns_failures AS dnsFailures,
                  tls_failures AS tlsFailures, http403_count AS http403Count,
                  http429_count AS http429Count, success_count AS successCount,
                  failure_count AS failureCount, last_used AS lastUsed,
                  quarantine_until AS quarantineUntil, updated_at
           FROM proxy_health`
        )
        .all() as Array<PersistedProxyHealth & { updated_at: number }>;
    } catch (err) {
      this.logger.error('health kayıtları okunamadı — hydration atlanıyor, motor sıfır health ile başlıyor', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }

    return rows
      .filter((row) => now - row.updated_at <= ttlMs)
      .map(({ updated_at, ...health }) => health);
  }

  /** Testler ve graceful shutdown için — bağlantıyı kapatır. */
  public close(): void {
    this.db.close();
  }
}
