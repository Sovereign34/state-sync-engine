// PersistentStateEngine.ts
// Amaç:    Browser context/page yaşam döngüsünü, proxy lease alımını ve
//          cookie/localStorage/sessionStorage state sürekliliğini yönetir.
//          Ayrıca Madde #7'nin RecoveryCommandPort'unu implement eder —
//          AdaptiveGovernor'ın kararlarını fire-and-forget emit yerine
//          gerçek bir command-pattern çağrısıyla alır.
// Katman:  engine
// Risk:    Madde #8 çözümüyle "make-before-break" transaction modeli sağlandı:
//          yeni proxy/context/page TAMAMEN hazır olup commit edilene kadar eski
//          context/lease'e dokunulmuyor. Herhangi bir adım (acquireProxy,
//          newContext, newPage, applyState, Madde #9 ile eklenen
//          authValidator.validate) patlarsa yeni kaynaklar rollback edilir,
//          eski oturum bozulmadan kalır ve hata yukarı fırlatılır (Madde 22 —
//          sessiz fallback yasak).
//          Madde #9 ÇÖZÜLDÜ: applyState() içindeki cookie/storage hatası hâlâ
//          yutulup sadece loglanıyor (bilinçli — bu maddenin konusu state'in
//          İÇERİĞİNİN set edilip edilmediği değil, restore edilen state'in
//          uygulamayı GERÇEKTEN authenticate edip etmediği), ama artık
//          APPLY'dan hemen sonra, COMMIT'ten ÖNCE authValidator.validate()
//          çağrılıyor — cookie/storage set edilmiş olsa bile uygulama
//          authenticate olmadıysa AuthRestoreFailedError fırlatılır ve mevcut
//          rollback zincirine (bu try/catch) dahil olur.
//          DÜZELTME (aynı tur): handleGovernorDecision'ın catch'indeki
//          enqueueAnomaly çağrısı queueMicrotask ile ertelenmek ZORUNDA —
//          aksi halde senkron çağrı zinciri, bu çağrının kendi isRecovering
//          kilidi hâlâ true iken FULL_RECOVERY kararına ulaşır ve
//          `if (this.isRecovering) return;` guard'ı bunu sessizce yutar
//          (bkz. handleGovernorDecision içindeki KRİTİK yorum).
//          (Madde #22 — dar kapsam, bu tur) THROTTLE case'i artık
//          proxyManager.markFailed(proxyId, 'HTTP_429') çağırıyor —
//          QUARANTINE_PROXY/FULL_RECOVERY case'lerindeki mevcut desenle
//          birebir aynı guard (`if (this.currentLease)`). Önceden bu çağrı
//          hiç yapılmıyordu; HTTP_429 anomaly'leri proxy'nin
//          http429Count/quarantineUntil alanlarına HİÇ yansımıyordu.
//          recordSuccess() (başarı sinyali) bu turun kapsamı DIŞINDA
//          bırakıldı — kullanıcı kararı, ayrı bir instrumentation tasarımı
//          gerektiriyor.
// Dokunma: AdvancedProxyManager'ın ProxyLease sözleşmesi (acquireProxy/
//          releaseProxy/getProxyMetrics imzaları) ve types/index.ts'teki
//          ProxyLease şekli. AuthValidationPort sözleşmesi
//          (types/auth-validation.types.ts) — bu sözleşmeyi implement eden bir
//          örnek artık constructor'da ZORUNLU (DI, Madde 33/dependency-inversion,
//          bkz. adapters/DefaultAuthValidator.ts). BREAKING CHANGE:
//          PersistentStateEngine'i instantiate eden composition root, 4.
//          argüman olarak bir AuthValidationPort örneği vermek zorunda — bu
//          dosya dışındaki entegrasyon (composition root güncellemesi) ayrı
//          bir onay/tur gerektirir, bu KARAR BİLDİRİMİ'nin kapsamı dışıdır.
//          DAVRANIŞ DEĞİŞİKLİĞİ (Madde #8'den, değişmedi): proxy release
//          sırası "acquire yeni → release eski" (önceden tersiydi).
// (Madde #33 — ilk adım, bu tur) attachLifecycleObservers(): 429/403 tespiti
//          artık ham page.on('response', ...) DEĞİL, IStateObserver sözleşmesini
//          implement eden PlaywrightPageObserver (adapters/PlaywrightPageObserver.ts)
//          üzerinden geliyor. Bu metod artık ham Playwright event'ini görmüyor,
//          sadece AnomalyPayload → SemanticAnomaly ÇEVİRİSİNİ yapıyor
//          (translateObserverAnomaly). crash/requestfailed BİLİNÇLİ OLARAK
//          taşınmadı — bkz. PlaywrightPageObserver.ts başlığı (IStateObserver'ın
//          AnomalyType'ında bu ikisi için lossless karşılık yok).

