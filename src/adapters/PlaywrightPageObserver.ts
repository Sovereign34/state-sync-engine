// PlaywrightPageObserver.ts
// Amaç:    Madde #33 — PersistentStateEngine.attachLifecycleObservers()
//          içinde HAM Playwright event'i olarak işlenen tüm sinyalleri
//          (429/403 response, crash, requestfailed) IStateObserver
//          sözleşmesi arkasına alır. Böylece PersistentStateEngine artık
//          Playwright'ın kendisini değil, jenerik bir observer arayüzünü
//          tüketir.
// Katman:  adapters
// Risk:    (Madde #33 — TAM KAPANIŞ, bu tur) Önceki turda IStateObserver.
//          AnomalyType'ta PAGE_CRASH/NETWORK_FAILURE karşılığı YOKTU —
//          bu yüzden crash/requestfailed PersistentStateEngine.ts içinde
//          HAM Playwright event'i olarak bırakılmıştı (sahte veri yasağı,
//          var olmayan bir kategoriye zorla sığdırmamak için). Bu tur,
//          kullanıcı onayıyla IStateObserver.AnomalyType'a jenerik
//          `PROCESS_CRASHED`/`NETWORK_ERROR` değerleri eklendi (bkz.
//          IStateObserver.ts) — artık crash/requestfailed de bu sınıf
//          üzerinden, 'anomaly' kanalıyla emit ediliyor. `requestfailed`
//          için önceki mevcut filtre (SADECE `net::ERR_`/`DNS` içeren
//          hatalar — diğerleri, örn. kullanıcının iptal ettiği request'ler,
//          kasıtlı olarak sinyal SAYILMAZ) AYNEN korundu, kapsam
//          genişletilmedi (Madde 22 disiplini).
//          (Önceki tur) IStateObserver.AnomalyType'ı genişletmek jenerik/
//          domain-bağımsız tasarlanmış bir sözleşme dosyasını değiştirmek
//          anlamına geldiği için ayrı bir onay/tur gerektiriyordu — bu
//          KARAR BİLDİRİMİ ile o onay alındı.
//          (Madde #22 — önceki tur) `recordSuccess()` köprüsü için, IStateObserver
//          sözleşmesinde ZATEN VAR OLAN ama şu ana kadar hiç kullanılmayan
//          `'state'` event kanalı kullanıldı — sözleşme DEĞİŞTİRİLMEDİ,
//          sadece ilk kez tüketildi. SADECE genuinely başarılı (`response.ok()`,
//          2xx) response'lar sayılıyor; 3xx/4xx(403/429 dışı)/5xx sınıflandırması
//          bilinçli olarak dışarıda bırakıldı (bu, Madde #18/#20'nin konusu —
//          burada ele alınırsa scope creep olur). Simetri gerekçesiyle (429/403
//          kontrolü HER response'a bakıyor, sadece navigation'a değil) başarı
//          sinyali de HER response için değerlendiriliyor — aksi halde bir
//          image/XHR request'i proxy'yi failed işaretleyebilirken sadece
//          navigation'lar success sayılsaydı, health score yapay şekilde kötü
//          çıkardı. `responseEnd` timing'i bazı durumlarda (disk cache'ten
//          servis edilen response) `-1` dönebilir — bu durumda 'state' HİÇ
//          emit edilmiyor (sahte/geçersiz veri yasağı, Madde 22 disiplini).
// Dokunma: IStateObserver.ts (sözleşme — bu tur AnomalyType genişletildi,
//          bkz. o dosyanın başlığı), PersistentStateEngine.ts
//          (attachLifecycleObservers artık ham page.on('crash'/'requestfailed')
//          İÇERMİYOR — translateObserverAnomaly() bu tur PROCESS_CRASHED/
//          NETWORK_ERROR case'leriyle genişletildi).

import { Page, Request, Response } from 'playwright';
import {
  IStateObserver,
  ObserverStatus,
  StateObserverEventMap,
  AnomalyPayload,
  StatePayload
} from './IStateObserver';

type EventHandler<K extends keyof StateObserverEventMap> = (
  payload: K extends 'state' ? StatePayload & { data: Record<string, unknown> } : StateObserverEventMap[K]
) => void;

/** `emitAnomaly`'ye geçilen, anomali tipine göre değişen opsiyonel bağlam. */
interface AnomalyContext {
  statusCode?: number;
  sourceUrl?: string;
  rawError?: string;
}

export class PlaywrightPageObserver implements IStateObserver {
  private _status: ObserverStatus = 'IDLE';

  private readonly stateHandlers: Array<EventHandler<'state'>> = [];
  private readonly anomalyHandlers: Array<EventHandler<'anomaly'>> = [];
  private readonly statusChangeHandlers: Array<EventHandler<'statusChange'>> = [];

  constructor(private readonly page: Page) {}

  public get status(): ObserverStatus {
    return this._status;
  }

  public start(): void {
    if (this._status === 'LISTENING') {
      return;
    }
    this.page.on('response', this.handleResponse);
    // (Madde #33 — TAM KAPANIŞ) crash/requestfailed artık bu sınıfın
    // yaşam döngüsüne bağlı — start()/stop() ile birlikte kayıt/kayıt
    // silme yapılıyor, tıpkı 'response' gibi.
    this.page.on('crash', this.handleCrash);
    this.page.on('requestfailed', this.handleRequestFailed);
    this.setStatus('LISTENING');
  }

