# state-sync-engine — ARCHITECTURE ASSESSMENT
> Kaynak: mevcut ZIP implementasyonu üzerinden hazırlanmış, yorumsuz teknik
> eksiklik/iyileştirme spesifikasyonu. CORE.md'nin önceliklendirme (P0/P1/P2)
> temelidir. Bu dosya sadece yeni madde eklenerek genişletilir, mevcut
> maddeler geriye dönük değiştirilmez (numaralandırma sabit kalır).

1. Mimari eksiklikler

1.1 Çift implementasyonların kaldırılması

Projede aynı sorumluluk alanlarına ait iki ayrı implementasyon nesli bulunmaktadır:

/root
 ├── AdaptiveGovernor.ts
 ├── PersistentStateEngine.ts
 └── interfaces

/src
 ├── engine/AdaptiveGovernor.ts
 ├── engine/PersistentStateEngine.ts
 └── network/*

Production entrypoint:

src/index.ts

yalnızca src/ altındaki implementasyonları kullanmaktadır.

Öneri:

src/
 ├── engine/
 ├── network/
 ├── state/
 ├── telemetry/
 ├── policies/
 ├── adapters/
 └── types/

Root seviyesindeki eski implementasyonlar kaldırılmalı veya açık biçimde legacy/ alanına taşınmalıdır.

---

2. Proxy state persistence

AdvancedProxyManager bütün proxy durumunu RAM'de tutmaktadır:

private proxies: Map<string, ProxyMetrics>

Process restart olduğunda successCount, failureCount, 403 count, 429 count,
latency, quarantineUntil tamamen sıfırlanır. Dolayısıyla proxy health sistemi
process sınırları arasında süreklilik göstermemektedir.

Öneri: Proxy state için persistent store eklenmeli (Redis/SQLite/PostgreSQL
üzerinden ProxyStateRepository). Minimum persistent model:

interface PersistentProxyState {
  proxyId: string;
  healthScore: number;
  successCount: number;
  failureCount: number;
  http403Count: number;
  http429Count: number;
  dnsFailures: number;
  tlsFailures: number;
  latencyEma: number;
  quarantineUntil: number;
  updatedAt: number;
}

---

3. Proxy health scoring modelinin normalize edilmesi

Mevcut successRate - latencyPenalty - failurePenalty formülü basit bir
heuristik modeldir. http403Count*20, dnsFailures*15, tlsFailures*15 uzun
çalışan sistemlerde score'u kalıcı olarak sıfıra yaklaştırabilir. Ayrıca
HTTP_429 health score hesabında doğrudan penalty olarak kullanılmamaktadır.

Öneri: HealthScore = SuccessComponent × LatencyComponent × ReliabilityComponent
× ProtocolComponent × FreshnessComponent, [0,100] aralığında tutulmalı ve
zaman ağırlıklı decay uygulanmalı (historical failures zamanla etkisini
kaybeder, recent failures yüksek ağırlık taşır).

---

4. Proxy selection algoritması

Mevcut sistem healthyCandidates.sort(...); selected = healthyCandidates[0]
kullanıyor. Bu, en yüksek skorlu proxy'nin sürekli seçilmesine neden olur;
diğer proxy'ler kullanılmaz kalır.

Öneri: Weighted selection kullanılmalı — score + recentSuccess + latency +
cooldown + usageFrequency üzerinden ağırlık hesaplanmalı. Örnek:
selectionWeight = healthScore × explorationFactor × availabilityFactor.
Böylece exploitation + exploration dengesi sağlanır.

---

5. Proxy lease mekanizması eksik

acquireProxy() proxy'yi seçiyor ancak proxy üzerinde aktif kullanım/lease
state oluşturmuyor. Dolayısıyla paralel execution geldiğinde aynı proxy
birden fazla session'a atanabilir.

Öneri: Proxy allocation AVAILABLE → LEASED → IN_USE → RELEASED state
machine'i üzerinden yönetilmeli. acquireProxy(sessionId): ProxyLease /
releaseProxy(leaseId): void. Lease üzerinde proxyId, sessionId, acquiredAt,
expiresAt bulunmalı.

---

6. Recovery concurrency problemi

Mevcut private isRecovering = false; ve if (this.isRecovering) return;
kullanılıyor. Bu concurrency'yi engelliyor fakat ikinci anomaly'yi
kaybediyor (örn. NETWORK_FAILURE → FULL_RECOVERY başladıktan sonra gelen
HTTP_403 → QUARANTINE_PROXY isteği, isRecovering===true olduğu için
işlenmeden düşer).

Öneri: Recovery lock yerine recovery queue/state machine kullanılmalı:
ANOMALY QUEUE → POLICY ENGINE → RECOVERY QUEUE → RECOVERY WORKER. Aynı
zamanda priority uygulanmalı: INFRASTRUCTURE > IP > SESSION > REQUEST.

---

7. Governor event lifecycle

EventEmitter üzerinden this.emit('decision', decision) yapılıyor ancak
event'in asynchronous handler sonucu governor tarafından takip edilmiyor
(fire-and-forget davranışı).

Öneri: Governor ile recovery executor arasında açık command interface
kullanılmalı:

interface RecoveryExecutor {
  execute(decision: GovernorDecision): Promise<RecoveryResult>;
}

RecoveryResult { success: boolean; action: GovernorAction; durationMs: number; error?: Error; }
governor'a geri aktarılmalı.

---

8. Recovery transaction modeli eksik

Mevcut recovery capture → close context → acquire proxy → create context →
restore state sırasında herhangi bir aşama başarısız olabilir (örn. old
context closed sonrası proxy acquisition failed → eski session artık
mevcut değil).

Öneri: Recovery transaction modeli CAPTURE → PREPARE → ACQUIRE → CREATE →
RESTORE → VALIDATE → COMMIT → OLD SESSION RELEASE şeklinde kurulmalı. Yeni
context doğrulanmadan eski context kapatılmamalı.

---

9. State validation eksik

applyPreservedState() başarılı olduğunda state'in gerçekten uygulandığı
doğrulanmıyor (cookies restored ≠ application authenticated).

Öneri: Restore sonrası validation layer eklenmeli: Cookie validation,
Storage validation, Authentication validation, Application readiness
validation. Örn: validateRestoredSession(): Promise<StateValidationResult>.

---

10. State kapsamı eksik

Mevcut state cookies/localStorage/sessionStorage ile sınırlı.
PreservedSessionState içinde webSocketSubscriptions? tanımlanmış olmasına
rağmen gerçek capture/restore implementasyonu yok.

Öneri: State modeli katmanlandırılmalı: SessionState → Cookies,
LocalStorage, SessionStorage, IndexedDB, Cache, ServiceWorker metadata,
WebSocket subscriptions, Application-specific state. Her adapter yalnızca
desteklediği state türünü declare etmeli.

---

11. Origin isolation eksik

localStorage ve sessionStorage global bir obje olarak tutuluyor. Birden
fazla origin içeren sayfalarda state'lerin hangi origin'e ait olduğu açıkça
modellenmemiş.

Öneri: State Record<Origin, StorageState> şeklinde tutulmalı.

---

12. State versioning eksik

Persist edilen state için schema version bulunmuyor.

Öneri:
interface StateEnvelope {
  schemaVersion: number;
  capturedAt: number;
  sourceSessionId: string;
  origin: string;
  state: PreservedSessionState;
}
Migration sistemi v1→v2→v3 şeklinde tasarlanmalı.

---

13. State encryption eksik

Proxy credentials doğrudan username/password olarak memory object içinde
tutuluyor. Session state içinde authentication materyali bulunabilir.

Öneri: Secret değerleri Environment → SecretProvider → ProxyCredential
üzerinden çözülmeli. State persistence yapılacaksa encryption-at-rest
uygulanmalı.

---

14. Telemetry implementasyonu eksik

EngineTelemetry interface'i tanımlı (totalSessions, blockedSessions,
http403Rate, http429Rate, challengeRate, proxyFailureRate,
lastMetricsUpdate) ancak gerçek telemetry aggregation sistemi yok.

Öneri: Ayrı TelemetryCollector, MetricsRegistry, EventRecorder katmanları
eklenmeli. Minimum metric set: session.created/closed/recovery/
recovery.failed; proxy.acquired/quarantined/released; anomaly.detected/
dropped/coalesced; state.capture/restore/validation.

---

15. Structured logging eksik

Mevcut sistem console.log()/warn()/error() kullanıyor.

Öneri: JSON log — { timestamp, level, component, event, sessionId, proxyId, error }.

---

16. Anomaly correlation ID eksik

Anomaly ID Math.random().toString(36) ile üretiliyor — distributed tracing
için yeterli değil.

Öneri: Her execution için traceId, sessionId, recoveryId, anomalyId, proxyId
kullanılmalı; request → anomaly → governor decision → proxy quarantine →
recovery → new session tek trace altında izlenebilir olmalı.

---

17. Anomaly deduplication algoritması

Mevcut duplicate kontrolü yalnızca queue içindeki eventlere bakıyor
(this.queue.some(...)); işlenmiş eventler history'de tutulmuyor, aynı
anomaly recovery tamamlandıktan sonra tekrar gelebilir.

Öneri: Time-windowed deduplication store (AnomalyFingerprint → TTL cache).
Fingerprint: type, scope, sourceUrl, proxyId, sessionId kombinasyonu.

---

18. 403/429 sınıflandırması fazla kaba

Mevcut sistem 403→IP, 429→SESSION şeklinde doğrudan policy uyguluyor.
Gerçek sistemlerde semantik endpoint/header/body/temporal pattern'e göre
değişebilir.

Öneri: Classification pipeline — HTTP response → Header analysis →
Body/signature analysis → Temporal pattern → Scope classifier → Policy engine.

---

19. Rate-limit kontrolü eksik

429 durumunda sabit setTimeout(...,10000) throttle uygulanıyor, Retry-After
header dikkate alınmıyor.

Öneri: Retry-After → server-provided delay → bounded exponential backoff →
jitter kullanılmalı.

---

20. HTTP status observation kapsamı

Response listener yalnızca 403/429 tespit ediyor. 408/425/500/502/503/504
sistem sinyali olarak modellenebilir ancak hepsi aynı recovery aksiyonuna
bağlanmamalı.

Öneri: Transport failure classifier — HTTP anomaly, Network anomaly, TLS
anomaly, DNS anomaly, Browser anomaly, Application anomaly.

---

21. DNS/TLS ayrıştırması eksik

requestfailed içindeki failure.errorText.includes('net::ERR_') çok geniş
bir classifier'dır.

Öneri: Explicit mapping — ERR_NAME_NOT_RESOLVED→DNS_FAIL, ERR_CERT_*→
TLS_FAIL, ERR_CONNECTION_RESET→NETWORK_FAIL, ERR_TIMED_OUT→NETWORK_TIMEOUT.

---

22. Proxy health ile gerçek network telemetry bağlantısı eksik

AdvancedProxyManager recordSuccess()/markFailed() API'lerine sahip ancak
engine'deki response/request observer'lar bu metric API'lerini normal
request lifecycle ile sistematik olarak beslemiyor.

Öneri: Network instrumentation — Request → Timer → Response/Failure →
Classifier → ProxyMetricsRecorder haline getirilmeli.

---

23. Proxy credential'larının log/metric izolasyonu

ProxyMetrics içinde username?/password? bulunuyor. getAllMetrics() bunları
da döndürüyor.

Öneri: Credential ile operational state ayrılmalı — ProxyIdentity,
ProxyCredential, ProxyHealth ayrı entity'ler olmalı. getAllMetrics() hiçbir
secret döndürmemeli.

---

24. Engine lifecycle yönetimi

close() yalnızca context'i kapatıyor. EngineFactory ayrıca
await browser.close(); çağırıyor — lifecycle sorumluluğu dışarıda kalıyor.

Öneri: Engine start()/stop()/dispose() lifecycle API'sine sahip olmalı ve
kendi kaynaklarını kontrollü kapatmalı.

---

25. Graceful shutdown

SIGTERM/SIGINT handling yok.

Öneri: SIGTERM → stop accepting work → finish active recovery → persist
proxy state → persist session state → close contexts → close browser.

---

26. Health/readiness endpoint eksik

Engine'in dış sistemler tarafından canlılık durumu kontrol edilemiyor.

Öneri: /liveness ve /readiness (veya internal getHealth()/getReadiness()) eklenmeli.

---

27. Configuration management eksik

Şu anda createProductionEngine(options) sınırlı configuration alıyor.

Öneri: Merkezi immutable EngineConfig { proxy, recovery, governor, state,
telemetry, browser, limits } oluşturulmalı.

---

28. Retry budget eksik

Recovery mekanizması başarısız olduğunda global retry budget bulunmuyor.

Öneri: Her recovery için maxAttempts, maxDuration, backoff, jitter,
failurePolicy tanımlanmalı (RECOVERY_ATTEMPT_1→2→3→TERMINAL_FAILURE).

---

29. Circuit breaker eksik

Proxy quarantine mevcut ancak engine/resource seviyesinde circuit breaker yok.

Öneri: Üç seviyeli breaker — Proxy Circuit Breaker, Session Circuit Breaker,
Resource Circuit Breaker.

---

30. Test altyapısı eksik

ZIP içinde test suite bulunmuyor.

Öneri: Test piramidi — Unit (Governor policy, health scoring, quarantine,
state serialization), Integration (Playwright context, proxy rotation,
recovery, state restore), Failure injection (403, 429, DNS, TLS, crash, all
proxies unavailable), Soak test (long-running session lifecycle).

---

31. State integrity testleri

Otomatik test edilmesi gereken senaryolar: capture→restore, capture→proxy
rotation→restore, capture→crash→recovery, capture→process restart→restore,
expired cookie→restore, multi-origin storage→restore, invalid state→recovery.

---

32. Recovery sonrası session identity

Yeni context oluşturulduğunda eski session'ın hangi logical session'a ait
olduğu açıkça modellenmiyor.

Öneri: SessionIdentity { logicalSessionId, physicalContextId, proxyId,
generation }. Örn: logicalSession=S42, generation1→proxy A, generation2→
proxy B, generation3→proxy C. Bu, state continuity ile physical session
rotation'ı birbirinden ayırır.

---

33. Adapter katmanı eksik kullanılıyor

Projede IResourceAdapter, IStateObserver arayüzleri mevcut; ancak mevcut
engine bunları merkezi abstraction olarak kullanmıyor.

Öneri: PersistentStateEngine → IResourceAdapter, IStateObserver[],
IProxyProvider, IStateStore, IRecoveryExecutor, ITelemetry şeklinde
dependency-inversion modeline geçirilmeli.

---

34. Browser configuration standardizasyonu

StealthContextBuilder ayrı dururken PersistentStateEngine kendi context
configuration'ını doğrudan oluşturuyor (viewport, userAgent). İki browser
configuration sistemi oluşuyor.

Öneri: Tek bir BrowserContextFactory oluşturulmalı; tüm context'ler buradan
üretilmeli.

---

35. Mimari hedef durum

Mevcut sistem: Engine → Governor, ProxyManager, State seviyesinde.

Önerilen hedef mimari:

Policy Engine → Recovery Manager → { Session Engine | Proxy Orchestrator | State Manager }
                                        ↓                  ↓                    ↓
                                 Browser Layer     Proxy Health+Lease+CB   State Store+Versioning
                                                          ↓
                                                     Telemetry (Logs/Metrics/Tracing)

---

## Sonuç — Öncelik Sırası

P0: #1 çift implementasyon · #6 recovery state machine/queue · #5 proxy lease
· #8 state transaction+validation · #9 state validation · #13 credential
isolation · #22 network→proxy metrics instrumentation · #23 credential
izolasyonu · #7 governor↔executor command interface · #33 adapter katmanı

P1: #2 persistent proxy state · #12 state versioning · #11 multi-origin
state · #14 structured telemetry · #16 distributed tracing · #28 retry
budget · #29 circuit breaker · #25 graceful shutdown · #15 structured
logging · #24 lifecycle · #27 configuration · #10 state kapsamı

P2: #3 advanced health scoring · #4 weighted proxy selection · #18-21
extended anomaly classification · #26 health/readiness · #30-31
integration/failure-injection/soak testleri · #17 dedup · #32 session
identity · #34 context standardizasyonu

Bu değişikliklerle mevcut yapı, proxy + browser automation kodundan; state,
policy, recovery, health, persistence ve observability katmanları
birbirinden ayrılmış production-grade resilient execution platformu
mimarisine taşınır.
