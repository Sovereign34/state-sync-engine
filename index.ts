import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AdvancedProxyManager } from './network/AdvancedProxyManager';
import { AdaptiveGovernor } from './engine/AdaptiveGovernor';
import { PersistentStateEngine } from './engine/PersistentStateEngine';
import { DefaultAuthValidator } from './adapters/DefaultAuthValidator';
import { ILogger } from './telemetry/ILogger';
import { ConsoleJsonLogger } from './telemetry/ConsoleJsonLogger';

export * from './types';
export { AdvancedProxyManager } from './network/AdvancedProxyManager';
export { AdaptiveGovernor } from './engine/AdaptiveGovernor';
export { PersistentStateEngine } from './engine/PersistentStateEngine';
export { DefaultAuthValidator } from './adapters/DefaultAuthValidator';
// (Yeni — Madde #15) telemetry katmanı public API'ye eklendi — composition
// root'lar kendi ILogger implementasyonlarını verebilir ya da bu varsayılanı
// kullanabilir. NOT: EngineFactory/PersistentStateEngine'e logger enjekte
// etme wiring'i bu turun KAPSAMI DIŞINDA — sadece export ediliyor, henüz
// EngineFactoryOptions'a bağlanmadı (ayrı bir tur/onay gerektirir, Kural #5).
export { ILogger, LogMeta } from './telemetry/ILogger';
export { ConsoleJsonLogger } from './telemetry/ConsoleJsonLogger';

export interface EngineFactoryOptions {
  proxies?: Array<{ server: string; username?: string; password?: string }>;
  headless?: boolean;
  /**
   * ZORUNLU (Madde #9 DI gereksinimi, composition-root tarafı). Bilinçli
   * olarak opsiyonel BIRAKILMADI — burada bir varsayılan/sessiz fallback
   * tanımlamak (örn. "verilmezse her zaman true dön") Madde #9'un çözmeye
   * çalıştığı "sahte authenticated" durumunu geri getirir (Madde 22 ihlali).
   * `DefaultAuthValidator`'ın kendisi de bu alanlar boşsa constructor'da
   * ayrıca throw eder — bu iki kat güvence (derleme zamanı + runtime).
   */
  authValidator: {
    validationUrl: string;
    unauthenticatedUrlPatterns: Array<string | RegExp>;
    navigationTimeoutMs?: number;
  };
}

