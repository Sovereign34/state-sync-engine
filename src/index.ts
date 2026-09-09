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

/**
 * (Yeni — Madde #25, izole test edilebilirlik için çıkarıldı) Graceful
 * shutdown guard mantığı, main-entry closure'ından bağımsız bir fonksiyona
 * taşındı — `disposeEngine`/`exit` enjekte edilebilir olduğu için gerçek
 * Playwright/process olmadan `runtime-check-shutdown.ts` ile test edilebilir.
 * Davranış AYNI: ilk `shutdown()` çağrısı dispose eder ve `exit(0)` çağırır;
 * sonraki her çağrı (çift sinyal ya da normal-akış-sonrası bir sinyal)
 * no-op'tur. `markDisposed()`, normal akışın (30 saniyelik bekleme sonu)
 * kendi dispose'unu yaptığı durumda guard'ı senkronize etmek için var —
 * `shutdown()` ile aynı disposed bayrağını paylaşıyor.
 */
export function createShutdownController(
  disposeEngine: () => Promise<void>,
  exit: (code: number) => void = (code) => process.exit(code)
) {
  let disposed = false;
  return {
    isDisposed: (): boolean => disposed,
    markDisposed: (): void => {
      disposed = true;
    },
    shutdown: async (signal: 'SIGTERM' | 'SIGINT', logger: ILogger): Promise<void> => {
      if (disposed) {
        return;
      }
      disposed = true;
      logger.warn(`${signal} alındı — graceful shutdown başlatılıyor`);
      await disposeEngine();
      logger.info('Graceful shutdown tamamlandı.');
      exit(0);
    },
  };
}

if (require.main === module) {
  // (Yeni — Madde #15) Demo/main-entry bloğu artık düz console.* yerine
  // merkezi ConsoleJsonLogger kullanıyor — diğer katmanlarla tutarlı.
  const logger: ILogger = new ConsoleJsonLogger('MainEntry');

  (async () => {
    logger.info('Endüstriyel Resilient Session Engine başlatılıyor...');

    // (Yeni — Madde #25) Graceful shutdown: `browser`/`engine` referansları
    // sinyal handler'ının erişebileceği bu dış scope'ta tutuluyor.
    // Guard mantığının kendisi artık `createShutdownController()`'da (izole
    // test edilebilir).
    let browserRef: Browser | undefined;
    let engineRef: PersistentStateEngine | undefined;

    const controller = createShutdownController(async () => {
      // (Madde #25) createProductionEngine dönmeden önce bir sinyal gelirse
      // browserRef/engineRef hâlâ undefined'dır — bu durumda hiçbir şey
      // dispose edilmez, browser zaten initialize() içinde henüz tam
      // kurulmamış olabileceği için erken bir close() denenmez.
      if (browserRef && engineRef) {
        await EngineFactory.disposeEngine({ browser: browserRef, engine: engineRef });
      }
    });

    process.on('SIGTERM', () => {
      void controller.shutdown('SIGTERM', logger);
    });
    process.on('SIGINT', () => {
      void controller.shutdown('SIGINT', logger);
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
      browserRef = browser;
      engineRef = engine;

      const page = engine.getPage();
      if (page) {
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        logger.info('Hedef sayfa yüklendi ve motor aktif olarak izlemede.');

        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      // (Madde #24) engine.close()/browser.close() artık ayrı ayrı, korumasız
      // çağrılmıyor. (Madde #25) `controller.isDisposed()` — 30 saniyelik
      // bekleme sırasında bir sinyal gelip zaten dispose ettiyse burada
      // tekrar çağrılmaz.
      if (!controller.isDisposed()) {
        controller.markDisposed();
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
