// ConsoleJsonLogger.ts
// Amaç:    ILogger'ın varsayılan implementasyonu — her log çağrısını
//          ProxyHealthStore'un zaten kullandığı structured JSON şeklinde
//          ({"level","component","message",...meta}) console.* üzerinden
//          basar. Madde #15'in bu turdaki DAR kapsamı: sadece FORMAT
//          merkezi hale getiriliyor; transport (dosyaya yazma, uzak
//          toplayıcıya gönderme) KAPSAM DIŞI (bkz. Madde #14 telemetry
//          aggregation — ayrı, sonraki madde).
// Katman:  telemetry
// Risk:    `meta` içinde circular reference varsa JSON.stringify throw
//          eder — bu, çağıran tarafın (örn. markFailed() gibi bir
//          hot-path) kırılmasına yol AÇMAMALI (Madde 22 disiplini: sessiz
//          fallback yasak ama ÇÖKME de yasak). Bu yüzden meta'nın
//          serialize edilebilirliği ÖNCE izole test edilir; başarısızsa
//          meta düşürülür ve `metaSerializationError: true` alanı
//          eklenir — veri kaybı SESSİZCE olmaz, açıkça işaretlenir.
//          Reserved alanlar (`level`/`component`/`message`) meta'dan SONRA
//          atanır — meta bu üçünü asla ezemez (bkz. ILogger.ts).
// Dokunma: ILogger.ts sözleşmesi değişirse bu dosya da güncellenmeli.
//          Bu sınıfı enjekte eden her tüketici (PersistentStateEngine,
//          ProxyHealthStore, index.ts) AYRI bir turda güncellenecek —
//          bu dosyanın kendisi henüz hiçbir mevcut dosyaya bağlanmadı.

import { ILogger, LogMeta } from './ILogger';

type ConsoleLevel = 'debug' | 'info' | 'warn' | 'error';

export class ConsoleJsonLogger implements ILogger {
  constructor(private readonly component: string) {}

  public debug(message: string, meta?: LogMeta): void {
    this.write('debug', message, meta);
  }

  public info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  public error(message: string, meta?: LogMeta): void {
    this.write('error', message, meta);
  }

  private write(level: ConsoleLevel, message: string, meta?: LogMeta): void {
    let safeMeta: Record<string, unknown> = {};

    if (meta) {
      try {
        // Meta'yı izole test ediyoruz — asıl JSON.stringify aşağıda tüm
        // entry için tek seferde yapılır, ama bu ön-test sayesinde meta'daki
        // bir circular reference, `message`/`component` gibi güvenli
        // alanların da kaybolmasına yol açmaz.
        JSON.stringify(meta);
        safeMeta = meta;
      } catch {
        safeMeta = { metaSerializationError: true };
      }
    }

    // Reserved alanlar meta'dan SONRA atanıyor — meta bunları asla ezemez
    // (bkz. dosya başlığı Risk notu ve ILogger.ts).
    const entry: Record<string, unknown> = {
      ...safeMeta,
      level,
      component: this.component,
      message,
    };

    const line = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        console.debug(line);
        break;
      case 'info':
        console.log(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'error':
        console.error(line);
        break;
    }
  }
}
