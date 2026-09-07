// runtime-check-persistence.ts
// Amaç:    Madde #13 (SecretProvider + ProxyCredentialStore) için runtime
//          doğrulaması. Bu dosya GEÇİCİDİR — kalıcı test altyapısı DEĞİLDİR
//          (Madde #30/31 P2, henüz sıfırdan kurulmadı). Kullanıldıktan sonra
//          silinebilir veya repo kökünde runtime-check.ts ile birlikte tutulabilir.
// Katman:  (yok — process-level doğrulama script'i, production koduna dahil değil)
// Risk:    Bu script gerçek STATE_SYNC_ENCRYPTION_KEY'i KULLANMAZ — kendi
//          rastgele test key'lerini üretir, bu yüzden .env dosyanıza veya
//          gerçek DB'nize dokunmaz. Test DB dosyası (./runtime-check-test.sqlite)
//          her test öncesi/sonrası silinir.
//
// Çalıştırma: npx tsx runtime-check-persistence.ts

import fs from 'fs';
import { randomBytes } from 'crypto';
import { SecretProvider } from './src/security/SecretProvider';
import { ProxyCredentialStore } from './src/state/ProxyCredentialStore';
import { AdvancedProxyManager } from './src/network/AdvancedProxyManager';

const TEST_DB_PATH = './runtime-check-test.sqlite';

function cleanDb(): void {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
}

function genKey(): string {
  return randomBytes(32).toString('base64');
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS: ${label}`);
    passed++;
  } else {
    console.log(`FAIL: ${label}`);
    failed++;
  }
}

// TEST 1 — env var yokken SecretProvider fail-fast throw ediyor mu
function test1(): void {
  try {
    new SecretProvider(undefined);
    assert(false, 'TEST 1 — env var yokken throw ETMEDİ (beklenen: throw)');
  } catch (err) {
    assert(err instanceof Error, 'TEST 1 — env var yokken constructor throw etti (fail-fast)');
  }
}

// TEST 2 — registerProxy() aynı server ile iki kez çağrılınca DB'de tek satır kalıyor mu
function test2(): void {
  cleanDb();
  const secretProvider = new SecretProvider(genKey());
  const store = new ProxyCredentialStore(TEST_DB_PATH, secretProvider);
  const manager = new AdvancedProxyManager([], store);

  manager.registerProxy('proxy-a:8080', 'user1', 'pass1');
  manager.registerProxy('proxy-a:8080', 'user1', 'pass1'); // ikinci çağrı no-op olmalı

  const row = (store as unknown as { db: { prepare: (q: string) => { get: () => { count: number } } } }).db
    .prepare('SELECT COUNT(*) as count FROM proxy_credentials')
    .get();

  assert(row.count === 1, `TEST 2 — DB'de tek satır kalmalı (bulunan: ${row.count})`);

  store.close();
  cleanDb();
}

// TEST 3 — yanlış key ile loadAll() gerçekten fail-closed oluyor mu
function test3(): void {
  cleanDb();
  const correctKey = genKey();
  const wrongKey = genKey(); // farklı rastgele key

  const sp1 = new SecretProvider(correctKey);
  const store1 = new ProxyCredentialStore(TEST_DB_PATH, sp1);
  store1.save('proxy-b:8080', 'user2', 'pass2');
  store1.close();

  const sp2 = new SecretProvider(wrongKey);
  const store2 = new ProxyCredentialStore(TEST_DB_PATH, sp2);

  try {
    store2.loadAll();
    assert(false, 'TEST 3 — yanlış key ile loadAll() throw ETMEDİ (beklenen: throw, fail-closed)');
  } catch (err) {
    assert(err instanceof Error, 'TEST 3 — yanlış key ile loadAll() fail-closed throw etti');
  }

  store2.close();
  cleanDb();
}

// TEST 4 (bonus) — restart senaryosu: DB'de kayıtlı bir proxy, initialProxies'teki
// aynı server için farklı credential ile ÜZERİNE YAZILMAMALI (DB kazanır)
function test4(): void {
  cleanDb();
  const secretProvider = new SecretProvider(genKey());

  // "Önceki restart" simülasyonu — proxy DB'ye yazılıyor
  const store1 = new ProxyCredentialStore(TEST_DB_PATH, secretProvider);
  const manager1 = new AdvancedProxyManager([], store1);
  manager1.registerProxy('proxy-c:8080', 'persisted-user', 'persisted-pass');
  store1.close();

  // "Yeni restart" simülasyonu — aynı DB dosyası + initialProxies'te AYNI server
  // FARKLI credential ile geliyor (örn. config dosyası eskimiş)
  const store2 = new ProxyCredentialStore(TEST_DB_PATH, secretProvider);
  const manager2 = new AdvancedProxyManager(
    [{ server: 'proxy-c:8080', username: 'config-user', password: 'config-pass' }],
    store2
  );

  const metrics = manager2.getProxyMetrics('proxy-c:8080');
  assert(
    metrics?.username === 'persisted-user',
    `TEST 4 — DB'den yüklenen credential kazanmalı (bulunan username: ${metrics?.username})`
  );

  store2.close();
  cleanDb();
}

test1();
test2();
test3();
test4();

console.log(`\n${passed} PASS, ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
