# STATE-SYNC-ENGINE — CORE

> Bu dosya her session başında verilen TEK başlangıç dosyasıdır.
> Ajan bu dosyadan hareketle neye ihtiyacı olduğunu kendisi belirler.
> NEXUS_OS metodolojisi esas alınarak state-sync-engine'e (resilient proxy +
> browser-session orkestrasyon motoru) uyarlanmıştır.
> `ARCHITECTURE_ASSESSMENT.md` — bu dosyanın önceliklendirme temeli, değiştirilmez
> (yalnızca yeni madde eklenerek genişletilir).

---

## 1. SESSION AÇILIŞ PROTOKOLÜ

Her session'da şu sırayı takip et — adım atlanamaz, sıra değiştirilemez:

```
1.  SESSION_INDEX.md oku
    → Anlık durum, açık madde (issue) listesi, sıradaki öncelik (P0/P1/P2)

2.  Sağlık Kontrolü yap (Bölüm 8)
    → Sonucu tek cümleyle söyle, kırık interface/duplicate implementasyon
      varsa 🔴 ile işaretle

3.  Kullanıcıya şunu söyle (tek cümle):
    "Son durum: [özet]. Sıradaki öncelik: [P0 madde]. Nereden başlayalım?"

4.  Kullanıcı görevi belirtince → Tetikleyici Tablosuna bak (Bölüm 3)
    → Hangi dosyalar/interface'ler gerekiyor? Listele.

5.  Eksik dosyaları iste — eksik veriyle ASLA çözüm üretme

6.  AGENT.md → Self-Check listesini uygula

7.  Çözüm üret → [KARAR BİLDİRİMİ] + Confidence belirle

8.  Her büyük görev sonrası Checkpoint sor (Bölüm 7)

9.  Session kapanış protokolünü uygula (Bölüm 7)
```

---

## 2. PROJE KİMLİĞİ

| Alan | Değer |
|---|---|
| Proje | state-sync-engine |
| Amaç | Proxy rotasyonu + anomaly-tabanlı recovery + tarayıcı oturum state'inin (cookie/localStorage/sessionStorage) süreklilik altında yönetilmesi |
| Domain | Resilient browser-automation execution platform |
| Mimari Referans | `ARCHITECTURE_ASSESSMENT.md` — 35 maddelik eksiklik/iyileştirme spesifikasyonu |
| Dil/Runtime | TypeScript + Node.js |
| Otomasyon | Playwright (`chromium`, `BrowserContext`, `Page`) |
| Ana bileşenler | `AdaptiveGovernor` (karar), `AdvancedProxyManager` / `ProxyManager` (proxy health), `PersistentStateEngine` (oturum yaşam döngüsü), `StealthContextBuilder` (context config) |
| Arayüzler | `IResourceAdapter`, `IStateObserver` (henüz merkezi abstraction olarak kullanılmıyor — Madde 33) |
| Repo yapısı | `src/engine`, `src/network`, `src/types`, `src/index.ts` = production entrypoint; kök dizindeki `AdaptiveGovernor.ts` / `PersistentStateEngine.ts` = **legacy, kullanılmıyor** (Madde 1.1) |
| Test altyapısı | Yok (Madde 30 — P2 önceliği) |
| Versiyon | v1.0 (assessment sonrası hedef: production-grade resilient platform) |
| Son Session | Session 0 — CORE/AGENT/SESSION_INDEX ilk oluşturma |

---

## 3. TETİKLEYİCİ TABLOSU — Hangi Görev → Hangi Dosya/Madde

> Kullanıcı görevi söyleyince bu tablodan eşleştir. Listelenen dosyaları/maddeleri
> iste, fazlasını isteme.