export class EngineFactory {
  public static async createProductionEngine(options: EngineFactoryOptions): Promise<{
    browser: Browser;
    proxyManager: AdvancedProxyManager;
    governor: AdaptiveGovernor;
    engine: PersistentStateEngine;
  }> {
    const proxyManager = new AdvancedProxyManager(options.proxies || []);
    const governor = new AdaptiveGovernor();

    // Madde #9 DI zorunluluğu (composition-root tarafı, bkz. EngineFactoryOptions
    // üzerindeki not): validationUrl/unauthenticatedUrlPatterns burada TAHMİN
    // EDİLMEDİ — options.authValidator zorunlu olduğu için çağıran taraf
    // vermek zorunda; boş/eksikse DefaultAuthValidator constructor'ı zaten
    // açıkça throw eder (sessiz fallback yok).
    const authValidator = new DefaultAuthValidator(
      options.authValidator.validationUrl,
      options.authValidator.unauthenticatedUrlPatterns,
      options.authValidator.navigationTimeoutMs
    );

    const browser = await chromium.launch({
      headless: options.headless ?? false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const engine = new PersistentStateEngine(browser, proxyManager, governor, authValidator);
    await engine.initialize();

    return {
      browser,
      proxyManager,
      governor,
      engine
    };
  }

  /**
   * (Yeni — Madde #24) Engine + browser'ı tek, güvenli bir dispose
   * sözleşmesinde kapatır. Önceden main-entry bloğu bu ikisini ayrı ayrı,
   * try/finally OLMADAN çağırıyordu — `engine.close()` throw ederse
   * `browser.close()` hiç çalışmıyor, browser process açık kalıyordu.
   * `engine.close()` artık idempotent olduğu için (bkz. PersistentStateEngine
   * Madde #24) burada çift-close riski de yok.
   */
  public static async disposeEngine({
    browser,
    engine
  }: {
    browser: Browser;
    engine: PersistentStateEngine;
  }): Promise<void> {
    try {
      await engine.close();
    } finally {
      await browser.close().catch(() => {});
    }
  }
}

if (require.main === module) {
  // (Yeni — Madde #15) Demo/main-entry bloğu artık düz console.* yerine
  // merkezi ConsoleJsonLogger kullanıyor — diğer katmanlarla tutarlı.
  const logger: ILogger = new ConsoleJsonLogger('MainEntry');

  (async () => {
    logger.info('Endüstriyel Resilient Session Engine başlatılıyor...');

    // (Yeni — Madde #25) Graceful shutdown: SIGTERM/SIGINT geldiğinde
    // `EngineFactory.disposeEngine()` çağrılabilmesi için `browser`/`engine`
    // referansları, sinyal handler'ının da erişebileceği bu dış scope'ta
    // tutuluyor. `disposed` guard'ı, normal akış sonu ile bir sinyalin
    // (ya da iki farklı sinyalin) aynı anda `disposeEngine()`'i iki kez
    // tetiklemesini engelliyor — `close()` zaten idempotent olsa da,
    // `browser.close()`'un iki kez çağrılması gereksiz bir race'tir.
    let disposed = false;
    let browserRef: Browser | undefined;
    let engineRef: PersistentStateEngine | undefined;

    const shutdown = async (signal: 'SIGTERM' | 'SIGINT'): Promise<void> => {
      if (disposed) {
        return;
      }
      disposed = true;
      logger.warn(`${signal} alındı — graceful shutdown başlatılıyor`);
      if (browserRef && engineRef) {
        await EngineFactory.disposeEngine({ browser: browserRef, engine: engineRef });
      }
      logger.info('Graceful shutdown tamamlandı.');
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });

    try {
      const { browser, engine } = await EngineFactory.createProductionEngine({
        headless: false,
        proxies: [
          {
            server: 'http://brd.superproxy.io:22225',
            username: 'brd-customer-xxxx-zone-residential',
            password: 'your_password'
          }
        ],
        // TODO: aşağıdaki iki alanı gerçek sistemin URL'leriyle değiştir.
        // validationUrl: oturum gerektiren, login olmadan erişilemeyen ana panel URL'i.
        // unauthenticatedUrlPatterns: oturum düşünce sistemin yönlendirdiği
        // login/signin sayfa(lar)ının path/pattern'leri.
        authValidator: {
          validationUrl: 'https://your-app.example.com/dashboard', // TODO
          unauthenticatedUrlPatterns: ['/login', '/signin'] // TODO
        }
      });
      // (Madde #25) createProductionEngine dönmeden önce bir sinyal gelirse
      // browserRef/engineRef hâlâ undefined'dır — shutdown() bu durumda
      // sadece `disposed=true` set edip çıkar, browser zaten `initialize()`
      // içinde henüz tam kurulmamış olabileceği için erken bir close()
      // denemez (Playwright launch/context açılışı kendi hata yolunu yönetir).
      browserRef = browser;
      engineRef = engine;

      const page = engine.getPage();
      if (page) {
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        logger.info('Hedef sayfa yüklendi ve motor aktif olarak izlemede.');

        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      // (Madde #24) engine.close()/browser.close() artık ayrı ayrı, korumasız
      // çağrılmıyor — bkz. EngineFactory.disposeEngine. (Madde #25) `disposed`
      // guard'ı burada da kontrol ediliyor — 30 saniyelik bekleme sırasında
      // bir sinyal gelip shutdown() zaten dispose ettiyse burada tekrar
      // çağrılmaz.
      if (!disposed) {
        disposed = true;
        await EngineFactory.disposeEngine({ browser, engine });
        logger.info('Oturum başarıyla sonlandırıldı.');
      }
    } catch (error) {
      logger.error('Kritik hata', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
