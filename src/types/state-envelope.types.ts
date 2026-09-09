// state-envelope.types.ts
// Amaç:    PreservedSessionState'i (ve ileride eklenecek benzer, kalıcılaştırılacak
//          state tiplerini) diske/DB'ye yazılacak biçimde versiyonlayan generic
//          sarmalayıcı sözleşmesi (Madde #12).
// Katman:  types
// Risk:    version alanı olmadan kalıcılaştırılmış bir state, ileride şekli
//          değiştiğinde (Madde #10/#11 ile) hangi migration adımından geçmesi
//          gerektiği belirlenemez; eksik/yeni alanlar sessizce undefined kalır
//          (Kural #4 sessiz fallback yasağına çarpar).
// Dokunma: Bu turda HİÇBİR tüketici bu tipi kullanmaya BAĞLANMADI —
//          PersistentStateEngine.ts'teki captureState()/applyState() imzaları
//          değişmedi, hâlâ çıplak PreservedSessionState alıp veriyorlar
//          (Kural #5: types ve engine katmanları aynı turda karışmaz — Madde
//          #2/#13/#15/#27 turlarında izlenen "önce sözleşme, sonra ayrı
//          onaylı turda wiring" deseniyle aynı). Migration fonksiyonlarının
//          GÖVDESİ de bu turda YOK — migrate edilecek gerçek kalıcı veri henüz
//          yok (bkz. SESSION_INDEX #12 notu: preservedState şu an sadece
//          bellekte yaşıyor). Gerçek persistence (Madde #2 deseni #10/#11'e
//          uygulanınca) captureState()/applyState() sınırını bu envelope'a
//          bağlamalı; o turda bu dosyaya migration fonksiyonları eklenecek.

/**
 * Diske/DB'ye yazılacak herhangi bir state tipini (T) sarmalayan, versiyonlanmış
 * zarf. `state: T` her zaman capture edildiği andaki (o `version`'a karşılık
 * gelen) ŞEKİLDE saklanır — okuma tarafında version'a göre migration uygulanır.
 * T'nin KENDİSİ (örn. PreservedSessionState) hiçbir zaman geriye dönük uyumluluk
 * için optional alanlarla "esnetilmemeli" — aksi halde version'ın anlamı kaybolur
 * ve Edge Case #2 (şekilsel drift) geri döner.
 */
export interface StateEnvelope<T> {
  /**
   * Envelope üretildiği andaki state şekli. Artan tam sayı — semver DEĞİL,
   * çünkü migration zinciri (v(n) -> v(n+1)) basit sıralı karşılaştırma
   * gerektiriyor; semver'in major/minor/patch ayrımına burada ihtiyaç yok.
   */
  version: number;
  /** Unix ms — envelope'un üretildiği (capture edildiği) an. */
  capturedAt: number;
  state: T;
}

/**
 * PreservedSessionState'in şu anki (Madde #12 turu itibarıyla) alan şekline
 * karşılık gelen version numarası. PreservedSessionState değiştiğinde (Madde
 * #10: IndexedDB/Cache/SW kapsam genişletmesi, Madde #11: multi-origin
 * izolasyonu) bu sabit BİLİNÇLİ OLARAK artırılmalı ve eski version'dan yeni
 * version'a geçiren bir migration adımı eklenmelidir. Sabiti artırmadan alan
 * eklemek Edge Case #2'deki sessiz drift'i üretir.
 */
export const CURRENT_STATE_VERSION = 1;

/**
 * Bilinmeyen/gelecekteki bir version numarasıyla karşılaşıldığında (örn. eski
 * bir process instance'ı, yeni formatta yazılmış bir envelope okumaya
 * çalışırsa) fırlatılacak hata. Kural #4 (sessiz fallback yasağı) gereği,
 * tanınmayan bir version'da en yakın bilinen version'a sessizce düşülmez —
 * bu tip AÇIKÇA fırlatılır. Migration fonksiyonlarının gövdesi henüz
 * yazılmadığı için bu hata şu an HİÇBİR YERDE throw edilmiyor — ileride
 * migration katmanı eklendiğinde kullanılacak sözleşme burada hazırlanıyor.
 */
export class UnknownStateVersionError extends Error {
  constructor(public readonly encounteredVersion: number) {
    super(
      `Bilinmeyen state version'ı: ${encounteredVersion}. Bilinen en yüksek ` +
        `version: ${CURRENT_STATE_VERSION}. Migration adımı eksik olabilir.`,
    );
    this.name = 'UnknownStateVersionError';
  }
}
