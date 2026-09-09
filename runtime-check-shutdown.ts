// (Yeni — Madde #25) İzole runtime-check: createShutdownController'ın guard
// mantığını gerçek Playwright/process.exit olmadan test eder. Proje
// konvansiyonuna uyar (runtime-check-observer.ts, runtime-check-logger.ts ile
// aynı desen) — dummy ILogger + mock disposeEngine/exit ile TEST N/PASS-FAIL
// satırları basar, process.exitCode ile sonucu bildirir.
import { createShutdownController } from './src/index';
import type { ILogger, LogMeta } from './src/telemetry/ILogger';

let failed = false;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`PASS: ${message}`);
  } else {
    failed = true;
    console.error(`FAIL: ${message}`);
  }
}

class RecordingLogger implements ILogger {
  public warnCalls: Array<{ message: string; meta?: LogMeta }> = [];
  public infoCalls: Array<{ message: string; meta?: LogMeta }> = [];
  debug(_message: string, _meta?: LogMeta): void {}
  info(message: string, meta?: LogMeta): void {
    this.infoCalls.push({ message, meta });
  }
  warn(message: string, meta?: LogMeta): void {
    this.warnCalls.push({ message, meta });
  }
  error(_message: string, _meta?: LogMeta): void {}
}

async function testFirstShutdownDisposesOnce(): Promise<void> {
  const logger = new RecordingLogger();
  let disposeCalls = 0;
  let exitCode: number | undefined;
  const controller = createShutdownController(
    async () => {
      disposeCalls += 1;
    },
    (code) => {
      exitCode = code;
    }
  );

  await controller.shutdown('SIGTERM', logger);

  assert(disposeCalls === 1, 'TEST 1 — ilk shutdown() disposeEngine\'i tam bir kez çağırır');
  assert(exitCode === 0, 'TEST 1 — ilk shutdown() exit(0) çağırır');
  assert(controller.isDisposed(), 'TEST 1 — shutdown() sonrası isDisposed() true döner');
  assert(
    logger.warnCalls.some((c) => c.message.includes('SIGTERM')),
    'TEST 1 — shutdown() SIGTERM uyarı logu basar'
  );
}

async function testDoubleSignalIsNoOp(): Promise<void> {
  const logger = new RecordingLogger();
  let disposeCalls = 0;
  const controller = createShutdownController(
    async () => {
      disposeCalls += 1;
    },
    () => {}
  );

  await controller.shutdown('SIGTERM', logger);
  await controller.shutdown('SIGINT', logger); // çift sinyal simülasyonu

  assert(
    disposeCalls === 1,
    'TEST 2 — ikinci sinyal (SIGINT) disposeEngine\'i TEKRAR çağırmaz (idempotent)'
  );
}

async function testNormalFlowMarksDisposedBeforeSignal(): Promise<void> {
  const logger = new RecordingLogger();
  let disposeCalls = 0;
  const controller = createShutdownController(
    async () => {
      disposeCalls += 1;
    },
    () => {}
  );

  // normal akış (30sn bekleme sonu) kendi dispose'unu yapıp guard'ı
  // senkronize eder — main-entry'deki `controller.markDisposed()` çağrısını
  // simüle ediyor.
  controller.markDisposed();

  // ...sonra bir sinyal gelirse (örn. process zaten kapanma sürecindeyken):
  await controller.shutdown('SIGTERM', logger);

  assert(
    disposeCalls === 0,
    'TEST 3 — markDisposed() sonrası gelen bir sinyal disposeEngine\'i hiç çağırmaz'
  );
  assert(
    logger.warnCalls.length === 0,
    'TEST 3 — markDisposed() sonrası gelen sinyal için uyarı logu basılmaz (zaten no-op)'
  );
}

async function testDefaultExitIsProcessExit(): Promise<void> {
  // exit parametresi verilmezse varsayılan process.exit kullanılıyor mu —
  // gerçekten çağırmadan, sadece controller'ın 3. argüman olmadan
  // oluşturulabildiğini (tip hatası vermediğini) doğruluyoruz.
  const controller = createShutdownController(async () => {});
  assert(
    typeof controller.shutdown === 'function',
    'TEST 4 — exit parametresi verilmeden de controller oluşturulabiliyor (varsayılan process.exit)'
  );
}

(async () => {
  await testFirstShutdownDisposesOnce();
  await testDoubleSignalIsNoOp();
  await testNormalFlowMarksDisposedBeforeSignal();
  await testDefaultExitIsProcessExit();

  if (failed) {
    console.error('\nSONUÇ: EN AZ BİR TEST FAIL — Madde #25 kapanamaz.');
    process.exitCode = 1;
  } else {
    console.log('\nSONUÇ: 4/4 PASS');
  }
})();
