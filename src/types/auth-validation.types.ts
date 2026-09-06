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
