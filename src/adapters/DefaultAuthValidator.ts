// DefaultAuthValidator.ts
// Amaç:    AuthValidationPort'un varsayılan implementasyonu — restore edilen
//          state ile bir doğrulama URL'sine navigasyon yapıp, sonuç URL'sinin
//          "unauthenticated" (örn. login sayfasına redirect) pattern'lerinden
//          birine düşüp düşmediğine bakarak cookie/localStorage restore'un
//          GERÇEKTEN authenticate olmuş bir oturum ürettiğini doğrular
//          (URL heuristiği).
// Katman:  adapters
// Risk:    validationUrl/unauthenticatedUrlPatterns yanlış yapılandırılırsa
//          (örn. login sayfasının path'i pattern listesinde yoksa) authenticate
//          OLMAYAN bir restore "geçerli" sayılabilir — bu tam olarak Madde #9'un
//          çözmeye çalıştığı sorunun sessizce geri gelmesi demektir. Bu sınıf
//          jenerik state-sync-engine motorunun bir parçası olduğu için site'a
//          özgü URL/pattern bilgisi burada SABİTLENMEDİ (hard-code edilmedi),
//          constructor ile enjekte edilir — bu motoru hangi uygulama için
//          kuran composition root, o bilgiyi kendisi verir. AÇIK NOKTA: bu
//          projede PersistentStateEngine'i gerçekte instantiate eden dosya
//          (composition root) bu session'a henüz gösterilmedi — validationUrl
//          ve unauthenticatedUrlPatterns için gerçek değerler oradan
//          sağlanmalı, burada tahmini bir URL/pattern YAZILMADI (Kural #1).
// Dokunma: AuthValidationPort / PreservedSessionState sözleşmeleri
//          (types/auth-validation.types.ts, types/governor-command.types.ts).

import { Page } from 'playwright';
import { AuthValidationPort, PreservedSessionState } from '../types';

export class DefaultAuthValidator implements AuthValidationPort {
  constructor(
    private readonly validationUrl: string,
    private readonly unauthenticatedUrlPatterns: Array<string | RegExp>,
    private readonly navigationTimeoutMs: number = 15000
  ) {
    // Madde 22 — sahte veri/sessiz fallback yasağı: yapılandırma eksikse
    // "her restore geçerli" gibi sessizce yanlış bir varsayılana düşmek
    // yerine, hatayı construction zamanında görünür şekilde fırlat.
    if (!validationUrl) {
      throw new Error('[DefaultAuthValidator] validationUrl boş olamaz.');
    }
    if (unauthenticatedUrlPatterns.length === 0) {
      throw new Error(
        '[DefaultAuthValidator] unauthenticatedUrlPatterns boş olamaz — en az bir ' +
        'pattern (örn. login sayfasının path\'i) verilmeli, aksi halde her restore ' +
        'sessizce "authenticated" sayılır.'
      );
    }
  }

  public async validate(page: Page, _state: PreservedSessionState): Promise<boolean> {
    try {
      const response = await page.goto(this.validationUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.navigationTimeoutMs
      });

      if (!response || !response.ok()) {
        return false;
      }

      const finalUrl = page.url();
      const matchesUnauthenticated = this.unauthenticatedUrlPatterns.some((pattern) =>
        typeof pattern === 'string' ? finalUrl.includes(pattern) : pattern.test(finalUrl)
      );

      return !matchesUnauthenticated;
    } catch (error) {
      // Madde 22 — navigasyon/timeout hatası da "authenticated" sayılamaz,
      // açıkça false dönülür; asıl hata engine tarafında (PersistentStateEngine)
      // AuthRestoreFailedError'a sarılıp yukarı fırlatılacak.
      console.warn('[DefaultAuthValidator] Doğrulama navigasyonu başarısız oldu:', error);
      return false;
    }
  }
}
