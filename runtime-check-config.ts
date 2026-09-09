// (Madde #27) İzole runtime-check: loadConfig()'in varsayılan/override/hata/
// deep-freeze davranışını gerçek env var'larla test eder. Proje konvansiyonuna
// uyar (runtime-check-shutdown.ts, runtime-check-observer.ts ile aynı desen)
// — gerçek ESM import kullanır (strict mode garantili), TEST N/PASS-FAIL
// satırları basar, process.exitCode ile sonucu bildirir.
import { loadConfig } from './src/config/loadConfig';

let failed = false;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    failed = true;
    console.error(`FAIL: ${message}`);
  }
}

// Testler arası sızıntıyı önlemek için her testten önce/sonra env'i temizler.
const ENV_KEYS = [
  'STATE_SYNC_PROXY_LEASE_DURATION_MS',
  'STATE_SYNC_QUARANTINE_HTTP403_BASE_MS',
  'STATE_SYNC_QUARANTINE_HTTP403_CAP_MS',
  'STATE_SYNC_QUARANTINE_HTTP429_BASE_MS',
  'STATE_SYNC_QUARANTINE_HTTP429_CAP_MS',
  'STATE_SYNC_QUARANTINE_DNS_FAIL_MS',
  'STATE_SYNC_QUARANTINE_TLS_FAIL_MS',
  'STATE_SYNC_QUARANTINE_NETWORK_FAIL_MS',
  'STATE_SYNC_HEALTH_SCORE_LATENCY_PENALTY_DIVISOR',
  'STATE_SYNC_HEALTH_SCORE_HTTP403_PENALTY',
  'STATE_SYNC_HEALTH_SCORE_DNS_FAILURE_PENALTY',
  'STATE_SYNC_HEALTH_SCORE_TLS_FAILURE_PENALTY',
  'STATE_SYNC_HEALTH_SCORE_EMA_ALPHA',
  'STATE_SYNC_LOG_LEVEL',
];

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function testDefaultsMatchHardcodedValues(): void {
  clearEnv();
  const c = loadConfig();

  assert(c.proxy.leaseDurationMs === 300000, 'TEST 1 — leaseDurationMs varsayılanı (5*60*1000)');
  assert(c.proxy.quarantine.http403BaseMs === 120000, 'TEST 1 — http403BaseMs varsayılanı');
  assert(c.proxy.quarantine.http403CapMs === 3600000, 'TEST 1 — http403CapMs varsayılanı');
  assert(c.proxy.quarantine.http429BaseMs === 30000, 'TEST 1 — http429BaseMs varsayılanı');
  assert(c.proxy.quarantine.http429CapMs === 600000, 'TEST 1 — http429CapMs varsayılanı');
  assert(c.proxy.quarantine.dnsFailMs === 60000, 'TEST 1 — dnsFailMs varsayılanı');
  assert(c.proxy.quarantine.tlsFailMs === 90000, 'TEST 1 — tlsFailMs varsayılanı');
  assert(c.proxy.quarantine.networkFailMs === 45000, 'TEST 1 — networkFailMs varsayılanı');
  assert(c.proxy.healthScore.latencyPenaltyDivisor === 50, 'TEST 1 — latencyPenaltyDivisor varsayılanı');
  assert(c.proxy.healthScore.http403Penalty === 20, 'TEST 1 — http403Penalty varsayılanı');
  assert(c.proxy.healthScore.dnsFailurePenalty === 15, 'TEST 1 — dnsFailurePenalty varsayılanı');
  assert(c.proxy.healthScore.tlsFailurePenalty === 15, 'TEST 1 — tlsFailurePenalty varsayılanı');
  assert(c.proxy.healthScore.emaAlpha === 0.3, 'TEST 1 — emaAlpha varsayılanı');
  assert(c.logLevel === 'info', 'TEST 1 — logLevel varsayılanı');

  clearEnv();
}

