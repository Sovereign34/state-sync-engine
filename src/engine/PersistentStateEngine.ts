// PersistentStateEngine.ts
// Amaç:    Browser context/page yaşam döngüsünü, proxy lease alımını ve
//          cookie/localStorage/sessionStorage state sürekliliğini yönetir.
// Katman:  engine
// Risk:    Madde #8 çözümüyle bu risk kapatıldı: createSessionWithFreshState()
//          artık "make-before-break" transaction modeliyle çalışıyor — yeni
//          proxy/context/page TAMAMEN hazır olup commit edilene kadar eski
//          context/lease'e dokunulmuyor. Herhangi bir adım (acquireProxy,
//          newContext, newPage, applyState) patlarsa yeni kaynaklar rollback
//          edilir, eski oturum bozulmadan kalır ve hata yukarı fırlatılır
//          (Madde 22 — sessiz fallback yasak).
//          KALAN RİSK: applyState() içindeki cookie/storage hatası hâlâ
//          yutulup sadece loglanıyor (orijinal davranışla aynı) — bu, context
//          proxy'li ama state'siz commit edilebileceği anlamına gelir; Madde
//          #9 (state restore validation) bunu ele alacak, kapsam dışı bırakıldı.
// Dokunma: AdvancedProxyManager'ın ProxyLease sözleşmesi (acquireProxy/
//          releaseProxy/getProxyMetrics imzaları) ve types/index.ts'teki
//          ProxyLease şekli. DAVRANIŞ DEĞİŞİKLİĞİ: proxy release sırası artık
//          "acquire yeni → release eski" (önceden tersiydi) — bkz. Madde #8
//          KARAR BİLDİRİMİ, bu ROTATE_SESSION_ONLY'nin artık aynı proxy'yi
//          geri seçmesini engelliyor.

import { Browser, BrowserContext, Page } from 'playwright';
import { AdaptiveGovernor, GovernorDecisionEvent } from './AdaptiveGovernor';
import { AdvancedProxyManager } from '../network/AdvancedProxyManager';
import { PreservedSessionState, GovernorAction, AnomalyScope, AnomalyType, ProxyLease } from '../types';

export class PersistentStateEngine {
  private context?: BrowserContext;
  private page?: Page;
  private currentLease?: ProxyLease;
  // Madde #32 (session identity modeli) ayrıca ele alınacak; bu, acquireProxy(sessionId)
  // için gereken minimum değer — kod tabanındaki mevcut ID üretim tarzıyla tutarlı.
  private readonly sessionId: string = Math.random().toString(36).substring(2, 15);
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

