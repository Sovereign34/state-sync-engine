// ProxyCredentialStore.ts
// Amaç:    Proxy sunucu listesini (server + şifreli username/password) SQLite
//          dosyasına kalıcı olarak yazar/okur — Madde #2'nin KASITLI olarak
//          daraltılmış dilimi (SADECE "proxy listesi restart'ta kaybolmasın"),
//          health/lease/quarantine kalıcılığı bu dosyanın KAPSAMI DIŞINDA
//          (Madde #2'nin geri kalanı ayrı bir [KARAR BİLDİRİMİ] bekliyor).
// Katman:  state
// Risk:    loadAll() sırasında herhangi bir kayıt SecretProvider ile deşifre
//          edilemezse (yanlış/değişmiş key), TÜM başlatma fail-closed olarak
//          durur (bilinçli edge-case kararı — tek kayıt bozuksa sessizce
//          atlamak yerine motor hiç başlamaz, çünkü aynı key TÜM kayıtları
//          şifrelediği için bu hemen her zaman bir key sorunudur, sessiz
//          atlama yanlış telemetri riski taşır, Madde 22 disiplini).
// Dokunma: SecretProvider.encrypt()/decrypt() payload formatı
//          (iv.authTag.ciphertext). AdvancedProxyManager.ts constructor'ı
//          (bu sınıfı opsiyonel bağımlılık olarak alır, registerProxy()
//          dışında hiçbir yerden yazma tetiklenmez — kararlaştırılan
//          edge-case #4).

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { SecretProvider } from '../security/SecretProvider';

export interface PersistedProxyCredential {
  server: string;
  username?: string;
  password?: string;
}

export class ProxyCredentialStore {
  private readonly db: DatabaseType;
  private readonly secretProvider: SecretProvider;

  constructor(dbPath: string, secretProvider: SecretProvider) {
    this.secretProvider = secretProvider;
    this.db = new Database(dbPath);
    this.ensureSchema();
  }

  private ensureSchema(): void {
    // Kararlaştırılan edge-case #2: tablo yoksa otomatik oluşturulur.
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS proxy_credentials (
           server TEXT PRIMARY KEY,
           username_enc TEXT,
           password_enc TEXT,
           updated_at INTEGER NOT NULL
         )`
      )
      .run();
  }

  /**
   * Tek bir proxy kaydını kalıcı hale getirir. `username`/`password`
   * `undefined` ise ilgili sütun NULL yazılır (credential'sız proxy'ler de
   * desteklenir). Kararlaştırılan edge-case #5: tek satır INSERT OR REPLACE,
   * better-sqlite3 senkron olduğu için partial-write riski yok.
   *
   * Bu metod SADECE AdvancedProxyManager.registerProxy() tarafından, ve
   * SADECE proxy havuza YENİ eklenirken çağrılmalı (kararlaştırılan
   * edge-case #4) — health metrikleri (latencyMs, counts, quarantineUntil
   * vb.) bu turda BİLEREK persist edilmiyor, sadece bellekte kalıyor.
   */
  public save(server: string, username?: string, password?: string): void {
    const usernameEnc = username !== undefined ? this.secretProvider.encrypt(username) : null;
    const passwordEnc = password !== undefined ? this.secretProvider.encrypt(password) : null;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO proxy_credentials (server, username_enc, password_enc, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(server, usernameEnc, passwordEnc, Date.now());
  }

  /**
   * Kalıcı tüm proxy kayıtlarını deşifre ederek döner. AdvancedProxyManager
   * constructor'ında, `initialProxies` işlenmeden ÖNCE çağrılır — DB'de
   * zaten var olan bir server, registerProxy()'nin "zaten kayıtlıysa
   * dokunma" davranışı sayesinde initialProxies'teki eşleşen girdiyle
   * ÜZERİNE YAZILMAZ (mevcut no-overwrite semantiği korunur, bkz.
   * AdvancedProxyManager.ts).
   *
   * Fail-closed: herhangi bir kaydın decrypt işlemi başarısız olursa bu
   * metod o noktada throw eder ve DÖNMEZ — kısmi/sessiz bir liste asla
   * üretilmez (kararlaştırılan edge-case #3).
   */
  public loadAll(): PersistedProxyCredential[] {
    const rows = this.db
      .prepare(`SELECT server, username_enc, password_enc FROM proxy_credentials`)
      .all() as Array<{ server: string; username_enc: string | null; password_enc: string | null }>;

    return rows.map((row) => {
      try {
        return {
          server: row.server,
          username: row.username_enc !== null ? this.secretProvider.decrypt(row.username_enc) : undefined,
          password: row.password_enc !== null ? this.secretProvider.decrypt(row.password_enc) : undefined,
        };
      } catch (err) {
        // Fail-closed: tek kayıt bile bozuksa tüm loadAll() başarısız olur.
        throw new Error(
          `[ProxyCredentialStore] '${row.server}' kaydı deşifre edilemedi — ` +
            `STATE_SYNC_ENCRYPTION_KEY yanlış/değişmiş olabilir. Motor fail-closed ` +
            `olarak durduruluyor (Madde #13 kararlaştırılan edge-case #3). ` +
            `Orijinal hata: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    });
  }

  /** Testler ve graceful shutdown için — bağlantıyı kapatır. */
  public close(): void {
    this.db.close();
  }
}
