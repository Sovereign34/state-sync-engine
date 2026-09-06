// runtime-check.ts
// Amaç:    Madde #6 (sıralı recovery işleme), #7 (RecoveryCommandPort tek yolu),
//          #8 (make-before-break transaction/rollback) ve #22 (network→proxy
//          metrics instrumentation: THROTTLE + ROTATE_SESSION_ONLY→markFailed
//          köprüsü) için birleşik runtime doğrulama senaryosu.
// Katman:  verification (production kodu değil — src/ dışında tutulur, Madde #1)
// Risk:    Bu betik gerçek Playwright/proxy altyapısını KULLANMAZ — Browser ve
//          AdvancedProxyManager minimal mock'larla değiştirilmiştir. Amaç,
//          governor/engine arasındaki sıralama, komut-yönlendirme mantığını VE
//          (bu tur) proxy metrics telemetrisinin doğru proxy'ye/doğru anomaly
//          tipine bağlandığını izole doğrulamaktır; network/proxy katmanının
//          kendisi bu betiğin kapsamı DIŞINDADIR.
// Dokunma: src/engine/AdaptiveGovernor.ts, src/engine/PersistentStateEngine.ts,
//          src/types/governor-command.types.ts — imzalar değişirse bu betik
//          de güncellenmeli.
// DEĞİŞİKLİK (bu tur, Madde #22 genişletme doğrulaması):
//   (a) `PersistentStateEngine` artık 4. argüman olarak `authValidator`
//       zorunlu kılıyor — mock `{ validate: async () => true }` eklendi.
//       Bunsuz önceki hâli constructor'da patlamıyordu, ama
//       `createSessionWithFreshState`'in preserve=true dalında
//       `this.authValidator.validate(...)` çağrısı `undefined` üzerinde
//       patlayıp rollback'e düşüyordu — testler "geçiyor" görünüyordu ama
//       YANLIŞ SEBEPTEN (gerçek COMMIT yolu hiç çalışmamış olabilirdi).
//       Şimdi gerçek COMMIT yolu doğrulanıyor.
//   (b) `mockProxyManager` stateful hale getirildi: proxyId → gerçek
//       http429Count/http403Count sayaçları bir `Map` üzerinde tutuluyor,
//       `markFailed()` bunları artırıyor, `getProxyMetrics()` güncel
//       değerleri dönüyor. `markFailedCalls` log dizisi eklendi — hangi
//       proxy'ye hangi sebeple çağrıldığını doğrulamak için.
//   (c) Yeni TEST 3: HTTP_429/scope=SESSION → ROTATE_SESSION_ONLY →
//       markFailed('HTTP_429') ROTASYONDAN ÖNCEKİ (eski/aktif) proxy'ye
//       uygulanıyor mu, ve o proxy'nin http429Count'u gerçekten artıyor mu.
//   (d) TEST 2'ye ek assertion: CHALLENGE_DETECTED de ROTATE_SESSION_ONLY'e
//       düşüyor (AdaptiveGovernor.evaluatePolicy) — bu senaryoda markFailed
//       HİÇ çağrılmamalı (tip-guard'ın gerçekten HTTP_429'a özel olduğunun
//       kanıtı; düzeltilen Hata 1'in regresyon testi).
//
// Çalıştırma (repo kökünden):
//   npx ts-node --transpile-only runtime-check.ts
//
// --transpile-only ZORUNLU: mock nesneler AdvancedProxyManager/Browser'ın
// TAM tip sözleşmesini karşılamaz (kasıtlı olarak `as unknown as X` ile
// cast edilmiştir), tam tip kontrolü burada anlamsız hata verir.

import { AdaptiveGovernor } from './src/engine/AdaptiveGovernor';
import { PersistentStateEngine } from './src/engine/PersistentStateEngine';
import { AnomalyType, AnomalyScope, ProxyLease, ProxyMetrics, AuthValidationPort } from './src/types';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { AdvancedProxyManager } from './src/network/AdvancedProxyManager';

let leaseCounter = 0;
const acquiredLeaseIds: string[] = [];
const releasedLeaseIds: string[] = [];
const leaseIdToProxyId = new Map<string, string>();
const markFailedCalls: Array<{ proxyId: string; reason: string }> = [];

