// ILogger.ts
// Amaç:    Yapılandırılmış (JSON) loglama için tek merkezi sözleşme — tüm
//          katmanların düz console.* yerine kullanacağı arayüz (Madde #15,
//          Kod Kalitesi Kural #4: "yeni kodda düz console.* kullanımı
//          review'da reddedilir").
// Katman:  telemetry
// Risk:    Bu arayüz kırılırsa (imza değişirse) tüm tüketici katmanlar
//          (engine, state, network, adapters, ...) etkilenir — geriye
//          dönük uyumluluk özenle korunmalı. Bu dosyanın kendisi hiçbir
//          I/O yapmaz, sadece sözleşmedir — implementasyon riski
//          ConsoleJsonLogger.ts'te.
// Dokunma: Bu sözleşmeyi implement eden her sınıf (örn. ConsoleJsonLogger)
//          ve enjekte edildiği her tüketici constructor'ı (PersistentStateEngine,
//          ProxyHealthStore, index.ts — bu üçü AYRI turlarda, tek tek
//          güncellenecek, bkz. KARAR BİLDİRİMİ).

/**
 * Bir log çağrısına eklenen yapılandırılmış ek alanlar. Anahtar isimleri
 * `level`/`component`/`message` ile çakışsa bile implementasyon (bkz.
 * ConsoleJsonLogger) bu üç alanı HER ZAMAN kendi değerleriyle yazar —
 * meta bunları asla ezemez (log bütünlüğü garantisi).
 */
export interface LogMeta {
  [key: string]: unknown;
}

export interface ILogger {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}