import { Browser, BrowserContext, Page } from 'playwright';
import { AdaptiveGovernor, GovernorDecisionEvent } from './AdaptiveGovernor';
import { AdvancedProxyManager } from '../network/AdvancedProxyManager';
import { PlaywrightPageObserver } from '../adapters/PlaywrightPageObserver';
import { AnomalyPayload } from '../adapters/IStateObserver';
import {
  PreservedSessionState,
  GovernorAction,
  AnomalyScope,
  AnomalyType,
  ProxyLease,
  RecoveryCommandPort,
  AuthValidationPort,
  AuthRestoreFailedError
} from '../types';

export class PersistentStateEngine implements RecoveryCommandPort {
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
    private governor: AdaptiveGovernor,
    private authValidator: AuthValidationPort
  ) {
    // Madde #7 tam kapanış: eski `.on('decision', ...)` yerine, kendimizi
    // resmi RecoveryCommandPort olarak kaydediyoruz. Bu, aynı kararın hem
    // legacy listener hem port üzerinden iki kez tetiklenmesi riskini
    // (isRecovering kilidi bunu maskeliyordu ama kırılgan bir sıralamaya
    // dayanıyordu) kökten ortadan kaldırır — tek karar, tek işleme yolu.
    this.governor.setCommandPort(this);
  }

  /**
   * RecoveryCommandPort implementasyonu — AdaptiveGovernor'ın her kararı
   * bu metod üzerinden, `Promise.allSettled` ile beklenerek iletir.
   */
  public async handleDecision(decision: GovernorDecisionEvent): Promise<void> {
    await this.handleGovernorDecision(decision);
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
      // aynı) — yani context state'siz commit edilebilir. Bu, Madde #9'un konusu
      // DEĞİL (state'in İÇERİĞİNİN uygulanıp uygulanmadığı burada hâlâ ele
      // alınmıyor); Madde #9, uygulanan (veya kısmen uygulanamayan) state'in
      // uygulamayı GERÇEKTEN authenticate edip etmediğini APPLY'dan SONRA,
      // ayrı bir adımda (authValidator.validate) doğruluyor — bkz.
      // createSessionWithFreshState.
      console.warn('[PersistentStateEngine] State re-hydration sırasında hata oluştu:', error);
    }
  }

  /**
   * Madde #8 Çözümü — Recovery Transaction Modeli (make-before-break):
   *
   *   1. CAPTURE   — mevcut context/page'den state çıkar (gerekiyorsa)
   *   2. ACQUIRE   — yeni proxy lease'i al (ESKİ LEASE'E HENÜZ DOKUNULMAZ)
   *   3. CREATE    — yeni context + page kur
   *   4. APPLY     — state'i yeni context/page'e uygula
   *   4.5 VALIDATE — (Madde #9, SADECE preserve=true iken) restore edilen
   *                  state'in uygulamayı GERÇEKTEN authenticate ettiğini
   *                  authValidator.validate() ile doğrula; başarısızsa
   *                  AuthRestoreFailedError fırlat — bu COMMIT'ten ÖNCE
   *                  olduğu için aynı rollback zincirine (aşağıdaki catch)
   *                  dahil olur, ayrı bir hata yolu YOK.
   *   5. COMMIT    — buraya kadar hata yoksa instance state'i değiştir,
   *                  SONRA eski context'i kapat ve eski lease'i bırak
   *
   * Adım 2-4.5 arasında herhangi bir hata olursa: yeni oluşturulan kaynaklar
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

      // 4.5 VALIDATE — Madde #9: cookie/localStorage set edilmiş olması,
      // uygulamanın bunları GERÇEKTEN authenticate olarak kabul ettiği
      // anlamına gelmez. Sadece preserve=true iken çalışır — preserve=false
      // (FULL_RECOVERY, initial init) zaten temiz/anonim bir state ile
      // başlıyor, doğrulanacak bir "restore" yok (bu aynı zamanda döngü
      // riskini de ortadan kaldırır: bu adımdan doğan AuthRestoreFailedError,
      // handleGovernorDecision'ın catch'inde FULL_RECOVERY'yi preserve=false
      // ile tetikler, o çağrı bu doğrulamadan tekrar geçmez).
      if (preserve) {
        const isValid = await this.authValidator.validate(newPage, stateToApply);
        if (!isValid) {
          throw new AuthRestoreFailedError(
            `sessionId=${this.sessionId} — restore edilen state auth doğrulamasından geçemedi (proxyId=${newLease.proxyId})`
          );
        }
      }

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
      // Bu dal, Madde #9 ile eklenen AuthRestoreFailedError için de aynı
      // şekilde çalışır — validate() COMMIT'ten önce çağrıldığı için buraya
      // düşen bir doğrulama hatası da diğer adım hataları gibi rollback edilir.
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
    // Madde #33 (ilk adım): 429/403 artık ham page.on('response', ...)
    // yerine IStateObserver sözleşmesi üzerinden geliyor — bu metod artık
    // ham Playwright event'ini görmüyor, sadece çeviriyi yapıyor.
    const observer = new PlaywrightPageObserver(page);
    observer.on('anomaly', (payload) => this.translateObserverAnomaly(payload));
    observer.start();

    // BİLİNÇLİ OLARAK TAŞINMADI (bkz. PlaywrightPageObserver.ts başlığı):
    // IStateObserver.AnomalyType'ta 'crash' ve DNS/network hatası için
    // lossless bir karşılık yok — bu iki sinyal hâlâ ham Playwright event'i
    // olarak, doğrudan enqueueAnomaly() çağırıyor.
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

  /**
   * Madde #33 (ilk adım): PlaywrightPageObserver'ın (IStateObserver
   * implementasyonu) 'anomaly' event'ini, governor'ın beklediği
   * SemanticAnomaly'ye çevirir. Bu, iki farklı AnomalyType enum'unu
   * (IStateObserver'ınki vs governor-command.types.ts'teki) birbirine
   * eşleyen TEK, açık yer — örtük/dağınık bir eşleme yok.
   */
  private translateObserverAnomaly(payload: AnomalyPayload): void {
    let type: AnomalyType;
    let scope: AnomalyScope;

    switch (payload.type) {
      case 'RATE_LIMIT_EXCEEDED':
        type = AnomalyType.HTTP_429;
        scope = AnomalyScope.SESSION;
        break;
      case 'ACCESS_RESTRICTED':
        type = AnomalyType.HTTP_403;
        scope = AnomalyScope.IP;
        break;
      default:
        // SESSION_EXPIRED / CHALLENGE_DETECTED: PlaywrightPageObserver bu
        // turda bunları hiç emit ETMİYOR (bkz. kendi başlığı) — ama
        // IStateObserver jenerik bir sözleşme olduğu için ileride başka bir
        // observer bunları emit edebilir. O durumda sessizce yutmak Madde 22
        // ihlali olur — açıkça logla, hiçbir şey enqueue etme.
        console.warn(
          `[PersistentStateEngine] PlaywrightPageObserver'dan beklenmeyen/henüz eşlenmemiş anomaly type: ${payload.type} — enqueue edilmedi.`
        );
        return;
    }

    const sourceUrl = typeof payload.details?.sourceUrl === 'string' ? payload.details.sourceUrl : undefined;

    this.governor.enqueueAnomaly({
      id: Math.random().toString(36).substring(7),
      type,
      scope,
      statusCode: payload.statusCode,
      sourceUrl,
      timestamp: new Date(payload.timestamp).getTime()
    });
  }

  private async handleGovernorDecision(event: GovernorDecisionEvent): Promise<void> {
    // GEÇİCİ DEBUG — teşhis sonrası kaldırılacak.
    console.log(`[DEBUG] handleGovernorDecision çağrıldı — action=${event.action}, isRecovering=${this.isRecovering}`);
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      switch (event.action) {
        case GovernorAction.THROTTLE:
          // (Madde #22 — dar kapsam, bu tur) Önceden bu case sadece bekliyordu;
          // proxyManager hiç haberdar edilmiyordu. Diğer iki case'deki
          // (QUARANTINE_PROXY/FULL_RECOVERY) mevcut desenle birebir aynı guard.
          if (this.currentLease) {
            this.proxyManager.markFailed(this.currentLease.proxyId, 'HTTP_429');
          }
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

      // Madde #9: createSessionWithFreshState() APPLY→COMMIT arasında bir
      // AuthRestoreFailedError fırlattıysa, rollback zaten tamamlanmış olur
      // (eski context/lease sağlam) — ama motor hâlâ, restore'u doğrulanamamış
      // eski (önceki) context'te kalmış olur. Bunu sessizce bırakmak
      // "başarısız restore = kurtarıldı" varsaymak anlamına gelir (Madde 22
      // ihlali); bunun yerine FULL_RECOVERY'ye yönlendiren yeni bir anomaly
      // enqueue ediyoruz. Döngü riski yok: FULL_RECOVERY case'i
      // createSessionWithFreshState(false) çağırır — doğrulama (4.5 adımı)
      // sadece preserve=true iken çalıştığı için bu yol ikinci kez
      // AuthRestoreFailedError üretemez.
      //
      // KRİTİK — queueMicrotask ile erteleme ZORUNLU: enqueueAnomaly() burada
      // senkron çağrılırsa, enqueueAnomaly → processQueue → emitDecisionAndWait
      // → commandPort.handleDecision → handleGovernorDecision zinciri hiçbir
      // await'e uğramadan (hepsi senkron çağrı) FULL_RECOVERY kararına ulaşır
      // — VE bu noktada hâlâ BU çağrının isRecovering=true'su aktiftir, çünkü
      // aşağıdaki finally henüz çalışmadı. Sonuç: `if (this.isRecovering)
      // return;` guard'ı FULL_RECOVERY'yi SESSİZCE yutar — anomaly kuyruktan
      // çekilir ama hiç işlenmez (Madde 22 ihlali). queueMicrotask, bu
      // çağrının bir sonraki mikro-görev turuna ertelenmesini ve dolayısıyla
      // finally'nin (isRecovering=false) kesinlikle önce çalışmasını
      // garanti eder.
      if (error instanceof AuthRestoreFailedError) {
        const rawError = error.message;
        queueMicrotask(() => {
          this.governor.enqueueAnomaly({
            id: Math.random().toString(36).substring(7),
            type: AnomalyType.AUTH_VALIDATION_FAILED,
            scope: AnomalyScope.SESSION,
            timestamp: Date.now(),
            rawError
          });
        });
      }
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
