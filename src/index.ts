import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AdvancedProxyManager } from './network/AdvancedProxyManager';
import { AdaptiveGovernor } from './engine/AdaptiveGovernor';
import { PersistentStateEngine } from './engine/PersistentStateEngine';

export * from './types';
export { AdvancedProxyManager } from './network/AdvancedProxyManager';
export { AdaptiveGovernor } from './engine/AdaptiveGovernor';
export { PersistentStateEngine } from './engine/PersistentStateEngine';

export interface EngineFactoryOptions {
  proxies?: Array<{ server: string; username?: string; password?: string }>;
  headless?: boolean;
}

export class EngineFactory {
  public static async createProductionEngine(options: EngineFactoryOptions = {}): Promise<{
    browser: Browser;
    proxyManager: AdvancedProxyManager;
    governor: AdaptiveGovernor;
    engine: PersistentStateEngine;
  }> {
    const proxyManager = new AdvancedProxyManager(options.proxies || []);
    const governor = new AdaptiveGovernor();
    
    const browser = await chromium.launch({
      headless: options.headless ?? false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    });

    const engine = new PersistentStateEngine(browser, proxyManager, governor);
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
        ]
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
