// runtime-check-logger.ts
// Amaç: Madde #15 (structured logging) doğrulaması.
//
// EDGE CASE LİSTESİ (Kod Kalitesi Kural #3 — kod öncesi):
//  1. Her 4 seviye (debug/info/warn/error) doğru console.* metoduna gidiyor mu?
//  2. meta içinde level/component/message ile ÇAKIŞAN bir anahtar varsa,
//     entry'nin kendi (gerçek) değerleri mi kazanıyor, meta mı eziyor?
//  3. meta circular reference içeriyorsa throw ETMEDEN, metaSerializationError:true
//     ile devam ediyor mu (message/component/level kaybolmuyor mu)?
//  4. meta hiç verilmezse entry sadece level/component/message içeriyor mu
//     (undefined/garbage alan sızmıyor mu)?
//  5. ProxyHealthStore.save() hata senaryosunda RAW console DEĞİL, enjekte
//     edilen logger çağrılıyor mu (ve doğru message/meta ile)?
//  6. PersistentStateEngine, enjekte edilen logger'ı kırmadan constructor'da
//     kabul ediyor mu (bkz. dosya sonundaki not — bu tur DAR kapsamlı).

import { ConsoleJsonLogger } from './src/telemetry/ConsoleJsonLogger';
import { ProxyHealthStore } from './src/state/ProxyHealthStore';
import type { ILogger, LogMeta } from './src/telemetry/ILogger';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS - ${label}`);
  } else {
    failures++;
    console.log(`FAIL - ${label}`);
  }
}

// Ortak yardımcı: console.* çağrılarını yakalamak için geçici override.
function captureConsole(fn: () => void): { debug: string[]; info: string[]; warn: string[]; error: string[] } {
  const captured = { debug: [] as string[], info: [] as string[], warn: [] as string[], error: [] as string[] };
  const original = {
    debug: console.debug,
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.debug = (line: string) => captured.debug.push(line);
  console.log = (line: string) => captured.info.push(line);
  console.warn = (line: string) => captured.warn.push(line);
  console.error = (line: string) => captured.error.push(line);

  try {
    fn();
  } finally {
    console.debug = original.debug;
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }

  return captured;
}

// ---- TEST 1: 4 seviye doğru console.* metoduna gidiyor mu ----
{
  const logger = new ConsoleJsonLogger('TestComponent');
  const captured = captureConsole(() => {
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
  });

  assert(
    captured.debug.length === 1 && captured.info.length === 1 && captured.warn.length === 1 && captured.error.length === 1,
    'TEST 1: her seviye doğru console.* metoduna gidiyor'
  );

  const parsed = JSON.parse(captured.info[0]);
  assert(
    parsed.level === 'info' && parsed.component === 'TestComponent' && parsed.message === 'info msg',
    'TEST 1: JSON şekli (level/component/message) doğru'
  );
}

// ---- TEST 2: reserved-key çakışması meta tarafından ezilemiyor ----
{
  const logger = new ConsoleJsonLogger('RealComponent');
  const captured = captureConsole(() => {
    logger.error('gerçek mesaj', { level: 'FAKE', component: 'FAKE', message: 'FAKE', extra: 'kept' } as LogMeta);
  });
  const parsed = JSON.parse(captured.error[0]);
  assert(
    parsed.level === 'error' && parsed.component === 'RealComponent' && parsed.message === 'gerçek mesaj' && parsed.extra === 'kept',
    'TEST 2: meta, level/component/message alanlarını EZEMİYOR (extra alan korunuyor)'
  );
}

// ---- TEST 3: circular meta throw etmeden güvenli düşüyor ----
{
  const logger = new ConsoleJsonLogger('CircularTest');
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  let threw = false;
  let captured: ReturnType<typeof captureConsole> | undefined;
  try {
    captured = captureConsole(() => {
      logger.error('circular meta mesajı', circular as LogMeta);
    });
  } catch {
    threw = true;
  }

  assert(!threw, 'TEST 3: circular meta throw ETMİYOR');
  if (captured) {
    const parsed = JSON.parse(captured.error[0]);
    assert(
      parsed.metaSerializationError === true && parsed.message === 'circular meta mesajı',
      'TEST 3: metaSerializationError:true ile devam ediyor, message kaybolmuyor'
    );
  }
}

// ---- TEST 4: meta verilmediğinde ekstra alan sızmıyor ----
{
  const logger = new ConsoleJsonLogger('NoMetaTest');
  const captured = captureConsole(() => {
    logger.warn('meta yok');
  });
  const parsed = JSON.parse(captured.warn[0]);
  const keys = Object.keys(parsed).sort();
  assert(
    JSON.stringify(keys) === JSON.stringify(['component', 'level', 'message']),
    'TEST 4: meta verilmediğinde sadece level/component/message var'
  );
}

// ---- TEST 5: ProxyHealthStore, RAW console DEĞİL enjekte edilen logger'ı kullanıyor ----
{
  const calls: Array<{ message: string; meta?: LogMeta }> = [];
  const spyLogger: ILogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (message: string, meta?: LogMeta) => calls.push({ message, meta }),
  };

  // Geçersiz dbPath (var olmayan dizin) — constructor'ın kendisi zaten
  // Database(dbPath) açarken patlayabilir; bu yüzden bilinçli olarak
  // save() SONRASI bir hata senaryosu için db.close() ile bağlantıyı
  // önceden kapatıp save()'in INSERT sırasında patlamasını tetikliyoruz —
  // ProxyHealthStore'un kendi "best-effort" sözleşmesini (throw etmemeli)
  // ayrıca doğrulamış oluyoruz.
  const store = new ProxyHealthStore(':memory:', spyLogger);
  store.close(); // bağlantı artık kapalı — sıradaki save() İSTİSNA ile hata verecek

  let threw = false;
  const captured = captureConsole(() => {
    try {
      store.save({
        server: 'proxy-test:8080',
        latencyMs: 10,
        dnsFailures: 0,
        tlsFailures: 0,
        http403Count: 0,
        http429Count: 0,
        successCount: 0,
        failureCount: 1,
        lastUsed: Date.now(),
        quarantineUntil: Date.now() + 1000,
      });
    } catch {
      threw = true;
    }
  });

  assert(!threw, 'TEST 5: save() best-effort — DB kapalıyken bile throw ETMİYOR');
  assert(
    captured.error.length === 0,
    'TEST 5: RAW console.error ÇAĞRILMADI (artık enjekte edilen logger kullanılıyor)'
  );
  assert(
    calls.length === 1 && calls[0].message.includes('health kaydı yazılamadı') && calls[0].meta?.server === 'proxy-test:8080',
    'TEST 5: enjekte edilen logger doğru message + meta (server) ile çağrıldı'
  );
}

console.log(`\n${failures === 0 ? 'TÜMÜ PASS' : `${failures} FAIL`}`);
process.exitCode = failures === 0 ? 0 : 1;

// ---- TEST 6 NOTU (bu turun DAR kapsamı) ----
// PersistentStateEngine'in enjekte edilen logger'ı GERÇEK bir recovery
// akışında (örn. metrics-null uyarı yolu) kullandığını uçtan uca doğrulamak,
// PlaywrightPageObserver'ın page.on(...) yüzeyini taklit eden bir mock Page
// gerektiriyor — bu sınıfın tam iç sözleşmesi bu turda görülmedi (sadece
// import edildiği biliniyor). Sahte/eksik bir mock ile "PASS" iddia etmek
// Kural #4'ün (sahte veri yasağı) ihlali olurdu. Bu yüzden TEST 6 bu dosyaya
// EKLENMEDİ — `npx tsc --noEmit` derleme kontrolü constructor imzasının
// (yeni opsiyonel 5. parametre) geriye dönük uyumlu olduğunu doğrulayacak;
// tam akış testi, PlaywrightPageObserver.ts görüldükten sonra ayrı bir
// KARAR BİLDİRİMİ ile eklenmeli.