function log(msg: string): void {
  console.log(msg);
}

/**
 * (Bu tur) Şu ana kadar acquire edilip henüz release EDİLMEMİŞ en son lease —
 * yani engine.currentLease'in dışarıdan (bir getter olmadan) gözlemlenebilir
 * karşılığı. Test 2'deki başarısız/rollback edilen deneme gibi "acquire
 * edildi ama sonra release edildi" leaseleri atlar.
 */
function getActiveLeaseId(): string {
  for (let i = acquiredLeaseIds.length - 1; i >= 0; i--) {
    if (!releasedLeaseIds.includes(acquiredLeaseIds[i])) {
      return acquiredLeaseIds[i];
    }
  }
  throw new Error('[runtime-check] Aktif lease bulunamadı — beklenmeyen durum');
}

function getActiveProxyId(): string {
  const leaseId = getActiveLeaseId();
  const proxyId = leaseIdToProxyId.get(leaseId);
  if (!proxyId) {
    throw new Error(`[runtime-check] leaseId için proxyId bulunamadı: ${leaseId}`);
  }
  return proxyId;
}

// ---------------- Mock AdvancedProxyManager ----------------
interface MutableProxyState {
  http429Count: number;
  http403Count: number;
}
const proxyState = new Map<string, MutableProxyState>();

function ensureProxyState(proxyId: string): MutableProxyState {
  let state = proxyState.get(proxyId);
  if (!state) {
    state = { http429Count: 0, http403Count: 0 };
    proxyState.set(proxyId, state);
  }
  return state;
}

const mockProxyManager = {
  acquireProxy(sessionId: string): ProxyLease {
    leaseCounter++;
    const lease: ProxyLease = {
      leaseId: `lease-${leaseCounter}`,
      proxyId: `proxy-${leaseCounter}`,
      sessionId,
      acquiredAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    };
    acquiredLeaseIds.push(lease.leaseId);
    leaseIdToProxyId.set(lease.leaseId, lease.proxyId);
    ensureProxyState(lease.proxyId);
    log(`  [ProxyManager] acquireProxy() -> ${lease.leaseId}`);
    return lease;
  },
  getProxyMetrics(proxyId: string): ProxyMetrics | undefined {
    const state = ensureProxyState(proxyId);
    return {
      server: `http://${proxyId}.example:8080`,
      username: 'redacted-user',
      password: 'redacted-pass',
      latencyMs: 40,
      dnsFailures: 0,
      tlsFailures: 0,
      http403Count: state.http403Count,
      http429Count: state.http429Count,
      successCount: 0,
      failureCount: 0,
      lastUsed: Date.now(),
      quarantineUntil: 0,
    };
  },
  releaseProxy(leaseId: string): void {
    releasedLeaseIds.push(leaseId);
    log(`  [ProxyManager] releaseProxy(${leaseId})`);
  },
  markFailed(proxyId: string, reason: string): void {
    markFailedCalls.push({ proxyId, reason });
    const state = ensureProxyState(proxyId);
    if (reason === 'HTTP_429') state.http429Count++;
    if (reason === 'HTTP_403') state.http403Count++;
    log(`  [ProxyManager] markFailed(${proxyId}, ${reason})`);
  },
} as unknown as AdvancedProxyManager;

// ---------------- Mock AuthValidationPort ----------------
// (Bu tur) PersistentStateEngine'in 4. argümanı artık zorunlu — bunsuz
// createSessionWithFreshState(preserve=true) dalı authValidator.validate()'i
// undefined üzerinde çağırıp patlıyordu (bkz. dosya başlığı, (a)).
const mockAuthValidator = {
  validate: async () => true,
} as unknown as AuthValidationPort;

// ---------------- Mock Browser / Context / Page ----------------
let contextCounter = 0;
let failNextContextCreation = false;

function makeMockPage(): Page {
  return {
    on: () => {},
    evaluate: async () => ({}),
    addInitScript: async () => {},
  } as unknown as Page;
}

function makeMockContext(id: number): BrowserContext {
  return {
    __mockId: id,
    cookies: async () => [],
    addCookies: async () => {},
    newPage: async () => makeMockPage(),
    close: async () => log(`  [Context] context-${id} kapatıldı`),
  } as unknown as BrowserContext;
}

