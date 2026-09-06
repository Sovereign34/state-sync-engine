// runtime-check-madde9.ts
// Amaç:    Madde #9 (state restore validation) + aynı turda bulunan
//          re-entrancy fix'inin (queueMicrotask ile enqueueAnomaly ertelemesi)
//          gerçek PersistentStateEngine/AdaptiveGovernor koduna karşı,
//          mock Browser + mock AuthValidationPort + mock AdvancedProxyManager
//          ile izole runtime doğrulaması.
// Katman:  test (geçici doğrulama betiği — Madde 30/31 kapsamına girmez,
//          kalıcı test piramidi ayrı bir konu)
// Risk:    Bu script'in KENDİSİ hatalıysa (örn. flush yetersizse) sahte bir
//          "✅ Tüm testler geçti" üretebilir — bu yüzden her assert ayrı
//          raporlanıyor, failures===0 olmadan sonuç satırı basılmıyor.
// Dokunma: src/engine/PersistentStateEngine.ts (handleGovernorDecision,
//          createSessionWithFreshState), src/engine/AdaptiveGovernor.ts
//          (enqueueAnomaly/processQueue/evaluatePolicy), src/types (AnomalyType,
//          GovernorAction, AuthValidationPort, ProxyLease, ProxyMetrics).
//
// KAPSAM SINIRI: Gerçek Playwright navigasyonu (page.goto(validationUrl))
// veya gerçek proxy altyapısı test EDİLMİYOR — sadece Governor/Engine arası
// sıralama, rollback ve re-entrancy mantığı mock'larla izole doğrulanıyor.
// "Tam entegrasyon test edildi" iddia edilmiyor.

import { PersistentStateEngine } from './src/engine/PersistentStateEngine';
import { AdaptiveGovernor } from './src/engine/AdaptiveGovernor';
import {
  GovernorAction,
  AnomalyType,
  AnomalyScope,
  ProxyLease,
  ProxyMetrics,
  AuthValidationPort,
  PreservedSessionState,
} from './src/types';
import type { AdvancedProxyManager } from './src/network/AdvancedProxyManager';
import type { Browser, BrowserContext, Page } from 'playwright';

// ---------------------------------------------------------------------------
// Basit assert altyapısı — failures===0 olmadan sonuç satırı basılmaz.
// ---------------------------------------------------------------------------
let failures = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ BAŞARISIZ: ${label}`);
  }
}

async function flushAsync(times = 30): Promise<void> {
  // Mock I/O tamamen Promise.resolve tabanlı ve senkron olduğu için birkaç
  // event-loop turu, en derin await zincirini (enqueue → processQueue →
  // emitDecisionAndWait → handleDecision → createSessionWithFreshState →
  // acquireProxy/newContext/newPage/applyState/commit/close) tüketmeye yeter.
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

// ---------------------------------------------------------------------------
// Mock Page / BrowserContext / Browser
// ---------------------------------------------------------------------------
let pageCounter = 0;
let contextCounter = 0;

function makeMockPage(): Page & { __id: number } {
  const id = ++pageCounter;
  const page = {
    __id: id,
    evaluate: async (_fn: unknown, ..._args: unknown[]) => ({ ls: {}, ss: {} }),
    addInitScript: async (_fn: unknown, _arg: unknown) => {},
    on: (_event: string, _handler: unknown) => page,
    close: async () => {},
  };
  return page as unknown as Page & { __id: number };
}

function makeMockContext(): BrowserContext & { __id: number; closed: boolean } {
  const id = ++contextCounter;
  const ctx = {
    __id: id,
    closed: false,
    cookies: async () => [] as never[],
    addCookies: async (_cookies: unknown[]) => {},
    newPage: async () => makeMockPage(),
    close: async () => {
      ctx.closed = true;
    },
  };
  return ctx as unknown as BrowserContext & { __id: number; closed: boolean };
}

function makeMockBrowser(): Browser {
  return {
    newContext: async (_opts: unknown) => makeMockContext(),
  } as unknown as Browser;
}

// ---------------------------------------------------------------------------
// Mock AdvancedProxyManager — sadece PersistentStateEngine'in tükettiği 4
// metod (acquireProxy/releaseProxy/markFailed/getProxyMetrics).
// ---------------------------------------------------------------------------
function makeMockProxyManager() {
  let leaseCounter = 0;
  const activeLeaseIds = new Set<string>();
  const releasedLeaseIds: string[] = [];
  const markFailedCalls: Array<{ proxyId: string; reason: string }> = [];
  const acquireCalls: ProxyLease[] = [];

  const manager = {
    acquireProxy: (sessionId: string): ProxyLease => {
      leaseCounter++;
      const lease: ProxyLease = {
        leaseId: `lease-${leaseCounter}`,
        proxyId: `proxy-${leaseCounter}`,
        sessionId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      };
      activeLeaseIds.add(lease.leaseId);
      acquireCalls.push(lease);
      return lease;
    },
    releaseProxy: (leaseId: string): void => {
      activeLeaseIds.delete(leaseId);
      releasedLeaseIds.push(leaseId);
    },
    markFailed: (proxyId: string, reason: string): void => {
      markFailedCalls.push({ proxyId, reason });
    },
    getProxyMetrics: (proxyId: string): ProxyMetrics | undefined => {
      const metrics: ProxyMetrics = {
        server: `http://${proxyId}.example`,
        username: 'mock-user',
        password: 'mock-pass',
        latencyMs: 10,
        dnsFailures: 0,
        tlsFailures: 0,
        http403Count: 0,
        http429Count: 0,
        successCount: 0,
        failureCount: 0,
        lastUsed: Date.now(),
        quarantineUntil: 0,
      };
      return metrics;
    },
  };

  return {
    manager: manager as unknown as AdvancedProxyManager,
    activeLeaseIds,
    releasedLeaseIds,
    markFailedCalls,
    acquireCalls,
  };
}