  public stop(): void {
    this.page.off('response', this.handleResponse);
    this.page.off('crash', this.handleCrash);
    this.page.off('requestfailed', this.handleRequestFailed);
    this.setStatus('STOPPED');
  }

  public on<K extends keyof StateObserverEventMap>(event: K, handler: EventHandler<K>): void {
    this.handlersFor(event).push(handler as never);
  }

  public off<K extends keyof StateObserverEventMap>(event: K, handler: EventHandler<K>): void {
    const list = this.handlersFor(event);
    const idx = list.indexOf(handler as never);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
  }

  private handlersFor<K extends keyof StateObserverEventMap>(event: K): Array<EventHandler<K>> {
    switch (event) {
      case 'state':
        return this.stateHandlers as unknown as Array<EventHandler<K>>;
      case 'anomaly':
        return this.anomalyHandlers as unknown as Array<EventHandler<K>>;
      case 'statusChange':
        return this.statusChangeHandlers as unknown as Array<EventHandler<K>>;
      default:
        // Madde 22 — bilinmeyen bir event adı sessizce yutulmaz.
        throw new Error(`[PlaywrightPageObserver] Bilinmeyen event: ${String(event)}`);
    }
  }

  private setStatus(status: ObserverStatus): void {
    this._status = status;
    for (const handler of this.statusChangeHandlers) {
      (handler as EventHandler<'statusChange'>)(status);
    }
  }

  private readonly handleResponse = (response: Response): void => {
    const status = response.status();
    const url = response.url();

    if (status === 429) {
      this.emitAnomaly('RATE_LIMIT_EXCEEDED', { statusCode: status, sourceUrl: url });
    } else if (status === 403) {
      this.emitAnomaly('ACCESS_RESTRICTED', { statusCode: status, sourceUrl: url });
    } else if (response.ok()) {
      // Madde #22: genuinely başarılı response — recordSuccess() köprüsü
      // için 'state' event'i emit edilir. responseEnd bazı durumlarda
      // (disk cache) -1 dönebilir; bu durumda hiç emit ETMİYORUZ (sahte veri
      // yasağı, Madde 22 disiplini) — recordSuccess()'e geçersiz/negatif bir
      // latency sızmasın.
      const timing = response.request().timing();
      if (timing.responseEnd >= 0) {
        this.emitState(timing.responseEnd, status, url);
      }
    }
  };

  /**
   * (Madde #33 — TAM KAPANIŞ) Playwright'ın `page.on('crash', ...)` event'i.
   * Bir sourceUrl/statusCode kavramı yok (sayfa/process seviyesinde bir
   * olay) — önceki ham implementasyonla birebir aynı bilgi taşınıyor,
   * sadece IStateObserver'ın 'anomaly' kanalından geçiyor.
   */
  private readonly handleCrash = (): void => {
    this.emitAnomaly('PROCESS_CRASHED', {});
  };

  /**
   * (Madde #33 — TAM KAPANIŞ) Playwright'ın `page.on('requestfailed', ...)`
   * event'i. Önceki ham implementasyondaki filtre AYNEN korundu: SADECE
   * `net::ERR_` veya `DNS` içeren hata metinleri sinyal sayılır — diğerleri
   * (örn. kullanıcının/kodun kendi iptal ettiği request'ler) kasıtlı olarak
   * anomaly ÜRETMEZ (kapsam genişletilmedi, Madde 22 disiplini).
   */
  private readonly handleRequestFailed = (request: Request): void => {
    const failure = request.failure();
    if (failure && (failure.errorText.includes('net::ERR_') || failure.errorText.includes('DNS'))) {
      this.emitAnomaly('NETWORK_ERROR', { sourceUrl: request.url(), rawError: failure.errorText });
    }
  };

  private emitAnomaly(type: AnomalyPayload['type'], context: AnomalyContext): void {
    const payload: AnomalyPayload = {
      type,
      timestamp: new Date().toISOString(),
      statusCode: context.statusCode,
      details: {
        ...(context.sourceUrl !== undefined ? { sourceUrl: context.sourceUrl } : {}),
        ...(context.rawError !== undefined ? { rawError: context.rawError } : {})
      }
    };
    for (const handler of this.anomalyHandlers) {
      (handler as EventHandler<'anomaly'>)(payload);
    }
  }

  /**
   * Madde #22: `IStateObserver`'ın jenerik `'state'` kanalı üzerinden bir
   * "başarı" sinyali yayar. `source: 'NETWORK_XHR'`, `confidenceScore: 1`
   * (ölçülmüş, kesin bir HTTP response — tahmini bir skor değil). `data`
   * alanı domain-spesifik (latencyMs/statusCode/sourceUrl) — bu,
   * `IStateObserver`'ın jenerik/domain-bağımsız kalması gerektiği kuralını
   * ihlal etmez, çünkü tip zaten `Record<string, unknown>` olarak tanımlı
   * (tüketici taraf — PersistentStateEngine — kendi bildiği alanları okur).
   */
  private emitState(latencyMs: number, statusCode: number, sourceUrl: string): void {
    const payload: StatePayload & { data: Record<string, unknown> } = {
      id: `state_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
      timestamp: new Date().toISOString(),
      source: 'NETWORK_XHR',
      confidenceScore: 1,
      data: { latencyMs, statusCode, sourceUrl }
    };
    for (const handler of this.stateHandlers) {
      (handler as EventHandler<'state'>)(payload);
    }
  }
}
