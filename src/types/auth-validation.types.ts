// auth-validation.types.ts
// Amaç:    Madde #9 (state restore validation) için AuthValidationPort
//          sözleşmesi ve doğrulama başarısızlığını temsil eden hata tipi.
// Katman:  types
// Risk:    Bu sözleşme yanlış tasarlanırsa (örn. state parametresi eksik
//          bırakılırsa) ileride farklı bir doğrulama stratejisi (örn. DOM
//          tabanlı bir "logged-in" göstergesi, API tabanlı bir whoami
//          çağrısı) buraya sığmayabilir — interface'i genişletmeden önce
//          burayı gözden geçirin.
// Dokunma: PersistentStateEngine.ts (tüketici + DI enjeksiyon noktası —
//          constructor artık bir AuthValidationPort örneği zorunlu kılıyor),
//          adapters/DefaultAuthValidator.ts (varsayılan implementasyon),
//          governor-command.types.ts (AnomalyType.AUTH_VALIDATION_FAILED bu
//          dosyadaki hatayla birlikte, ayrı bir KARAR olarak eklendi).
//
// (Session 3 eklentisi) AuthValidationNetworkError: runtime doğrulaması
// sırasında bulundu — DefaultAuthValidator'ın eski hâli, ağ/DNS/timeout
// hatalarını da "unauthenticated" (false) ile aynı kefeye koyuyordu. Bu,
// "sayfaya hiç ulaşamadım" ile "sayfaya ulaştım ama login'e yönlendirildim"
// arasındaki farkı sessizce yutuyordu — ayrı bir hata tipiyle ayrıştırıldı.

import { Page } from 'playwright';
import { PreservedSessionState } from './governor-command.types';

/**
 * Madde #9: createSessionWithFreshState()'in APPLY adımından hemen sonra,
 * COMMIT'ten ÖNCE (ve sadece preserve=true iken) çağrılır. Cookie/localStorage
 * restore'un GERÇEKTEN authenticate olmuş bir oturum ürettiğini doğrular —
 * restore edilen state'in var olması (Madde #8'in konusu, applyState()'in
 * hata fırlatmaması) ile o state'in uygulama tarafından geçerli sayılması
 * (bu maddenin konusu) farklı şeylerdir.
 *
 * `page` parametresi henüz COMMIT edilmemiş (`this.page`'e atanmamış) yeni
 * sayfadır — implementasyon bu sayfada navigasyon yapabilir, çünkü hata
 * durumunda zaten mevcut rollback zinciriyle kapatılacaktır.
 */
export interface AuthValidationPort {
  validate(page: Page, state: PreservedSessionState): Promise<boolean>;
}

/**
 * createSessionWithFreshState() içinde APPLY→COMMIT arasında, sadece
 * preserve=true iken fırlatılır. Mevcut make-before-break rollback zincirine
 * (try/catch) dahil olacak şekilde tasarlandı — COMMIT'ten önce fırlatıldığı
 * için eski context/lease'e hiç dokunulmamış olur, catch bloğu sadece yeni
 * (henüz commit edilmemiş) context/lease'i temizler.
 */
export class AuthRestoreFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRestoreFailedError';
    Object.setPrototypeOf(this, AuthRestoreFailedError.prototype);
  }
}

/**
 * (Session 3) `AuthValidationPort.validate()` implementasyonları, doğrulama
 * SIRASINDA meydana gelen ve auth durumu hakkında hiçbir sonuç ÇIKARILAMAYAN
 * durumlarda (DNS/timeout/bağlantı hatası, ya da hedef sayfa beklenmeyen bir
 * HTTP durumu döndürdüğünde) bunu fırlatmalı — `false` DÖNDÜRMEMELİ.
 *
 * `false`, SADECE hedef sayfaya gerçekten ulaşılıp `unauthenticatedUrlPatterns`
 * ile eşleşme kontrolü yapılabildiğinde ve eşleşme BULUNDUĞUNDA dönmelidir.
 * Bu ayrım olmadan, geçici bir ağ sorunu "restore geçersiz" ile karıştırılıp
 * asıl auth durumu hiç bilinmeden bir sonuca varılmış olurdu.
 *
 * `PersistentStateEngine.createSessionWithFreshState()`'in genel rollback
 * `catch`'i bu hatayı da (tip ayrımı yapmadan) yakalayıp mevcut make-before-
 * break zincirini temizler; sadece `AuthRestoreFailedError` özel bir
 * `AUTH_VALIDATION_FAILED` anomaly enqueue'u tetikler — bu hata TETİKLEMEZ
 * (kasıtlı: ağ hatası, auth hatası değildir).
 */
export class AuthValidationNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthValidationNetworkError';
    Object.setPrototypeOf(this, AuthValidationNetworkError.prototype);
  }
}