// ---------------------------------------------------------------------------
// Mock AuthValidationPort
// ---------------------------------------------------------------------------
function makeMockAuthValidator(initialResult: boolean) {
  let result = initialResult;
  let callCount = 0;
  const seenStates: PreservedSessionState[] = [];

  const validator: AuthValidationPort = {
    validate: async (_page, state) => {
      callCount++;
      seenStates.push(state);
      return result;
    },
  };

  return {
    validator,
    setResult: (v: boolean) => {
      result = v;
    },
    getCallCount: () => callCount,
  };
}

function makeAnomaly(type: AnomalyType, scope: AnomalyScope) {
  return {
    id: Math.random().toString(36).substring(7),
    type,
    scope,
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// SENARYO A — authValidator.validate() = false
// Beklenen: AuthRestoreFailedError fırlar → eski context/lease DEĞİŞMEZ
// (rollback) → catch, AUTH_VALIDATION_FAILED'i queueMicrotask ile enqueue
// eder → bu, finally'den (isRecovering=false) SONRA işlenir → evaluatePolicy
// bunu FULL_RECOVERY'ye yönlendirir → preserve=false ile yeni session kurulur
// → validate() BİR DAHA çağrılmaz (call count 1'de kalır — ikinci bir
// AuthRestoreFailedError / sonsuz döngü YOK) → yeni session COMMIT edilir.
// ---------------------------------------------------------------------------
async function senaryoA(): Promise<void> {
  console.log('\n[Senaryo A] validate=false → rollback + re-entrancy olmadan FULL_RECOVERY');

  const browser = makeMockBrowser();
  const proxy = makeMockProxyManager();
  const auth = makeMockAuthValidator(false);
  const governor = new AdaptiveGovernor();
  const engine = new PersistentStateEngine(browser, proxy.manager, governor, auth.validator);

  await engine.initialize(); // preserve=false — validate() çağrılmaz
  assert(auth.getCallCount() === 0, 'initialize() preserve=false olduğu için validate() hiç çağrılmadı');

  const contextBefore = engine.getContext();
  const leaseCountBefore = proxy.acquireCalls.length;
  assert(leaseCountBefore === 1, 'initialize() sonrası tam olarak 1 lease alındı');

  // ROTATE_SESSION_ONLY kararını doğrudan RecoveryCommandPort arayüzü
  // üzerinden tetikliyoruz (evaluatePolicy eşlemesi bu testin odağı değil,
  // odağımız handleGovernorDecision'ın catch/rollback/re-entrancy davranışı).
  await engine.handleDecision({
    anomaly: makeAnomaly(AnomalyType.HTTP_429, AnomalyScope.SESSION),
    action: GovernorAction.ROTATE_SESSION_ONLY,
  });

  assert(auth.getCallCount() === 1, 'preserve=true denemesinde validate() tam 1 kez çağrıldı');
  assert(engine.getContext() === contextBefore, 'ROLLBACK: validate=false sonrası eski context DEĞİŞMEDİ');
  // NOT: burada "acquireCalls.length === 2" gibi kesin bir sayı BEKLENEMEZ —
  // queueMicrotask ile ertelenen FULL_RECOVERY zinciri, bu satır çalışana
  // kadar zaten kendi acquireProxy()'sini tetiklemiş olabilir (iki zincir
  // awaitlenmeden interleave oluyor, bu race değil çünkü hangi lease'in
  // hangi denemeye ait olduğu index'e göre sabit — sadece "ne zaman"
  // belirsiz). Bu yüzden index bazlı (acquireCalls[1] = başarısız deneme)
  // kontrol ediyoruz, toplam sayıyı değil.
  assert(
    proxy.acquireCalls.length >= 2 && proxy.releasedLeaseIds.includes(proxy.acquireCalls[1].leaseId),
    'ROLLBACK: başarısız denemenin (2. lease) release edildiği doğrulandı, sızıntı yok'
  );
  assert(
    proxy.activeLeaseIds.has(proxy.acquireCalls[0].leaseId),
    'ROLLBACK: orijinal (ilk) lease hâlâ aktif — eski oturuma dokunulmadı'
  );

  // handleGovernorDecision'ın catch'i queueMicrotask ile AUTH_VALIDATION_FAILED
  // enqueue etti — bu, governor.processQueue → evaluatePolicy → FULL_RECOVERY
  // → commandPort.handleDecision zincirini tetikler. Bu zincirin (yeni
  // context/proxy/commit) tamamlanmasını bekliyoruz.
  await flushAsync();

  assert(
    auth.getCallCount() === 1,
    'RE-ENTRANCY FIX KANITI: flush sonrası validate() HÂLÂ sadece 1 kez çağrılmış ' +
      '(FULL_RECOVERY preserve=false ile geçti, ikinci AuthRestoreFailedError / sonsuz döngü yok)'
  );
  assert(
    engine.getContext() !== contextBefore,
    'FULL_RECOVERY COMMIT edildi: context artık eski context\'ten farklı ' +
      '(guard tarafından sessizce yutulmadığının kanıtı — fix çalışıyor)'
  );
  assert(
    proxy.releasedLeaseIds.includes(proxy.acquireCalls[0].leaseId),
    'FULL_RECOVERY COMMIT sonrası eski (ilk) lease release edildi'
  );
  assert(proxy.acquireCalls.length === 3, 'FULL_RECOVERY için 3. lease alındı (toplam 3 acquireProxy çağrısı)');
  assert(governor.getQueueSize() === 0, 'Governor kuyruğu boşaldı');
}

// ---------------------------------------------------------------------------
// SENARYO B — authValidator.validate() = true
// Beklenen: normal COMMIT çalışmaya devam ediyor, validate() preserve=true
// akışında tam olarak 1 kez çağrılıyor, hiçbir anomaly enqueue edilmiyor.
// ---------------------------------------------------------------------------
async function senaryoB(): Promise<void> {
  console.log('\n[Senaryo B] validate=true → normal COMMIT, validate() tam 1 kez');

  const browser = makeMockBrowser();
  const proxy = makeMockProxyManager();
  const auth = makeMockAuthValidator(true);
  const governor = new AdaptiveGovernor();
  const engine = new PersistentStateEngine(browser, proxy.manager, governor, auth.validator);

  await engine.initialize();
  const contextBefore = engine.getContext();

  await engine.handleDecision({
    anomaly: makeAnomaly(AnomalyType.HTTP_429, AnomalyScope.SESSION),
    action: GovernorAction.ROTATE_SESSION_ONLY,
  });

  await flushAsync();

  assert(auth.getCallCount() === 1, 'validate() preserve=true akışında tam olarak 1 kez çağrıldı');
  assert(engine.getContext() !== contextBefore, 'COMMIT başarıyla gerçekleşti, context değişti');
  assert(
    proxy.releasedLeaseIds.includes(proxy.acquireCalls[0].leaseId),
    'Eski lease normal COMMIT akışında release edildi'
  );
  assert(governor.getQueueSize() === 0, 'Hiçbir ek anomaly enqueue edilmedi (queue boş)');
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  await senaryoA();
  await senaryoB();

  console.log('');
  if (failures === 0) {
    console.log('✅ Tüm testler geçti');
  } else {
    console.error(`❌ ${failures} test başarısız oldu`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('[runtime-check-madde9] beklenmeyen hata:', err);
  process.exitCode = 1;
});
