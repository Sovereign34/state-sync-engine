// PlaywrightPageObserver.ts
// Amaç:    Madde #33'ün İLK ADIMI — PersistentStateEngine.attachLifecycleObservers()
//          içinde HAM Playwright event'i olarak (page.on('response', ...))
//          işlenen 429/403 tespitini, IStateObserver sözleşmesi arkasına alır.
//          Böylece PersistentStateEngine artık Playwright'ın kendisini değil,
//          jenerik bir observer arayüzünü tüketir.
// Katman:  adapters
// Risk:    IStateObserver.ts'teki AnomalyType (RATE_LIMIT_EXCEEDED |
//          ACCESS_RESTRICTED | SESSION_EXPIRED | CHALLENGE_DETECTED), mevcut
//          engine'in tespit ettiği TÜM sinyalleri (crash, DNS/network hatası)
//          LOSSLESS şekilde karşılamıyor — PAGE_CRASH/NETWORK_FAILURE
//          karşılığı YOK. Bu ikisini var olan kategorilerden birine zorla
//          sığdırmak (örn. crash'i SESSION_EXPIRED saymak) YANLIŞ bir sinyal
//          üretir (Madde 22 — sahte veri yasak). Bu yüzden BİLİNÇLİ OLARAK
//          bu sınıf SADECE 429→RATE_LIMIT_EXCEEDED ve 403→ACCESS_RESTRICTED'i
//          taşıyor; crash/requestfailed, PersistentStateEngine.ts içinde HAM
//          Playwright event'i olarak kalmaya devam ediyor (ayrı bir yorum
//          orada da düşüldü). IStateObserver.AnomalyType'ı genişletmek
//          (PAGE_CRASH/NETWORK_FAILURE eklemek) mümkün ama bu, jenerik/
//          domain-bağımsız tasarlanmış bir sözleşme dosyasını değiştirmek
//          anlamına gelir — ayrı bir onay/tur.
// Dokunma: IStateObserver.ts (sözleşme, DEĞİŞTİRİLMEDİ), PersistentStateEngine.ts
//          (attachLifecycleObservers artık bu sınıfı kullanıyor + AnomalyPayload'ı
//          SemanticAnomaly'ye çeviren translateObserverAnomaly() eklendi).

import { Page, Response } from 'playwright';
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
    this.setStatus('LISTENING');
  }

  public stop(): void {
    this.page.off('response', this.handleResponse);
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
      this.emitAnomaly('RATE_LIMIT_EXCEEDED', status, url);
    } else if (status === 403) {
      this.emitAnomaly('ACCESS_RESTRICTED', status, url);
    }
  };

  private emitAnomaly(type: AnomalyPayload['type'], statusCode: number, sourceUrl: string): void {
    const payload: AnomalyPayload = {
      type,
      timestamp: new Date().toISOString(),
      statusCode,
      details: { sourceUrl }
    };
    for (const handler of this.anomalyHandlers) {
      (handler as EventHandler<'anomaly'>)(payload);
    }
  }
}
