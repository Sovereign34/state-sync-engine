// AdaptiveGovernor.ts
// Amaç:    Gelen semantic anomaly'leri kuyruğa alır, dedupe/coalesce eder,
//          her biri için bir aksiyon kararı üretir ve bu kararın downstream
//          handling'i tamamlanana kadar bir sonraki kuyruk elemanına geçmez.
// Katman:  engine
// Risk:    Bu dosya bozulursa iki anomaly'nin decision'ı üst üste (aynı anda)
//          işlenebilir — downstream tüketici (örn. PersistentStateEngine)
//          hâlâ önceki recovery'i sürdürürken ikinci decision'ı da işlemeye
//          çalışabilir, ya da bir listener hatası tüm kuyruğu durdurabilir.
// Dokunma: `.on('decision', ...)` ile kayıt yapan her tüketici (şu an yalnızca
//          src/engine/PersistentStateEngine.ts) — public event sözleşmesi
//          (GovernorDecisionEvent) değişmedi, yalnızca kuyruk işleme sırası
//          artık listener'ların promise'lerini gerçekten bekliyor.

import { EventEmitter } from 'events';
import { SemanticAnomaly, GovernorAction, AnomalyScope, AnomalyType } from '../types';

export interface GovernorDecisionEvent {
  anomaly: SemanticAnomaly;
  action: GovernorAction;
}

type DecisionListener = (event: GovernorDecisionEvent) => void | Promise<void>;

export class AdaptiveGovernor extends EventEmitter {
  private queue: SemanticAnomaly[] = [];
  private isProcessing = false;
  private duplicateWindowMs = 2000; // Aynı anomali tipi için coalesce penceresi

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
        // kayıtlı listener'lar manuel çağrılıp gerçekten bekleniyor —
        // kuyruk artık gerçek anlamda sıralı (serial) işleniyor.
        await this.emitDecisionAndWait(decision);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async emitDecisionAndWait(decision: GovernorDecisionEvent): Promise<void> {
    const listeners = this.listeners('decision') as DecisionListener[];
    if (listeners.length === 0) return;

    const results = await Promise.allSettled(
      listeners.map((listener) => Promise.resolve().then(() => listener(decision)))
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        // Bir listener'ın hatası kuyruğun geri kalanını durdurmamalı —
        // sahte "başarılı" varsayılmıyor, hata görünür şekilde loglanıyor.
        console.error('[AdaptiveGovernor] "decision" listener hata fırlattı:', result.reason);
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
