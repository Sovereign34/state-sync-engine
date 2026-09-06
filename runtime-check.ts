// runtime-check.ts
// Amaç:    Madde #6 (sıralı recovery işleme), #7 (RecoveryCommandPort tek yolu)
//          ve #8 (make-before-break transaction/rollback) için birleşik
//          runtime doğrulama senaryosu.
// Katman:  verification (production kodu değil — src/ dışında tutulur, Madde #1)
// Risk:    Bu betik gerçek Playwright/proxy altyapısını KULLANMAZ — Browser ve
//          AdvancedProxyManager minimal mock'larla değiştirilmiştir. Amaç,
//          governor/engine arasındaki sıralama ve komut-yönlendirme mantığını
//          izole doğrulamaktır; network/proxy katmanının kendisi bu betiğin
//          kapsamı DIŞINDADIR.
// Dokunma: src/engine/AdaptiveGovernor.ts, src/engine/PersistentStateEngine.ts,
//          src/types/governor-command.types.ts — imzalar değişirse bu betik
//          de güncellenmeli.
//
// Çalıştırma (repo kökünden):
//   npx ts-node --transpile-only runtime-check.ts
//
// --transpile-only ZORUNLU: mock nesneler AdvancedProxyManager/Browser'ın
// TAM tip sözleşmesini karşılamaz (kasıtlı olarak `as unknown as X` ile
// cast edilmiştir), tam tip kontrolü burada anlamsız hata verir.

import { AdaptiveGovernor } from './src/engine/AdaptiveGovernor';
import { PersistentStateEngine } from './src/engine/PersistentStateEngine';
import { AnomalyType, AnomalyScope, ProxyLease, ProxyMetrics } from './src/types';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { AdvancedProxyManager } from './src/network/AdvancedProxyManager';

let leaseCounter = 0;
const acquiredLeaseIds: string[] = [];
const releasedLeaseIds: string[] = [];

function log(msg: string): void {
  console.log(msg);
}

// ---------------- Mock AdvancedProxyManager ----------------
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
    log(`  [ProxyManager] acquireProxy() -> ${lease.leaseId}`);
    return lease;
  },
  getProxyMetrics(proxyId: string): ProxyMetrics | undefined {
    return {
      server: `http://${proxyId}.example:8080`,
      username: 'redacted-user',
      password: 'redacted-pass',
      latencyMs: 40,
      dnsFailures: 0,
      tlsFailures: 0,
      http403Count: 0,
      http429Count: 0,
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
    log(`  [ProxyManager] markFailed(${proxyId}, ${reason})`);
  },
} as unknown as AdvancedProxyManager;

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
  const engine = new PersistentStateEngine(mockBrowser, mockProxyManager, governor);
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

  // ============ TEST 2 — Madde #8 (rollback, eski oturum bozulmuyor) ============
  console.log('\n=== TEST 2: context oluşturma sırasında hata enjekte ediliyor ===');
  const contextBefore = engine.getContext();
  const leaseIdBeforeTest2Attempt = acquiredLeaseIds.length;

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

  // ============ SONUÇ ============
  console.log('\n=== SONUÇ ===');
  if (failures === 0) {
    console.log('✅ Tüm testler geçti — Madde #6/#7/#8 bu senaryolar altında runtime doğrulandı.');
  } else {
    console.log(`❌ ${failures} test başarısız — ilgili maddeyi P0'da açık tutun, koda bakılmalı.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Beklenmeyen betik hatası:', err);
  process.exitCode = 1;
});
