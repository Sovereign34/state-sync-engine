// AdaptiveGovernor.ts
// Amaç:    Gelen semantic anomaly'leri kuyruğa alır, dedupe/coalesce eder,
//          her biri için bir aksiyon kararı üretir ve bu kararın downstream
//          handling'i tamamlanana kadar bir sonraki kuyruk elemanına geçmez.
// Katman:  engine
// Risk:    Bu dosya bozulursa iki anomaly'nin decision'ı üst üste (aynı anda)
//          işlenebilir — downstream tüketici (örn. PersistentStateEngine)
//          hâlâ önceki recovery'i sürdürürken ikinci decision'ı da işlemeye
//          çalışabilir, ya da bir port hatası tüm kuyruğu durdurabilir.
// Dokunma: Madde #7 tam kapandı — PersistentStateEngine artık RecoveryCommandPort'u
//          gerçekten implement ediyor ve kendi constructor'ında
//          `governor.setCommandPort(this)` ile kaydediyor; eski `.on('decision', ...)`
//          yolu PersistentStateEngine tarafında KALDIRILDI (çift-tetiklenme riskini
//          önlemek için). `.on('decision', ...)` mekanizması genel EventEmitter
//          API'si olarak hâlâ mevcut, başka bir tüketici (yoksa) kullanabilir.
//          governor-command.types.ts'teki tiplere bağımlı. Madde #9 ile
//          evaluatePolicy()'e AUTH_VALIDATION_FAILED için yeni bir case eklendi
//          (PersistentStateEngine'in handleGovernorDecision'ının catch'inden
//          enqueue edilir) — bu tip FULL_RECOVERY'e yönlendirilir, döngü riski
//          yok çünkü FULL_RECOVERY preserve=false ile çağrılır ve doğrulama
//          sadece preserve=true iken çalışır (bkz. PersistentStateEngine.ts).

import { EventEmitter } from 'events';
import {
  SemanticAnomaly,
  GovernorAction,
  AnomalyScope,
  AnomalyType,
  GovernorDecisionEvent,
  RecoveryCommandPort,
} from '../types';

// Geriye dönük uyumluluk: PersistentStateEngine.ts bu tipi hâlâ
// `import { AdaptiveGovernor, GovernorDecisionEvent } from './AdaptiveGovernor'`
// şeklinde alıyor. Gerçek tanım artık '../types'ta (merkezi kaynak), burada
// sadece re-export ediyoruz — iki kaynak yok, tek kaynak + iki erişim yolu.
export type { GovernorDecisionEvent, RecoveryCommandPort };

type DecisionListener = (event: GovernorDecisionEvent) => void | Promise<void>;

export class AdaptiveGovernor extends EventEmitter {
  private queue: SemanticAnomaly[] = [];
  private isProcessing = false;
  private duplicateWindowMs = 2000; // Aynı anomali tipi için coalesce penceresi

  /**
   * Madde #7 Çözümü (tam kapanış): Constructor enjeksiyonu yerine setter —
   * çünkü EngineFactory'de governor önce, onu tüketen PersistentStateEngine
   * sonra oluşturuluyor (circular dependency: engine, governor'a constructor'da
   * ihtiyaç duyuyor). PersistentStateEngine kendi constructor'ının sonunda
   * `governor.setCommandPort(this)` çağırarak kendini port olarak kaydeder.
   */
  private commandPort?: RecoveryCommandPort;

  constructor() {
    super();
  }

  public setCommandPort(port: RecoveryCommandPort): void {
    this.commandPort = port;
  }

  public enqueueAnomaly(anomaly: SemanticAnomaly): void {
    // Madde 9 Çözümü: Anomaly queue / coalescing ile duplicate sinyalleri ve re-entrant riskini önle
    const isDuplicate = this.queue.some(
      (existing) =>
        existing.type === anomaly.type &&
        existing.scope === anomaly.scope &&
        (anomaly.timestamp - existing.timestamp) < this.duplicateWindowMs
    );

    if (!isDuplicate) {
      this.queue.push(anomaly);
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const anomaly = this.queue.shift()!;
        const action = this.evaluatePolicy(anomaly);

        const decision: GovernorDecisionEvent = { anomaly, action };

        // Madde 6 Çözümü: emit() fire-and-forget olduğu ve listener'ların
        // promise'lerini beklemediği için, bir önceki decision'ın downstream
        // handling'i (örn. context/proxy rotasyonu) bitmeden bir sonraki
        // kuyruk elemanı işlenmeye başlıyor ve tüketici tarafındaki kilit
        // (isRecovering) ikinci decision'ı sessizce düşürüyordu. Burada
        // kayıtlı listener'lar VE (varsa) commandPort manuel çağrılıp
        // gerçekten bekleniyor — kuyruk artık gerçek anlamda sıralı
        // (serial) işleniyor.
        await this.emitDecisionAndWait(decision);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async emitDecisionAndWait(decision: GovernorDecisionEvent): Promise<void> {
    const listeners = this.listeners('decision') as DecisionListener[];

    const tasks: Promise<void>[] = listeners.map((listener) =>
      Promise.resolve().then(() => listener(decision))
    );

    // Madde #7 Çözümü: Resmi, tip-güvenli command port — sağlanmışsa
    // legacy listener'larla aynı turda, aynı disiplinle beklenir.
    if (this.commandPort) {
      tasks.push(this.commandPort.handleDecision(decision));
    }

    if (tasks.length === 0) return;

    const results = await Promise.allSettled(tasks);

    for (const result of results) {
      if (result.status === 'rejected') {
        // Bir listener/port'un hatası kuyruğun geri kalanını durdurmamalı —
        // sahte "başarılı" varsayılmıyor, hata görünür şekilde loglanıyor.
        console.error('[AdaptiveGovernor] decision handling hata fırlattı:', result.reason);
      }
    }
  }

  private evaluatePolicy(anomaly: SemanticAnomaly): GovernorAction {
    // Madde 16, 17, 18 Çözümü: Semantik Anomali Sınıflandırması ve Karar Matrisi
    switch (anomaly.type) {
      case AnomalyType.HTTP_429:
        // Rate-limit durumunda bodoslama IP değiştirmek yerine scope kontrolü
        if (anomaly.scope === AnomalyScope.SESSION) {
          return GovernorAction.ROTATE_SESSION_ONLY;
        }
        return GovernorAction.THROTTLE;

      case AnomalyType.HTTP_403:
        // 403 WAF / IP ban tespiti -> Proxy'yi karantinaya al ve sadece proxy değiştir
        return GovernorAction.QUARANTINE_PROXY;

      case AnomalyType.PAGE_CRASH:
      case AnomalyType.NETWORK_FAILURE:
        // Çökme veya ağ kopmalarında tam kurtarma döngüsü
        return GovernorAction.FULL_RECOVERY;

      case AnomalyType.AUTH_VALIDATION_FAILED:
        // Madde #9: cookie/localStorage restore edildi ama uygulama
        // authenticate olmadı — kısmi rotasyon (ROTATE_SESSION_ONLY) yetmez,
        // çünkü sorun proxy'de değil restore edilen state'in geçersizliğinde;
        // tam kurtarma (preserve=false, temiz state) gerekir.
        return GovernorAction.FULL_RECOVERY;

      case AnomalyType.CHALLENGE_DETECTED:
        return GovernorAction.ROTATE_SESSION_ONLY;

      case AnomalyType.WEBSOCKET_DISCONNECT:
        return GovernorAction.NO_ACTION;

      default:
        return GovernorAction.NO_ACTION;
    }
  }

  public getQueueSize(): number {
    return this.queue.length;
  }
}
