import { EventEmitter } from 'events';
import { SemanticAnomaly, GovernorAction, AnomalyScope, AnomalyType } from '../types';

export interface GovernorDecisionEvent {
  anomaly: SemanticAnomaly;
  action: GovernorAction;
}

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

    while (this.queue.length > 0) {
      const anomaly = this.queue.shift()!;
      const action = this.evaluatePolicy(anomaly);

      const decision: GovernorDecisionEvent = { anomaly, action };
      this.emit('decision', decision);
    }

    this.isProcessing = false;
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
