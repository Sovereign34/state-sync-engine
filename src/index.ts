import { PersistentStateEngine } from './engine/PersistentStateEngine';
import { AdaptiveGovernor } from './governor/AdaptiveGovernor';
// PrivateTargetAdapter sadece yerel ortamda bulunacak (.gitignore ile korunan dosya)
import { PrivateTargetAdapter } from './adapters/PrivateTargetAdapter';

async function bootstrap(): Promise<void> {
  // 1. Modül Örneklerinin Oluşturulması
  const adapter = new PrivateTargetAdapter();
  const governor = new AdaptiveGovernor();

  // 2. Engine Yapılandırması:
  // Fallback Polling tamamen kapatıldı (enableFallbackPolling: false).
  // Sistem sadece pasif ağ trafiği (XHR/WS) ve DOM MutationObserver ile çalışır.
  const engine = new PersistentStateEngine(adapter, undefined, {
    enableFallbackPolling: false,
  });

  // 3. Karar Mekanizması Bağlantısı (Single Source of Truth)
  // Engine sadece bir sensör gibi anomalileri yakalar ve Governor'a bildirir.
  engine.on('anomaly', (anomaly) => {
    governor.recordAnomaly(anomaly);
    const evaluation = governor.evaluate();

    if (!evaluation.allowed) {
      console.warn(
        `[GOVERNOR] Durum: ${evaluation.state}. Sistem duraklatıldı. ` +
        `Yeniden deneme süresi: ${evaluation.waitMs} ms`
      );
    }
  });

  // 4. Başarılı Durum Yakalama Bağlantısı
  engine.on('state', (payload) => {
    governor.recordSuccess();
    console.log('[STATE_DISCOVERED]', {
      id: payload.id,
      source: payload.source,
      confidence: payload.confidenceScore,
      timestamp: payload.timestamp,
    });
  });

  // 5. Motorun Başlatılması
  console.log('[SYSTEM_START] State Synchronization Engine başlatılıyor...');
  await engine.start();

  // Process sonlandırma sinyallerini yakalama (Graceful Shutdown)
  const shutdown = async () => {
    console.log('[SYSTEM_STOP] Sistem kapatılıyor...');
    await engine.stop();
    engine.dispose();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('[CRITICAL_ERROR] Engine başlatılamadı:', error);
  process.exit(1);
});