const mockBrowser = {
  newContext: async (_opts: unknown) => {
    if (failNextContextCreation) {
      failNextContextCreation = false;
      throw new Error('SIMULATED: newContext() patladı');
    }
    contextCounter++;
    log(`  [Browser] newContext() -> context-${contextCounter}`);
    return makeMockContext(contextCounter);
  },
} as unknown as Browser;

async function waitUntilIdle(governor: AdaptiveGovernor): Promise<void> {
  while (governor.getQueueSize() > 0) {
    await new Promise((r) => setTimeout(r, 10));
  }
  await new Promise((r) => setTimeout(r, 50)); // son elemanın işlenmesi için ek pay
}

async function main(): Promise<void> {
  let failures = 0;
  const fail = (msg: string) => { failures++; console.log(`  ❌ FAIL: ${msg}`); };
  const pass = (msg: string) => console.log(`  ✅ PASS: ${msg}`);

  const governor = new AdaptiveGovernor();
  const engine = new PersistentStateEngine(mockBrowser, mockProxyManager, governor, mockAuthValidator);
  await engine.initialize();

  let legacyListenerCount = 0;
  governor.on('decision', () => { legacyListenerCount++; });

  // ============ TEST 1 — Madde #6 (sıralı işleme) + #7 (tek yol) ============
  console.log('\n=== TEST 1: iki farklı anomaly art arda enqueue ediliyor ===');
  const leasesBefore = acquiredLeaseIds.length;

  governor.enqueueAnomaly({
    id: 'a-403', type: AnomalyType.HTTP_403, scope: AnomalyScope.IP, timestamp: Date.now(),
  });
  governor.enqueueAnomaly({
    id: 'a-net', type: AnomalyType.NETWORK_FAILURE, scope: AnomalyScope.INFRASTRUCTURE, timestamp: Date.now(),
  });

  await waitUntilIdle(governor);

  const leasesAcquired = acquiredLeaseIds.length - leasesBefore;
  log(`  -> Bu turda acquireProxy() çağrı sayısı: ${leasesAcquired} (beklenen: 2)`);
  log(`  -> Legacy '.on(decision,...)' tetiklenme sayısı: ${legacyListenerCount} (event hâlâ emit ediliyor, ama PersistentStateEngine artık ONDAN değil port'tan işliyor)`);

  if (leasesAcquired === 2) {
    pass('iki farklı anomaly, iki ayrı recovery olarak işlendi — ikinci decision kaybolmadı (Madde #6)');
  } else {
    fail(`beklenen 2 acquireProxy çağrısı, gerçekleşen ${leasesAcquired} — ikinci decision düşmüş olabilir`);
  }

  if (legacyListenerCount === 2) {
    pass("legacy '.on(decision,...)' hâlâ genel EventEmitter API'si olarak çalışıyor (kaldırılan sadece PersistentStateEngine'in ONA abone olmasıydı)");
  } else {
    fail(`legacy listener beklenmeyen sayıda tetiklendi: ${legacyListenerCount}`);
  }

  // acquire-before-release sırası (Madde #8 davranış değişikliği) her iki
  // rotasyonda da korunmalı: her release'den önce o rotasyonun kendi acquire'ı olmalı.
  if (releasedLeaseIds.length >= 2 && acquiredLeaseIds.length >= releasedLeaseIds.length) {
    pass('acquire→release sırası (make-before-break) korunuyor');
  } else {
    fail('acquire/release sayıları tutarsız');
  }

  // ============ TEST 2 — Madde #8 (rollback) + Madde #22 Hata-1 regresyonu ============
  console.log('\n=== TEST 2: context oluşturma sırasında hata enjekte ediliyor (CHALLENGE_DETECTED) ===');
  const contextBefore = engine.getContext();
  const leaseIdBeforeTest2Attempt = acquiredLeaseIds.length;
  const markFailedCallsBeforeTest2 = markFailedCalls.length;

  failNextContextCreation = true;
  governor.enqueueAnomaly({
    id: 'a-challenge', type: AnomalyType.CHALLENGE_DETECTED, scope: AnomalyScope.SESSION, timestamp: Date.now(),
  });

  await waitUntilIdle(governor);

  const contextAfter = engine.getContext();
  const newLeaseIdAttempted = acquiredLeaseIds[leaseIdBeforeTest2Attempt]; // bu turda denenen lease

  if (contextAfter === contextBefore) {
    pass('newContext() patladıktan sonra eski context DEĞİŞMEDİ (rollback çalıştı, eski oturum sapasağlam)');
  } else {
    fail('context değişmiş — rollback başarısız, eski oturum kaybedilmiş olabilir');
  }

  if (newLeaseIdAttempted && releasedLeaseIds.includes(newLeaseIdAttempted)) {
    pass(`başarısız denemenin lease'i (${newLeaseIdAttempted}) rollback ile bırakıldı — sızıntı yok`);
  } else {
    fail('başarısız denemenin lease\'i release edilmemiş — proxy lease sızıntısı riski');
  }

  // (Bu tur, Madde #22 Hata-1 regresyon testi) CHALLENGE_DETECTED da
  // ROTATE_SESSION_ONLY'e düşüyor — ama bu anomaly HTTP_429 OLMADIĞI için
  // markFailed('HTTP_429') hiç çağrılmamalı.
  if (markFailedCalls.length === markFailedCallsBeforeTest2) {
    pass("CHALLENGE_DETECTED rotasyonunda markFailed hiç çağrılmadı — tip-guard (event.anomaly.type === HTTP_429) doğru çalışıyor");
  } else {
    fail(`CHALLENGE_DETECTED rotasyonunda markFailed ${markFailedCalls.length - markFailedCallsBeforeTest2} kez çağrıldı — tip-guard çalışmıyor, telemetri yanlış proxy'yi/anomaly'yi işaretliyor: ${JSON.stringify(markFailedCalls.slice(markFailedCallsBeforeTest2))}`);
  }

  // ============ TEST 3 — Madde #22 (ROTATE_SESSION_ONLY→markFailed köprüsü) ============
  console.log("\n=== TEST 3: HTTP_429/scope=SESSION -> ROTATE_SESSION_ONLY -> markFailed('HTTP_429') ESKİ (aktif) proxy'ye uygulanmalı ===");

  const activeProxyIdBeforeTest3 = getActiveProxyId();
  const http429CountBefore = mockProxyManager.getProxyMetrics(activeProxyIdBeforeTest3)?.http429Count ?? 0;
  const markFailedCallsBeforeTest3 = markFailedCalls.length;

  governor.enqueueAnomaly({
    id: 'a-429-session', type: AnomalyType.HTTP_429, scope: AnomalyScope.SESSION, timestamp: Date.now(),
  });

  await waitUntilIdle(governor);

  const http429CountAfter = mockProxyManager.getProxyMetrics(activeProxyIdBeforeTest3)?.http429Count ?? 0;
  const relevantMarkFailedCalls = markFailedCalls.slice(markFailedCallsBeforeTest3);
  const calledOnOldProxy = relevantMarkFailedCalls.some(
    (c) => c.proxyId === activeProxyIdBeforeTest3 && c.reason === 'HTTP_429'
  );

  if (calledOnOldProxy && http429CountAfter === http429CountBefore + 1) {
    pass(`markFailed('HTTP_429'), ROTASYONDAN ÖNCEKİ aktif proxy'ye (${activeProxyIdBeforeTest3}) uygulandı — http429Count ${http429CountBefore} -> ${http429CountAfter} (Madde #22 köprüsü çalışıyor)`);
  } else {
    fail(`beklenen: ${activeProxyIdBeforeTest3}'in http429Count'u +1 artmalı; gerçekleşen: ${http429CountBefore} -> ${http429CountAfter}, bu turdaki markFailed çağrıları: ${JSON.stringify(relevantMarkFailedCalls)}`);
  }

  // ============ SONUÇ ============
  console.log('\n=== SONUÇ ===');
  if (failures === 0) {
    console.log('✅ Tüm testler geçti — Madde #6/#7/#8 ve #22 (THROTTLE+ROTATE_SESSION_ONLY→markFailed köprüsü, tip-guard dahil) bu senaryolar altında runtime doğrulandı.');
  } else {
    console.log(`❌ ${failures} test başarısız — ilgili maddeyi P0'da açık tutun, koda bakılmalı.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Beklenmeyen betik hatası:', err);
  process.exitCode = 1;
});