function testEnvVarOverrideIsRespected(): void {
  clearEnv();
  process.env.STATE_SYNC_PROXY_LEASE_DURATION_MS = '999999';
  process.env.STATE_SYNC_LOG_LEVEL = 'debug';

  const c = loadConfig();

  assert(
    c.proxy.leaseDurationMs === 999999,
    'TEST 2 — STATE_SYNC_PROXY_LEASE_DURATION_MS override gerçekten kullanılıyor'
  );
  assert(c.logLevel === 'debug', 'TEST 2 — STATE_SYNC_LOG_LEVEL override gerçekten kullanılıyor');
  assert(
    c.proxy.quarantine.http403BaseMs === 120000,
    'TEST 2 — override edilmeyen alanlar varsayılanda kalıyor (yan etki yok)'
  );

  clearEnv();
}

function testInvalidNumberThrowsNotSilentFallback(): void {
  clearEnv();
  process.env.STATE_SYNC_PROXY_LEASE_DURATION_MS = 'not-a-number';

  let threw = false;
  try {
    loadConfig();
  } catch {
    threw = true;
  }

  assert(threw, 'TEST 3 — geçersiz sayısal env var sessizce varsayılana düşmez, throw eder (Kural #4)');

  clearEnv();
}

function testInvalidLogLevelThrows(): void {
  clearEnv();
  process.env.STATE_SYNC_LOG_LEVEL = 'trace'; // tanınmayan seviye

  let threw = false;
  try {
    loadConfig();
  } catch {
    threw = true;
  }

  assert(threw, 'TEST 4 — tanınmayan STATE_SYNC_LOG_LEVEL throw eder');

  clearEnv();
}

function testDeepFreezeActuallyPreventsMutation(): void {
  clearEnv();
  const c = loadConfig();

  assert(Object.isFrozen(c), 'TEST 5 — kök obje frozen');
  assert(Object.isFrozen(c.proxy), 'TEST 5 — proxy alt-objesi frozen');
  assert(Object.isFrozen(c.proxy.quarantine), 'TEST 5 — quarantine alt-objesi frozen');
  assert(Object.isFrozen(c.proxy.healthScore), 'TEST 5 — healthScore alt-objesi frozen');

  // Gerçek ESM modülü = spesifikasyon gereği strict mode. Frozen bir property'ye
  // atama sloppy mode'da SESSİZCE no-op olur, strict mode'da throw eder.
  // Önceki `tsx -e` inline testinde throw ETMEMİŞTİ — burada gerçek .ts
  // dosyası + gerçek import ile bu varsayımı yeniden test ediyoruz.
  let rootMutationThrew = false;
  try {
    (c.proxy as { leaseDurationMs: number }).leaseDurationMs = 1;
  } catch {
    rootMutationThrew = true;
  }
  assert(
    rootMutationThrew && c.proxy.leaseDurationMs === 300000,
    'TEST 5 — proxy.leaseDurationMs mutasyonu throw etti VE değer değişmedi'
  );

  let nestedMutationThrew = false;
  try {
    (c.proxy.quarantine as { http403BaseMs: number }).http403BaseMs = 1;
  } catch {
    nestedMutationThrew = true;
  }
  assert(
    nestedMutationThrew && c.proxy.quarantine.http403BaseMs === 120000,
    'TEST 5 — quarantine.http403BaseMs mutasyonu throw etti VE değer değişmedi (iç içe freeze)'
  );

  clearEnv();
}

testDefaultsMatchHardcodedValues();
testEnvVarOverrideIsRespected();
testInvalidNumberThrowsNotSilentFallback();
testInvalidLogLevelThrows();
testDeepFreezeActuallyPreventsMutation();

if (failed) {
  console.error('\nSONUÇ: EN AZ BİR TEST FAIL — Madde #27 (ilk slice) kapanamaz.');
  process.exitCode = 1;
} else {
  console.log('\nSONUÇ: 5/5 TEST GRUBU PASS');
}
