import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AdvancedProxyManager } from './network/AdvancedProxyManager';
import { AdaptiveGovernor } from './engine/AdaptiveGovernor';
import { PersistentStateEngine } from './engine/PersistentStateEngine';
import { DefaultAuthValidator } from './adapters/DefaultAuthValidator';

export * from './types';
export { AdvancedProxyManager } from './network/AdvancedProxyManager';
export { AdaptiveGovernor } from './engine/AdaptiveGovernor';
export { PersistentStateEngine } from './engine/PersistentStateEngine';
export { DefaultAuthValidator } from './adapters/DefaultAuthValidator';

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
}

if (require.main === module) {
  (async () => {
    console.log('[Main Entry] Endüstriyel Resilient Session Engine başlatılıyor...');
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

      const page = engine.getPage();
      if (page) {
        await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle' });
        console.log('[Main Entry] Hedef sayfa yüklendi ve motor aktif olarak izlemede.');
        
        await new Promise((resolve) => setTimeout(resolve, 30000));
      }

      await engine.close();
      await browser.close();
      console.log('[Main Entry] Oturum başarıyla sonlandırıldı.');
    } catch (error) {
      console.error('[Main Entry] Kritik hata:', error);
    }
  })();
}
