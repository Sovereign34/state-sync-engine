// runtime-check-authvalidator.ts
// Amaç:    DefaultAuthValidator'ın GÜNCELLENMİŞ davranışının (Session 3 fix'i
//          — ağ/DNS hatası artık sessizce false değil, AuthValidationNetworkError
//          fırlatıyor; false SADECE sayfaya ulaşılıp pattern eşleştiğinde
//          dönüyor) runtime doğrulaması.
// Katman:  adapters (test)
// Risk:    Bu sadece bir doğrulama betiği, production kodunu etkilemez.
// Dokunma: DefaultAuthValidator.ts, auth-validation.types.ts
//          (AuthValidationNetworkError).
//
// AÇIK NOKTA: kullanıcının gerçek production validationUrl/pattern'leri bu
// session'a hâlâ verilmedi (önceki tur placeholder çıktı — DNS'te yok).
// Test B bu yüzden GERÇEK ama nötr, herkese açık bir hedef kullanıyor:
// GitHub'ın oturum gerektiren bir ayarlar sayfası + bilinen login redirect'i.
// Bu, "sayfaya ulaşıldı + pattern eşleşti + false döndü" zincirini kanıtlar,
// ama kullanıcının KENDİ sitesinin pattern'lerini DOĞRULAMAZ — o hâlâ ayrı,
// gerçek validationUrl/unauthenticatedUrlPatterns verildiğinde yapılmalı.

import { chromium } from 'playwright';
import { DefaultAuthValidator } from './src/adapters/DefaultAuthValidator';
import { AuthValidationNetworkError } from './src/types';

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
  const browser = await chromium.launch({ headless: true });

  // --- Test A: DNS hatası artık `false` DEĞİL, AuthValidationNetworkError fırlatmalı ---
  console.log('--- Test A: çözümlenemeyen domain — throw bekleniyor (false DEĞİL) ---\n');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const validator = new DefaultAuthValidator(
      'https://bu-domain-kesinlikle-cozulmez-test.invalid/dashboard',
      ['/login'],
      8000
    );

    try {
      const result = await validator.validate(page, { cookies: [], localStorage: {}, sessionStorage: {} });
      assert(false, `validate() throw etmedi, bunun yerine ${result} döndü — DNS hatası sessizce yutulmuş olabilir`);
    } catch (error) {
      assert(
        error instanceof AuthValidationNetworkError,
        `validate() DNS hatasında AuthValidationNetworkError fırlattı (gerçek: ${error instanceof Error ? error.constructor.name : typeof error})`
      );
    }
    await context.close();
  }

  // --- Test B: gerçek, erişilebilir bir hedef + bilinen login redirect'i → false ---
  console.log('\n--- Test B: gerçek hedef (GitHub, cookie yok) — false bekleniyor ---\n');
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    const validator = new DefaultAuthValidator(
      'https://github.com/settings/profile',
      ['/login'],
      15000
    );

    try {
      const result = await validator.validate(page, { cookies: [], localStorage: {}, sessionStorage: {} });
      assert(result === false, `validate() cookie'siz gerçek hedefte FALSE döndü (gerçek: ${result})`);
    } catch (error) {
      assert(false, `validate() beklenmedik şekilde throw etti: ${error instanceof Error ? error.message : String(error)}`);
    }
    await context.close();
  }

  await browser.close();

  console.log(failures === 0 ? '\n✅ Tüm testler geçti' : `\n❌ ${failures} test başarısız oldu`);
  process.exitCode = failures === 0 ? 0 : 1;
})();
