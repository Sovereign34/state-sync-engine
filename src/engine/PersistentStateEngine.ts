import { Browser, BrowserContext, Page } from 'playwright';
import { AdaptiveGovernor, GovernorDecisionEvent } from './AdaptiveGovernor';
import { AdvancedProxyManager } from '../network/AdvancedProxyManager';
import { PreservedSessionState, GovernorAction, AnomalyScope, AnomalyType } from '../types';
import { getAdvancedFingerprintScript } from '../utils/fingerprint';

export class PersistentStateEngine {
  private context?: BrowserContext;
  private page?: Page;
  private currentProxyServer?: string;
  private preservedState: PreservedSessionState = {
    cookies: [],
    localStorage: {},
    sessionStorage: {}
  };
  private isRecovering = false;

  constructor(
    private browser: Browser,
    private proxyManager: AdvancedProxyManager,
    private governor: AdaptiveGovernor
  ) {
    this.bindGovernor();
  }

  private bindGovernor(): void {
    this.governor.on('decision', async (event: GovernorDecisionEvent) => {
      await this.handleGovernorDecision(event);
    });
  }

  public async initialize(): Promise<void> {
    await this.createSessionWithFreshState(false);
  }

  private async captureCurrentState(): Promise<void> {
    if (!this.context || !this.page) return;
    try {
      const rawCookies = await this.context.cookies();
      this.preservedState.cookies = rawCookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as 'Strict' | 'Lax' | 'None'
      }));

      const storageData = await this.page.evaluate(() => {
        const ls: Record<string, string> = {};
        const ss: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) ls[key] = localStorage.getItem(key) || '';
        }
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) ss[key] = sessionStorage.getItem(key) || '';
        }
        return { ls, ss };
      });

      this.preservedState.localStorage = storageData.ls;
      this.preservedState.sessionStorage = storageData.ss;
    } catch (error) {
      console.warn('[PersistentStateEngine] State yakalama sırasında hata oluştu:', error);
    }
  }

  private async applyPreservedState(): Promise<void> {
    if (!this.context || !this.page) return;

    try {
      if (this.preservedState.cookies.length > 0) {
        await this.context.addCookies(this.preservedState.cookies);
      }

      await this.page.addInitScript((state: { ls: Record<string, string>; ss: Record<string, string> }) => {
        for (const [k, v] of Object.entries(state.ls)) {
          localStorage.setItem(k, v);
        }
        for (const [k, v] of Object.entries(state.ss)) {
          sessionStorage.setItem(k, v);
        }
      }, { ls: this.preservedState.localStorage, ss: this.preservedState.sessionStorage });
    } catch (error) {
      console.warn('[PersistentStateEngine] State re-hydration sırasında hata oluştu:', error);
    }
  }

  private async createSessionWithFreshState(preserve: boolean = true): Promise<void> {
    if (preserve) {
      await this.captureCurrentState();
    }

    if (this.context) {
      await this.context.close().catch(() => {});
    }

    const proxy = this.proxyManager.acquireProxy();
    this.currentProxyServer = proxy.server;

    const proxyOptions = proxy ? {
      server: proxy.server,
      username: proxy.username,
      password: proxy.password
    } : undefined;

    this.context = await this.browser.newContext({
      proxy: proxyOptions,
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    // Gelişmiş parmak izi maskelemesini her yeni context/sayfaya enjekte et
    await this.context.addInitScript(getAdvancedFingerprintScript());

    await this.applyPreservedState();

    this.page = await this.context.newPage();
    this.attachLifecycleObservers(this.page);
  }

  private attachLifecycleObservers(page: Page): void {
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      if (status === 429) {
        this.governor.enqueueAnomaly({
          id: Math.random().toString(36).substring(7),
          type: AnomalyType.HTTP_429,
          statusCode: 429,
          scope: AnomalyScope.SESSION,
          sourceUrl: url,
          timestamp: Date.now()
        });
      } else if (status === 403) {
        this.governor.enqueueAnomaly({
          id: Math.random().toString(36).substring(7),
          type: AnomalyType.HTTP_403,
          statusCode: 403,
          scope: AnomalyScope.IP,
          sourceUrl: url,
          timestamp: Date.now()
        });
      }
    });

    page.on('crash', () => {
      this.governor.enqueueAnomaly({
        id: Math.random().toString(36).substring(7),
        type: AnomalyType.PAGE_CRASH,
        scope: AnomalyScope.INFRASTRUCTURE,
        timestamp: Date.now()
      });
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      if (failure && (failure.errorText.includes('net::ERR_') || failure.errorText.includes('DNS'))) {
        this.governor.enqueueAnomaly({
          id: Math.random().toString(36).substring(7),
          type: AnomalyType.NETWORK_FAILURE,
          scope: AnomalyScope.INFRASTRUCTURE,
          sourceUrl: request.url(),
          timestamp: Date.now(),
          rawError: failure.errorText
        });
      }
    });
  }

  private async handleGovernorDecision(event: GovernorDecisionEvent): Promise<void> {
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      switch (event.action) {
        case GovernorAction.THROTTLE:
          await new Promise(res => setTimeout(res, 10000));
          break;

        case GovernorAction.QUARANTINE_PROXY:
          if (this.currentProxyServer) {
            this.proxyManager.markFailed(this.currentProxyServer, 'HTTP_403');
          }
          await this.createSessionWithFreshState(true);
          break;

        case GovernorAction.ROTATE_SESSION_ONLY:
          await this.createSessionWithFreshState(true);
          break;

        case GovernorAction.FULL_RECOVERY:
          if (this.currentProxyServer) {
            this.proxyManager.markFailed(this.currentProxyServer, 'NETWORK_FAIL');
          }
          this.preservedState = { cookies: [], localStorage: {}, sessionStorage: {} };
          await this.createSessionWithFreshState(false);
          break;

        case GovernorAction.NO_ACTION:
        default:
          break;
      }
    } catch (error) {
      console.error('[PersistentStateEngine] Recovery sırasında kritik hata:', error);
    } finally {
      this.isRecovering = false;
    }
  }

  public getPage(): Page | undefined {
    return this.page;
  }

  public getContext(): BrowserContext | undefined {
    return this.context;
  }

  public async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
    }
  }
}
