import { Browser, BrowserContext, Page, Response } from 'playwright';
import { EventEmitter } from 'events';
import { IResourceAdapter } from '../types';
import { ProxyManager } from '../network/ProxyManager';
import { StealthContextBuilder } from '../network/StealthContextBuilder';

export enum AnomalyType {
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SESSION_CLOSED = 'SESSION_CLOSED',
}

export interface AnomalySignal {
  type: AnomalyType;
  status?: number;
  url?: string;
  timestamp: number;
}

export class PersistentStateEngine extends EventEmitter {
  private adapter: IResourceAdapter;
  private proxyManager?: ProxyManager;
  private stealthBuilder?: StealthContextBuilder;
  
  private context?: BrowserContext;
  private page?: Page;
  private isRunning = false;
  private rotating = false; // ChatGPT'nin önerdiği Race-Condition Kilidi

  constructor(
    adapter: IResourceAdapter,
    proxyManager?: ProxyManager,
    stealthBuilder?: StealthContextBuilder
  ) {
    super();
    this.adapter = adapter;
    this.proxyManager = proxyManager;
    this.stealthBuilder = stealthBuilder;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    await this.createSession();
  }

  private async createSession(): Promise<void> {
    const proxy = this.proxyManager ? this.proxyManager.getNextProxy() : undefined;

    if (this.stealthBuilder) {
      this.context = await this.stealthBuilder.createContext();
    } else {
      const { chromium } = await import('playwright');
      const browser = await chromium.launch({ headless: true });
      this.context = await browser.newContext({ proxy });
    }

    this.page = await this.context.newPage();
    this.attachObservers(this.page);

    const entrypoint = this.adapter.getEntrypoint();
    await this.page.goto(entrypoint, { waitUntil: 'domcontentloaded' });
  }

  private attachObservers(page: Page): void {
    // Sayfa Çökme / Kapanma Dinleyicileri
    page.on('close', () => {
      this.handleAnomaly({ type: AnomalyType.SESSION_CLOSED, timestamp: Date.now() });
    });

    // Ağ Yanıtı Dinleyicisi (Passive Telemetry)
    page.on('response', async (response: Response) => {
      const url = response.url();
      const status = response.status();

      if (status === 429 || status === 403) {
        this.handleAnomaly({
          type: AnomalyType.RATE_LIMIT_EXCEEDED,
          status,
          url,
          timestamp: Date.now(),
        });
        return;
      }

      const patterns = this.adapter.getMatchPatterns();
      if (patterns.some((p) => url.includes(p))) {
        try {
          const body = await response.text();
          const payload = this.adapter.parseNetworkPayload(url, body);
          if (payload) {
            this.emit('state', payload);
          }
        } catch {
          // Yanıt gövdesi okunamadıysa sessizce geç
        }
      }
    });

    // WebSocket Dinleyicisi
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        const payload = this.adapter.parseNetworkPayload(ws.url(), frame.payload.toString());
        if (payload) {
          this.emit('state', payload);
        }
      });
    });
  }

  /**
   * Safe Session Rotation (Kilitli Oturum Yenileme)
   */
  async rotateSession(failedProxyServer?: string): Promise<void> {
    if (this.rotating) return; // Zaten rotasyon yapılıyorsa ikinci isteği engelle
    this.rotating = true;

    if (failedProxyServer && this.proxyManager) {
      this.proxyManager.markFailed(failedProxyServer);
    }

    console.log('[ENGINE] Safe session rotation başlatılıyor...');

    try {
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = undefined;
        this.page = undefined;
      }

      if (this.isRunning) {
        await this.createSession();
        console.log('[ENGINE] Yeni oturum başarıyla oluşturuldu.');
      }
    } finally {
      this.rotating = false; // İşlem bitince kilidi kaldır
    }
  }

  private handleAnomaly(signal: AnomalySignal): void {
    this.emit('anomaly', signal);
    // Anomali yakalandığında güvenli rotasyonu tetikle
    void this.rotateSession();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    if (this.context) {
      await this.context.close();
      this.context = undefined;
      this.page = undefined;
    }
    if (this.stealthBuilder) {
      await this.stealthBuilder.close();
    }
  }

  dispose(): void {
    this.removeAllListeners();
  }
}
