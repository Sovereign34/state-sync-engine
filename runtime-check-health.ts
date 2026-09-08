// runtime-check-health.ts
// Amaç:  Madde #2 (proxy health/quarantine kalıcılığı) için bağımsız runtime
//        doğrulama script'i. Madde #13/#33'teki runtime-check-*.ts deseniyle
//        aynı yaklaşım: gerçek sınıfları (mock DEĞİL) geçici bir SQLite
//        dosyasına karşı çalıştırır, her TEST kendi assert'ini yapar.
//
// Çalıştırma (repo kökünden, better-sqlite3 zaten kurulu olmalı — Madde #13
// zaten bu bağımlılığı kullanıyor):
//   npx ts-node runtime-check-health.ts ; echo "EXIT CODE: $?"
//
// AÇIK VARSAYIM: Bu script'in repo KÖKÜNE konduğu ve `src/state/...`,
// `src/network/...` yollarının buradan doğru çözüldüğü varsayıldı. Script
// başka bir konuma (örn. scripts/) taşınırsa import path'leri buna göre
// güncellenmeli.

import * as fs from 'fs';
import * as path from 'path';
import { ProxyHealthStore } from './src/state/ProxyHealthStore';
import { AdvancedProxyManager } from './src/network/AdvancedProxyManager';

const DB_PATH = path.join(__dirname, '__runtime-check-health.sqlite');

function cleanDb(): void {
  if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS - ${name}`);
    passed++;
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(`       ${err instanceof Error ? err.message : String(err)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// TEST 1 — save() + loadAll() round trip: yazılan değerler aynen dönmeli
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 1: save() + loadAll() round trip', () => {
  const store = new ProxyHealthStore(DB_PATH);
  store.save({
    server: 'proxy-a:8080',
    latencyMs: 123,
    dnsFailures: 1,
    tlsFailures: 0,
    http403Count: 2,
    http429Count: 0,
    successCount: 10,
    failureCount: 2,
    lastUsed: 1000,
    quarantineUntil: 999999999999,
  });

  const loaded = store.loadAll();
  assert(loaded.length === 1, `1 kayıt bekleniyordu, ${loaded.length} geldi`);
  const record = loaded[0];
  assert(record.server === 'proxy-a:8080', 'server alanı eşleşmiyor');
  assert(record.latencyMs === 123, 'latencyMs eşleşmiyor');
  assert(record.http403Count === 2, 'http403Count eşleşmiyor');
  assert(record.quarantineUntil === 999999999999, 'quarantineUntil eşleşmiyor');
  store.close();
});

// ---------------------------------------------------------------------------
// TEST 2 — TTL: eski kayıt loadAll() sonucuna dahil edilmemeli
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 2: TTL süresi geçmiş kayıt hariç tutulur', () => {
  const store = new ProxyHealthStore(DB_PATH);
  store.save({
    server: 'proxy-stale:8080',
    latencyMs: 50,
    dnsFailures: 0,
    tlsFailures: 0,
    http403Count: 0,
    http429Count: 0,
    successCount: 5,
    failureCount: 0,
    lastUsed: 500,
    quarantineUntil: 0,
  });

  // TTL'i 0 vererek "her şey stale" senaryosunu simüle ediyoruz — gerçek
  // 24 saatlik varsayımı beklemeden TTL mantığını test etmenin en güvenilir
  // yolu bu (zamanı mocklamak yerine TTL parametresini sıfırlamak).
  const loaded = store.loadAll(0);
  assert(loaded.length === 0, `TTL=0 ile 0 kayıt bekleniyordu, ${loaded.length} geldi`);
  store.close();
});

