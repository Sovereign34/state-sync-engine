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
//          kuran composition root, o bilgiyi kendisi verir.
// (Session 3 — runtime doğrulaması sırasında bulundu) Eski hâlde, ağ/DNS/
//          timeout hatası (page.goto() throw) VE beklenmeyen HTTP yanıtı
//          (!response.ok()) sessizce `false` (yani "unauthenticated")
//          dönüyordu — bu, "sayfaya hiç ulaşamadım" ile "sayfaya ulaştım,
//          login'e yönlendirildim" arasındaki farkı yutuyordu. Artık bu
//          durumlarda `AuthValidationNetworkError` fırlatılıyor; `false`
//          SADECE sayfaya gerçekten ulaşılıp pattern eşleşmesi
//          değerlendirilebildiğinde dönüyor.
// Dokunma: AuthValidationPort / PreservedSessionState sözleşmeleri
//          (types/auth-validation.types.ts, types/governor-command.types.ts).
//          AuthValidationNetworkError de aynı dosyadan (auth-validation.types.ts).

import { Page } from 'playwright';
import { AuthValidationPort, PreservedSessionState, AuthValidationNetworkError } from '../types';

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
    let response;

    try {
      response = await page.goto(this.validationUrl, {
        waitUntil: 'domcontentloaded',
        timeout: this.navigationTimeoutMs
      });
    } catch (error) {
      // Sayfaya HİÇ ulaşılamadı (DNS/timeout/bağlantı hatası) — bu, auth
      // durumu hakkında hiçbir sonuç ÇIKARILAMAYAN bir durumdur. Sessizce
      // false dönmek "unauthenticated" ile "sistem şu an cevap vermiyor"u
      // birbirine karıştırır — tam olarak Madde #9'un önlemeye çalıştığı
      // risk. Ayrı bir tipte fırlatılır ki çağıran taraf bunu genel rollback
      // ile karşılasın ama AUTH_VALIDATION_FAILED anomaly'si TETİKLEMESİN
      // (bkz. AuthValidationNetworkError'ın kendi doc yorumu).
      throw new AuthValidationNetworkError(
        `[DefaultAuthValidator] validationUrl'e (${this.validationUrl}) navigasyon başarısız — ` +
        `auth durumu belirlenemedi: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!response || !response.ok()) {
      // Sayfaya ağ seviyesinde ulaşıldı ama beklenmeyen bir HTTP durumu
      // (örn. 5xx, ya da hiç response objesi yok) döndü. Bu da bir
      // "unauthenticated pattern eşleşmesi" DEĞİL — sonucu çıkarılamaz.
      throw new AuthValidationNetworkError(
        `[DefaultAuthValidator] validationUrl (${this.validationUrl}) beklenmeyen bir yanıt ` +
        `döndürdü (status=${response ? response.status() : 'yok'}) — auth durumu belirlenemedi.`
      );
    }

    // BURADAN İTİBAREN: sayfaya gerçekten ulaşıldı, HTTP yanıtı ok() —
    // artık dönen true/false SADECE unauthenticatedUrlPatterns eşleşmesine
    // dayanıyor, ağ/timeout durumuyla karışmıyor.
    const finalUrl = page.url();
    const matchesUnauthenticated = this.unauthenticatedUrlPatterns.some((pattern) =>
      typeof pattern === 'string' ? finalUrl.includes(pattern) : pattern.test(finalUrl)
    );

    return !matchesUnauthenticated;
  }
}
