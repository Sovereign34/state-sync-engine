// stealth-context-builder.ts
import { chromium, Browser, BrowserContext, LaunchOptions } from 'playwright';

export interface DeviceProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
  platform: string;
}

const DEFAULT_PROFILES: DeviceProfile[] = [
  {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    platform: 'Win32',
  },
  {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezoneId: 'America/Los_Angeles',
    platform: 'MacIntel',
  },
  {
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    platform: 'Linux x86_64',
  },
];

export interface StealthOptions {
  headless?: boolean;
  profiles?: DeviceProfile[];
  extraLaunchArgs?: string[];
}

export class StealthContextBuilder {
  private readonly profiles: DeviceProfile[];
  private readonly headless: boolean;
  private readonly extraLaunchArgs: string[];
  private browser: Browser | null = null;

  constructor(options: StealthOptions = {}) {
    this.profiles = options.profiles?.length ? options.profiles : DEFAULT_PROFILES;
    this.headless = options.headless ?? true;
    this.extraLaunchArgs = options.extraLaunchArgs ?? [];
  }

  /** Havuzdan rastgele tutarlı bir cihaz profili seçer. */
  private pickProfile(): DeviceProfile {
    const idx = Math.floor(Math.random() * this.profiles.length);
    return this.profiles[idx];
  }

  /** Otomasyon tespitini zorlaştıran launch argümanları. */
  private buildLaunchArgs(): string[] {
    return [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-infobars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
      ...this.extraLaunchArgs,
    ];
  }

  private buildLaunchOptions(): LaunchOptions {
    return {
      headless: this.headless,
      args: this.buildLaunchArgs(),
      ignoreDefaultArgs: ['--enable-automation'],
    };
  }

  private async ensureBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch(this.buildLaunchOptions());
    }
    return this.browser;
  }

  /**
   * navigator.webdriver ve ilişkili otomasyon izlerini gizleyen
   * init script'i context oluşturulduktan sonra her sayfaya enjekte eder.
   */
  private async applyEvasions(context: BrowserContext): Promise<void> {
    await context.addInitScript(() => {
      // navigator.webdriver bayrağını kaldır
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });

      // window.chrome nesnesinin eksikliğini gider (headless Chromium'da yok)
      // @ts-ignore
      if (!window.chrome) {
        // @ts-ignore
        window.chrome = { runtime: {} };
      }

      // navigator.plugins ve navigator.languages boş görünmesini engelle
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
        configurable: true,
      });

      // permissions.query üzerinden yapılan headless tespitini engelle
      const originalQuery = window.navigator.permissions.query;
      // @ts-ignore
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(parameters);

      // WebGL vendor/renderer fingerprint'ini normalize et
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      // @ts-ignore
      WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };
    });
  }

  /**
   * Tutarlı bir cihaz profiliyle yeni, "gizlenmiş" bir BrowserContext döner.
   */
  async createContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    const profile = this.pickProfile();

    const context = await browser.newContext({
      userAgent: profile.userAgent,
      viewport: profile.viewport,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
      permissions: [],
    });

    await this.applyEvasions(context);
    return context;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
  }