// ---------------------------------------------------------------------------
// TEST 3 — AdvancedProxyManager restart hydration: yeni instance, aynı
// healthStore ile health değerlerini map'e doğru yüklemeli
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 3: restart sonrası health hydration doğru çalışır', () => {
  const healthStore = new ProxyHealthStore(DB_PATH);

  // "Önceki oturum": proxy'yi kaydet, bir hata tetikle (quarantine + persist)
  const manager1 = new AdvancedProxyManager(
    [{ server: 'proxy-b:8080' }],
    undefined,
    healthStore
  );
  manager1.markFailed('proxy-b:8080', 'HTTP_429');
  const before = manager1.getProxyMetrics('proxy-b:8080');
  assert(!!before && before.quarantineUntil > Date.now(), 'ilk instance karantinaya girmemiş');

  // "Restart": yeni instance, aynı healthStore ile kuruluyor
  const manager2 = new AdvancedProxyManager(
    [{ server: 'proxy-b:8080' }],
    undefined,
    healthStore
  );
  const after = manager2.getProxyMetrics('proxy-b:8080');
  assert(!!after, 'restart sonrası proxy map\'te bulunamadı');
  assert(after!.http429Count === 1, `http429Count restart sonrası 1 olmalıydı, ${after!.http429Count} geldi`);
  assert(after!.quarantineUntil === before!.quarantineUntil, 'quarantineUntil restart sonrası korunmadı');

  healthStore.close();
});

// ---------------------------------------------------------------------------
// TEST 4 — Orphan health kaydı: map'te karşılığı olmayan server için yeni
// proxy YARATILMAMALI (sessizce atlanmalı)
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 4: orphan health kaydı yeni proxy yaratmaz', () => {
  const healthStore = new ProxyHealthStore(DB_PATH);
  healthStore.save({
    server: 'proxy-ghost:8080', // hiçbir initialProxies/credential listesinde yok
    latencyMs: 10,
    dnsFailures: 0,
    tlsFailures: 0,
    http403Count: 0,
    http429Count: 0,
    successCount: 1,
    failureCount: 0,
    lastUsed: 1,
    quarantineUntil: 0,
  });

  const manager = new AdvancedProxyManager(
    [{ server: 'proxy-real:8080' }],
    undefined,
    healthStore
  );

  assert(manager.getProxyMetrics('proxy-ghost:8080') === undefined, 'orphan kayıt için proxy yaratılmış');
  assert(manager.getProxyMetrics('proxy-real:8080') !== undefined, 'gerçek proxy map\'te olmalıydı');

  healthStore.close();
});

// ---------------------------------------------------------------------------
// TEST 5 — Yazma stratejisi: recordSuccess() DB'ye yazmamalı, SADECE
// markFailed() (karantina tetiklendiğinde) yazmalı
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 5: recordSuccess() persist tetiklemez, markFailed() tetikler', () => {
  const healthStore = new ProxyHealthStore(DB_PATH);
  const manager = new AdvancedProxyManager(
    [{ server: 'proxy-c:8080' }],
    undefined,
    healthStore
  );

  manager.recordSuccess('proxy-c:8080', 100);
  let loaded = healthStore.loadAll();
  assert(loaded.length === 0, `recordSuccess sonrası 0 kayıt bekleniyordu, ${loaded.length} geldi`);

  manager.markFailed('proxy-c:8080', 'DNS_FAIL');
  loaded = healthStore.loadAll();
  assert(loaded.length === 1, `markFailed sonrası 1 kayıt bekleniyordu, ${loaded.length} geldi`);

  healthStore.close();
});

// ---------------------------------------------------------------------------
// TEST 6 — Best-effort yazma: DB kapatıldıktan sonra save() çağrısı throw
// ETMEMELİ, in-memory state etkilenmemeli (markFailed() dışarı hata sızdırmaz)
// ---------------------------------------------------------------------------
cleanDb();
runTest('TEST 6: DB yazma hatası markFailed()\'i kırmaz (best-effort)', () => {
  const healthStore = new ProxyHealthStore(DB_PATH);
  const manager = new AdvancedProxyManager(
    [{ server: 'proxy-d:8080' }],
    undefined,
    healthStore
  );

  healthStore.close(); // DB'yi bilerek kapatıyoruz — sonraki save() hata vermeli

  let threw = false;
  try {
    manager.markFailed('proxy-d:8080', 'TLS_FAIL');
  } catch {
    threw = true;
  }

  assert(!threw, 'markFailed() DB kapalıyken throw etti — best-effort ihlali');
  const metrics = manager.getProxyMetrics('proxy-d:8080');
  assert(!!metrics && metrics.tlsFailures === 1, 'in-memory state DB hatasından etkilenmiş görünüyor');
});

// ---------------------------------------------------------------------------
cleanDb();
console.log(`\n${passed}/${passed + failed} PASS`);
process.exit(failed === 0 ? 0 : 1);
