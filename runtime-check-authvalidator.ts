// runtime-check-authvalidator.ts
// Amaç:    `authValidator` wiring'inin (bu session'ın konusu — index.ts'teki
//          composition-root fix'i) runtime doğrulaması. tsc --noEmit zaten
//          "0 hata" verdi ama bu sadece derleme — DefaultAuthValidator'ın
//          GERÇEKTEN doğru çalıştığını (authenticate olmamış bir restore'u
//          sessizce "geçerli" saymadığını) kanıtlamaz.
// Katman:  adapters (test)
// Risk:    Bu sadece bir doğrulama betiği, production kodunu etkilemez.
//          Test SADECE negatif senaryoyu (cookie yok → false) kapsıyor —
//          pozitif senaryo (gerçek authenticate cookie'leriyle → true)
//          kullanıcı kararıyla bu turda dışarıda bırakıldı, ayrı ele alınacak.
// Dokunma: DefaultAuthValidator.ts (validate() metodunun gerçek davranışı),
//          index.ts (composition-root'taki validationUrl/unauthenticatedUrlPatterns
//          ile burada kullanılanlar AYNI olmalı — burada TEKRAR yazıldı çünkü
//          index.ts'i import etmek chromium.launch() + tüm EngineFactory
//          zincirini (proxy dahil) tetikler, bu test sadece DefaultAuthValidator'ı
//          izole etmek istiyor).

import { chromium } from 'playwright';
import { DefaultAuthValidator } from './src/adapters/DefaultAuthValidator';

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failures++;
    console.error(`❌ BAŞARISIZ: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

(async () => {
  // AÇIK NOKTA: aşağıdaki değerler kullanıcının verdiği gerçek değerler —
  // index.ts'teki composition-root'ta bunlar production'a alınmadan önce
  // demo bloğundaki TODO placeholder'ların YERİNE gerçekten yazılmalı.
  const validator = new DefaultAuthValidator(
    'https://app.hedef-portal.com/dashboard',
    ['/login', '/auth/signin'],
    15000
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext(); // kasıtlı olarak BOŞ — hiç cookie yok
  const page = await context.newPage();

  console.log('--- Test 1: hiç cookie YOK, gerçek validationUrl\'e gidiliyor ---');
  console.log('Beklenti: unauthenticated redirect (/login veya /auth/signin) tetiklenir, validate() FALSE döner.\n');

  const emptyState = { cookies: [], localStorage: {}, sessionStorage: {} };
  const result = await validator.validate(page, emptyState);

  assert(
    result === false,
    `validate() cookie'siz durumda FALSE döndü (gerçek dönen değer: ${result})`
  );

  if (result === true) {
    console.error(
      '\n⚠️ KRİTİK: validate() cookie olmadan TRUE döndü. Bu, unauthenticatedUrlPatterns\n' +
      '   yanlış yapılandırılmış olabileceği anlamına gelir (örn. dashboard sayfası login\n' +
      "   redirect'i olmadan doğrudan render ediliyor olabilir, ya da pattern'ler gerçek\n" +
      '   login URL\'iyle eşleşmiyor) — Madde #9\'un çözmeye çalıştığı sorun geri gelmiş olur.'
    );
  }

  await browser.close();

  console.log(failures === 0 ? '\n✅ Tüm testler geçti' : `\n❌ ${failures} test başarısız oldu`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