  /**
   * Madde #8 Çözümü: captureCurrentState artık `this.context`/`this.page`'i
   * doğrudan okumuyor — parametre olarak verilen context/page'den state
   * çıkarıyor ve döndürüyor (saf fonksiyon). Bu, transaction'ın "hazırlık"
   * aşamasında instance state'ini erken değiştirmeden çalışabilmesi için şart.
   * Hata durumunda (Madde 22 — sahte veri yasak) boş bir state döndürmek
   * yerine, en son bilinen iyi durumu (this.preservedState) korur.
   */
  private async captureState(context: BrowserContext, page: Page): Promise<PreservedSessionState> {
    try {
      const rawCookies = await context.cookies();
      const cookies = rawCookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite as 'Strict' | 'Lax' | 'None'
      }));

      const storageData = await page.evaluate(() => {
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

      return {
        cookies,
        localStorage: storageData.ls,
        sessionStorage: storageData.ss
      };
    } catch (error) {
      console.warn(
        '[PersistentStateEngine] State yakalama sırasında hata oluştu — son bilinen iyi state korunacak:',
        error
      );
      return this.preservedState;
    }
  }

  /**
   * Madde #8 Çözümü: applyPreservedState de aynı şekilde parametre alan
   * saf fonksiyona dönüştürüldü — yeni (henüz commit edilmemiş) context/page'e
   * state uygular.
   */
  private async applyState(context: BrowserContext, page: Page, state: PreservedSessionState): Promise<void> {
    try {
      if (state.cookies.length > 0) {
        await context.addCookies(state.cookies);
      }

      await page.addInitScript((s: { ls: Record<string, string>; ss: Record<string, string> }) => {
        for (const [k, v] of Object.entries(s.ls)) {
          localStorage.setItem(k, v);
        }
        for (const [k, v] of Object.entries(s.ss)) {
          sessionStorage.setItem(k, v);
        }
      }, { ls: state.localStorage, ss: state.sessionStorage });
    } catch (error) {
      // Madde 22 notu: hata burada yutulup sadece loglanıyor (orijinal davranışla
      // aynı) — yani context state'siz commit edilebilir. Bunu Madde #8 kapsamında
      // ÇÖZMÜYORUM (transaction'ın konusu proxy/context/lease tutarlılığı; state
      // içeriğinin doğrulanması Madde #9'un konusu, ayrı KARAR BİLDİRİMİ gerekir).
      console.warn('[PersistentStateEngine] State re-hydration sırasında hata oluştu:', error);
    }
  }

  /**
   * Madde #8 Çözümü — Recovery Transaction Modeli (make-before-break):
   *
   *   1. CAPTURE  — mevcut context/page'den state çıkar (gerekiyorsa)
   *   2. ACQUIRE  — yeni proxy lease'i al (ESKİ LEASE'E HENÜZ DOKUNULMAZ)
   *   3. CREATE   — yeni context + page kur
   *   4. APPLY    — state'i yeni context/page'e uygula
   *   5. COMMIT   — buraya kadar hata yoksa instance state'i değiştir,
   *                 SONRA eski context'i kapat ve eski lease'i bırak
   *
   * Adım 2-4 arasında herhangi bir hata olursa: yeni oluşturulan kaynaklar
   * (lease/context) rollback edilir, `this.context`/`this.page`/`this.currentLease`
   * HİÇ DEĞİŞMEMİŞ olarak kalır (eski oturum sapasağlam), hata yukarı fırlatılır.
   * Bu, önceki modeldeki "eski context zaten kapatılmış + eski lease zaten
   * bırakılmışken acquireProxy() patlıyor, motor kurtarılamaz hale geliyor"
   * sorununu ortadan kaldırır.
   */
  private async createSessionWithFreshState(preserve: boolean = true): Promise<void> {
    let stateToApply = this.preservedState;
    if (preserve && this.context && this.page) {
      stateToApply = await this.captureState(this.context, this.page);
    }

    const previousContext = this.context;
    const previousLease = this.currentLease;

    let newLease: ProxyLease | undefined;
    let newContext: BrowserContext | undefined;

    try {
      // 2. ACQUIRE — Madde #8: eski lease bırakılmadan ÖNCE yeni proxy alınır.
      // Davranış değişikliği (bkz. dosya başlığı): bu artık aynı proxy'nin
      // geri seçilmesini engeller, gerçek rotasyon garanti eder.
      newLease = this.proxyManager.acquireProxy(this.sessionId);

      const metrics = this.proxyManager.getProxyMetrics(newLease.proxyId);
      if (!metrics) {
        // Sahte veri/sessiz fallback yasak (Madde 22) — bu durum context'in
        // proxy'siz kurulacağı anlamına gelir, sessizce geçilmez.
        console.warn(
          `[PersistentStateEngine] Lease alındı (proxyId=${newLease.proxyId}) ama getProxyMetrics() sonuç döndürmedi — context proxy'siz kurulacak.`
        );
      }

      const proxyOptions = metrics ? {
        server: metrics.server,
        username: metrics.username,
        password: metrics.password
      } : undefined;

      // 3. CREATE
      newContext = await this.browser.newContext({
        proxy: proxyOptions,
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });

      const newPage = await newContext.newPage();

      // 4. APPLY
      await this.applyState(newContext, newPage, stateToApply);

      // 5. COMMIT — buraya kadar hiçbir şey patlamadı, artık instance state'i
      // değiştiriyoruz. Bu noktadan sonra rollback YOK — eski kaynaklar temizlenir.
      this.attachLifecycleObservers(newPage);
      this.context = newContext;
      this.page = newPage;
      this.currentLease = newLease;
      this.preservedState = stateToApply;

      if (previousContext) {
        await previousContext.close().catch(() => {});
      }
      if (previousLease) {
        this.proxyManager.releaseProxy(previousLease.leaseId);
      }
    } catch (error) {
      // ROLLBACK — yarım kalan yeni kaynaklar temizlenir, eski oturuma
      // HİÇ DOKUNULMADI (this.context/this.page/this.currentLease değişmedi).
      console.error(
        '[PersistentStateEngine] Recovery transaction başarısız oldu, önceki oturum korunuyor:',
        error
      );
      if (newContext) {
        await newContext.close().catch(() => {});
      }
      if (newLease) {
        this.proxyManager.releaseProxy(newLease.leaseId);
      }
      throw error;
    }
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
          console.log(`[PersistentStateEngine] Throttle uygulandı. Bekleniyor...`);
          await new Promise(res => setTimeout(res, 10000));
          break;

        case GovernorAction.QUARANTINE_PROXY:
          if (this.currentLease) {
            this.proxyManager.markFailed(this.currentLease.proxyId, 'HTTP_403');
          }
          await this.createSessionWithFreshState(true);
          break;

        case GovernorAction.ROTATE_SESSION_ONLY:
          await this.createSessionWithFreshState(true);
          break;

        case GovernorAction.FULL_RECOVERY:
          if (this.currentLease) {
            this.proxyManager.markFailed(this.currentLease.proxyId, 'NETWORK_FAIL');
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
    if (this.currentLease) {
      this.proxyManager.releaseProxy(this.currentLease.leaseId);
      this.currentLease = undefined;
    }
  }
}