| Görev Türü | Zorunlu Kaynak | İlgili Madde |
|---|---|---|
| Root/src çift implementasyon temizliği | `src/index.ts`, root `.ts` dosyaları | #1 (P0) |
| Proxy state persistence (Redis/SQLite/PG) | `src/network/AdvancedProxyManager.ts` | #2 (P1) |
| Health scoring normalizasyonu | `AdvancedProxyManager.ts` health formülü | #3 (P2) |
| Weighted proxy selection | `AdvancedProxyManager.ts` selection algoritması | #4 (P2) |
| Proxy lease / state machine | `AdvancedProxyManager.ts` `acquireProxy()` | #5 (P0) |
| Recovery concurrency / queue | `AdaptiveGovernor.ts`, `isRecovering` flag | #6 (P0) |
| Governor ↔ Recovery command interface | `AdaptiveGovernor.ts` event emitter | #7 (P0) |
| Recovery transaction modeli | `PersistentStateEngine.ts` recovery akışı | #8 (P0) |
| State restore validation | `PersistentStateEngine.ts` `applyPreservedState()` | #9 (P0) |
| State kapsamı genişletme (IndexedDB/Cache/SW) | `src/types/index.ts` `PreservedSessionState` | #10 (P1) |
| Multi-origin state izolasyonu | State capture/restore katmanı | #11 (P1) |
| State versioning / migration | `StateEnvelope` tasarımı | #12 (P1) |
| Credential/state encryption | `ProxyCredential`, secret provider | #13 (P0) |
| Telemetry aggregation | `EngineTelemetry` interface + collector katmanı | #14 (P1) |
| Structured logging | Tüm `console.*` kullanımları | #15 (P1) |
| Correlation ID / distributed tracing | Anomaly ID üretimi | #16 (P1) |
| Anomaly deduplication (TTL cache) | Governor queue mantığı | #17 (P2) |
| 403/429 sınıflandırma pipeline'ı | Response listener | #18 (P2) |
| Retry-After / backoff / jitter | 429 handling (`setTimeout(...,10000)`) | #19 (P2) |
| HTTP/network/DNS/TLS anomaly genişletme | `requestfailed` handler | #20, #21 (P2) |
| Proxy metrics ↔ network telemetry bağlama | `recordSuccess()` / `markFailed()` çağrı noktaları | #22 (P0) |
| Credential/metrics izolasyonu | `getAllMetrics()` | #23 (P0) |
| Engine lifecycle (start/stop/dispose) | `EngineFactory`, `PersistentStateEngine.close()` | #24 (P1) |
| Graceful shutdown (SIGTERM/SIGINT) | Process-level handler | #25 (P1) |
| Health/readiness endpoint | Engine dış API | #26 (P2) |
| Merkezi immutable configuration | `EngineFactoryOptions` | #27 (P1) |
| Retry budget | Recovery attempt sayacı | #28 (P1) |
| Circuit breaker (proxy/session/resource) | Quarantine mantığı üstüne | #29 (P1) |
| Test piramidi kurulumu | Yok — sıfırdan | #30, #31 (P2) |
| Session identity / generation modeli | Yeni context oluşturma noktası | #32 (P2) |
| Adapter katmanı merkezi kullanım | `IResourceAdapter`, `IStateObserver` | #33 (P0) |
| Browser context standardizasyonu | `StealthContextBuilder` vs `PersistentStateEngine` context config | #34 (P2) |
| Hedef mimariye geçiş (genel) | Bölüm 6 (Hedef Mimari) | #35 |

---

## 4. ÖNCELİK SIRASI (ARCHITECTURE_ASSESSMENT.md'den)

```
P0 — kırılganlığı doğrudan azaltan, mimari borç yaratmadan yapılması gereken:
  #1 çift implementasyon temizliği
  #5 proxy lease
  #6 recovery concurrency/queue
  #7 governor↔executor command interface
  #8 recovery transaction + validation
  #9 state restore validation
  #13 credential isolation
  #22 network→proxy metrics instrumentation
  #23 metrics/credential izolasyonu
  #33 adapter katmanının merkezi kullanımı

P1 — dayanıklılık ve gözlemlenebilirlik:
  #2 persistent proxy state · #10 state kapsamı · #11 multi-origin ·
  #12 state versioning · #14 telemetry · #15 structured logging ·
  #16 tracing · #24 lifecycle · #25 graceful shutdown · #27 config ·
  #28 retry budget · #29 circuit breaker

P2 — ileri seviye optimizasyon ve test olgunluğu:
  #3 health scoring · #4 weighted selection · #17 dedup ·
  #18-21 anomaly classification · #26 health/readiness ·
  #30-31 test piramidi · #32 session identity · #34 context standardizasyonu
```

---

## 5. MİMARİ SÖZLEŞME (ihlal edilemez)

