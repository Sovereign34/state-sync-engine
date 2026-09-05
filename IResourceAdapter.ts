/**
 * IResourceAdapter.ts
 *
 * Dışarıdan enjekte edilebilecek, jenerik bir kaynak adaptörü sözleşmesi.
 * Bu dosya herhangi bir domain'e veya hedefe özgü bilgi içermez; adaptör
 * implementasyonları bu arayüzü uygulayarak kaynağa özgü detayları
 * kapsülleyecektir.
 */

import type { StatePayload } from './IStateObserver';

/**
 * Bir kaynağın nasıl gözlemleneceğini, ayrıştırılacağını ve
 * doğrulanacağını tanımlayan jenerik adaptör sözleşmesi.
 *
 * Bir `IStateObserver` implementasyonu, davranışını değiştirmeden
 * farklı kaynaklara uyum sağlamak için bu arayüzü uygulayan
 * adaptörleri çalışma zamanında (runtime) enjekte edebilir.
 */
export interface IResourceAdapter {
  /** Adaptörün benzersiz tanımlayıcısı. */
  readonly id: string;

  /** Adaptörün sürüm bilgisi (semver veya benzeri bir şema). */
  readonly version: string;

  /**
   * Bu adaptörün gözlemi başlatacağı giriş noktasını (entrypoint) döndürür.
   * Dönen değer bir URL, path veya soyut bir tanımlayıcı olabilir;
   * yorumlanması çağıran tarafa aittir.
   */
  getEntrypoint(): string;

  /**
   * Bu adaptörün ilgilendiği kaynakları eşleştirmek için kullanılacak
   * desen (pattern) listesini döndürür (örn. glob veya regex string'leri).
   */
  getMatchPatterns(): string[];

  /**
   * Ham bir ağ payload'ını, standart bir `StatePayload`'a dönüştürür.
   * Payload ilgisizse veya ayrıştırılamıyorsa `null` döner.
   */
  parseNetworkPayload(url: string, rawPayload: unknown): StatePayload | null;

  /**
   * Verilen sayfa bağlamını (page context) inceleyerek asenkron olarak
   * bir `StatePayload` üretir. İlgili bir durum bulunamazsa `null` döner.
   */
  inspectDomState(pageContext: unknown): Promise<StatePayload | null>;

  /**
   * Üretilen bir `StatePayload`'ın yapısal ve mantıksal olarak geçerli
   * olup olmadığını doğrular.
   */
  validateState(payload: StatePayload): boolean;
}
