// runtime-check-observer.ts
// Amaç: Madde #33 (TAM KAPANIŞ) — PlaywrightPageObserver'ın crash/requestfailed
// event'lerini artık IStateObserver'ın 'anomaly' kanalından, doğru tipte
// (PROCESS_CRASHED / NETWORK_ERROR) yayınladığını doğrular. Gerçek bir
// Playwright Page'e ihtiyaç yok — sadece .on/.off/.request() gibi kullanılan
// yüzeyi taklit eden minimal bir sahte (fake) nesne kullanılıyor.
//
// Çalıştırma: npx tsx runtime-check-observer.ts

import { PlaywrightPageObserver } from './src/adapters/PlaywrightPageObserver';
import type { AnomalyPayload } from './src/adapters/IStateObserver';

let passCount = 0;
let failCount = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`PASS: ${name}`);
    passCount++;
  } else {
    console.log(`FAIL: ${name}`);
    failCount++;
  }
}

// --- Sahte (fake) Playwright Page ---
// Sadece bu testte kullanılan yüzeyi taklit eder: on/off ile event kaydı,
// crash/requestfailed/response için elle emit edilebilen bir mekanizma.
type Listener = (...args: any[]) => void;

class FakePage {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, handler: Listener): void {
    (this.listeners[event] ??= []).push(handler);
  }

  off(event: string, handler: Listener): void {
    const arr = this.listeners[event];
    if (!arr) return;
    const idx = arr.indexOf(handler);
    if (idx !== -1) arr.splice(idx, 1);
  }

  emit(event: string, payload?: unknown): void {
    for (const handler of this.listeners[event] ?? []) {
      handler(payload);
    }
  }
}

function fakeFailedRequest(url: string, errorText: string) {
  return {
    url: () => url,
    failure: () => ({ errorText })
  };
}

async function main() {
  // TEST 1: crash → PROCESS_CRASHED
  {
    const page = new FakePage();
    const observer = new PlaywrightPageObserver(page as any);
    let received: AnomalyPayload | undefined;
    observer.on('anomaly', (p) => { received = p; });
    observer.start();

    page.emit('crash');

    check(
      'TEST 1 — crash → PROCESS_CRASHED emit edildi',
      received?.type === 'PROCESS_CRASHED'
    );
  }

  // TEST 2: requestfailed (net::ERR_...) → NETWORK_ERROR, rawError doğru taşınıyor
  {
    const page = new FakePage();
    const observer = new PlaywrightPageObserver(page as any);
    let received: AnomalyPayload | undefined;
    observer.on('anomaly', (p) => { received = p; });
    observer.start();

    page.emit('requestfailed', fakeFailedRequest('https://example.com/x', 'net::ERR_CONNECTION_RESET'));

    check(
      'TEST 2 — net::ERR_ hatası → NETWORK_ERROR emit edildi',
      received?.type === 'NETWORK_ERROR'
    );
    check(
      'TEST 2b — rawError doğru taşınıyor',
      received?.details?.rawError === 'net::ERR_CONNECTION_RESET'
    );
    check(
      'TEST 2c — sourceUrl doğru taşınıyor',
      received?.details?.sourceUrl === 'https://example.com/x'
    );
  }

  // TEST 3: requestfailed (filtre dışı hata) → HİÇBİR anomaly emit EDİLMEMELİ
  {
    const page = new FakePage();
    const observer = new PlaywrightPageObserver(page as any);
    let received: AnomalyPayload | undefined;
    observer.on('anomaly', (p) => { received = p; });
    observer.start();

    page.emit('requestfailed', fakeFailedRequest('https://example.com/y', 'net::ERR_ABORTED_BY_USER_UNRELATED'));
    // Not: bu hata metni de 'net::ERR_' içeriyor, bu yüzden AYRI bir test
    // olarak filtre dışı bir örnek kullanıyoruz:
    const page2 = new FakePage();
    const observer2 = new PlaywrightPageObserver(page2 as any);
    let received2: AnomalyPayload | undefined;
    observer2.on('anomaly', (p) => { received2 = p; });
    observer2.start();
    page2.emit('requestfailed', fakeFailedRequest('https://example.com/z', 'CANCELLED'));

    check(
      'TEST 3 — filtre dışı hata (ne net::ERR_ ne DNS içeriyor) → emit EDİLMEDİ',
      received2 === undefined
    );
  }

  // TEST 4: stop() sonrası crash artık dinlenmiyor
  {
    const page = new FakePage();
    const observer = new PlaywrightPageObserver(page as any);
    let callCount = 0;
    observer.on('anomaly', () => { callCount++; });
    observer.start();
    observer.stop();

    page.emit('crash');

    check(
      'TEST 4 — stop() sonrası crash artık anomaly ÜRETMİYOR',
      callCount === 0
    );
  }

  console.log(`\n${passCount} PASS, ${failCount} FAIL`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