- Production kod SADECE `src/` altına yazılır. Kök dizin legacy'dir, silinene
  kadar dokunulmaz/genişletilmez (#1).
- Yeni her katman (`state/`, `telemetry/`, `policies/`, `adapters/`) eklendiğinde
  `IResourceAdapter` / `IStateObserver` sözleşmesine uyar (#33).
- `ProxyMetrics` içindeki credential alanları hiçbir public API/log/metrics
  response'unda çıplak dönmez (#13, #23).
- Recovery, kilit (`isRecovering`) yerine queue/state machine ile yönetilir (#6).

---

## 6. HEDEF MİMARİ (özet — tam diyagram ARCHITECTURE_ASSESSMENT.md #35'te)

```
Policy Engine → Recovery Manager → { Session Engine | Proxy Orchestrator | State Manager }
                                          ↓                ↓                    ↓
                                   Browser Layer    Health+Lease+CB      State Store+Versioning
                                                         ↓
                                                    Telemetry (Logs/Metrics/Tracing)
```

---

## 7. CHECKPOINT / SESSION KAPANIŞI

- Her P0 maddesi kapatıldığında: kod + [KARAR BİLDİRİMİ] + hangi self-check
  kutucuklarının işaretlendiği kullanıcıya bildirilir.
- Kapanışta SESSION_INDEX.md TAM DOSYA olarak güncellenir: kapanan madde
  Açık Sorunlar'dan silinir, kapanış gerekçesi eklenir.
- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır (Bowlera projesinden alınan ders — bkz. AGENT.md ilkeleri).

### 7.1 SESSION_INDEX 400 SATIR EŞİĞİ + ARŞİVLEME (Bowlera projesinden adapte edildi)

> AGENT.md Kural #11'in CORE.md tarafındaki karşılığı — mekanizmanın tek
> kaynağı burasıdır, AGENT.md ona referans verir.

**Adım 1 — Eşik tetiklendiğinde:**
1. SESSION_INDEX.md her session kapanışında satır sayısı kontrol edilir.
2. 400 satırı geçtiyse: **kapanmış/tamamlanmış** içerik (Kapanan Maddeler
   Geçmişi'ndeki eski girdiler, artık geçerliliğini yitirmiş Kritik Teknik
   Karar notları) TAM METİN olarak aktif arşiv parçasına taşınır
   (`session_arşiv.md`; o da dolarsa `session_arşiv_1.md` → `_2.md` → ...).
3. SESSION_INDEX.md'de sadece şunlar kalır: ⚡ Anlık Durum, hâlâ açık olan
   P0/P1/P2 maddeler, hâlâ geçerli Kritik Teknik Kararlar, Dersler.
4. Taşınan her blok, gerekçesiyle birlikte arşive eklenir — gerekçesiz
   taşıma/düşürme yasaktır (bkz. AGENT.md SELF-CORRECTION tablosu).
5. Arşiv dosyasının **kendisi** hiçbir zaman tam dosya olarak yeniden
   üretilmez — o turda taşınan **yeni blok** verilir (append). Arşiv
   parçalandığında (yeni `_N.md` açıldığında) bu bölüm (CORE.md §7.1) ve
   aşağıdaki Dosya Haritası aynı turda güncellenir, ertelenmez.
6. SESSION_INDEX **asla özetlenerek/sıkıştırılarak** küçültülmez — eşik
   aşıldığında tek doğru işlem TAM taşımadır, madde silme/özetleme değil.

**Dosya Haritası (arşiv parçaları):**

| Dosya | Durum |
|---|---|
| `session_arşiv.md` | Henüz açılmadı — SESSION_INDEX 400 satırı ilk geçtiğinde oluşturulur |

---

## 8. SAĞLIK KONTROLÜ (her session açılışında)

- [ ] `src/index.ts` hâlâ tek production entrypoint mi, root'tan import var mı?
- [ ] SESSION_INDEX.md'deki "kapandı" işaretli maddeler gerçekten kod'da mı yansımış?
- [ ] Yeni eklenen kod `IResourceAdapter`/`IStateObserver` sözleşmesini bozmuş mu?
- [ ] `getAllMetrics()` veya loglarda credential sızıntısı var mı?
