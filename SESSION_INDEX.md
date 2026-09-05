# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 1
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde — bu session'da #36 eklendi)
- **Kod durumu:**
  - Madde #1: dosya taşıma yapıldı. **Kapsam düzeltildi:** kullanıcının GitHub
    ekran görüntüsü root'ta ayrıca `ProxyManager.ts` ve `StealthContextBuilder.ts`
    olduğunu ortaya çıkardı (ilk taramada gözden kaçmıştı — ZIP'te bunlar
    yalnızca `src/network/` altında görülmüştü, ayrıca root kopyaları da
    varmış). Diff ile doğrulandı: bu ikisi `src/network/` sürümleriyle
    birebir aynı (Governor/StateEngine'deki gibi farklılaşma yok). Toplam
    6 dosya `legacy/`'ye taşındı: `AdaptiveGovernor.ts`,
    `PersistentStateEngine.ts`, `IResourceAdapter.ts`, `IStateObserver.ts`,
    `ProxyManager.ts`, `StealthContextBuilder.ts`. Kullanıcı taşımayı kendi
    ortamında manuel yapacak — henüz doğrulanmadı.
  - Madde #5: `AdvancedProxyManager.ts`'e lease mekanizması eklendi
    (`acquireProxy(sessionId): ProxyLease`, `releaseProxy(leaseId)`,
    expired-lease reclaim). **Breaking change, legacy imza tutulmadı**
    (kullanıcı kararı: "Kararı sen ver").
  - 🔴 **BİLİNEN KIRIK DURUM:** `src/engine/PersistentStateEngine.ts:101`
    hâlâ eski `acquireProxy()` imzasını (parametresiz, `ProxyMetrics` dönen)
    çağırıyor → repo şu an **type-check'ten geçmiyor**. Entegrasyon
    (PersistentStateEngine'in yeni lease API'sine geçirilmesi) Kural 5
    gereği ayrı bir KARAR BİLDİRİMİ olarak bekliyor, sıradaki iş bu.
- **Sıradaki öncelik:** Madde #5 entegrasyonu — `PersistentStateEngine.ts`'i
  yeni `ProxyLease` API'sine geçirmek (repo'yu tekrar derlenir hale getirmek
  için bu, #23'ten önce gelmeli).

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 1 | Çift implementasyonların kaldırılması (root vs src) | mimari | kod tarafı tamam (6 dosya legacy/'ye taşındı — kapsam kullanıcı ekran görüntüsüyle düzeltildi), kullanıcı doğrulaması bekleniyor |
| 5 | Proxy lease mekanizması (AVAILABLE→LEASED→IN_USE→RELEASED) | network | network tarafı tamam (AdvancedProxyManager), engine entegrasyonu (PersistentStateEngine) açık — repo şu an bu yüzden derlenmiyor |
| 6 | Recovery concurrency — isRecovering kilidi yerine queue | engine | açık |
| 7 | Governor↔RecoveryExecutor command interface | engine | açık |
| 8 | Recovery transaction modeli (CAPTURE→...→COMMIT) | engine | açık |
| 9 | State restore validation (cookie≠authenticated) | state | açık |
| 13 | Credential/state encryption-at-rest | state/security | açık |
| 22 | Network telemetry → ProxyMetrics instrumentation bağlantısı | network | açık |
| 23 | Proxy credential/metrics izolasyonu (getAllMetrics sızıntısı) | network/security | açık — doğrulandı: getAllMetrics() username/password döndürüyor |
| 33 | IResourceAdapter/IStateObserver merkezi kullanımı | adapters | açık |

## 🟡 AÇIK MADDELER — P1

| # | Madde | Katman |
|---|---|---|
| 2 | Persistent proxy state (Redis/SQLite/PG) | network |
| 10 | State kapsamı genişletme (IndexedDB/Cache/SW) | state |
| 11 | Multi-origin state izolasyonu | state |
| 12 | State versioning / migration (StateEnvelope) | state |
| 14 | Telemetry aggregation katmanı | telemetry |
| 15 | Structured (JSON) logging | telemetry |
| 16 | Correlation ID / distributed tracing | telemetry |
| 24 | Engine lifecycle (start/stop/dispose) | engine |
| 25 | Graceful shutdown (SIGTERM/SIGINT) | engine |
| 27 | Merkezi immutable configuration | engine |
| 28 | Retry budget | policies |
| 29 | Circuit breaker (proxy/session/resource) | policies |

## 🟢 AÇIK MADDELER — P2

| # | Madde | Katman |
|---|---|---|
| 3 | Health scoring normalizasyonu + decay | network |
| 4 | Weighted proxy selection | network |
| 17 | Anomaly deduplication (TTL cache) | engine |
| 18 | 403/429 sınıflandırma pipeline'ı | policies |
| 19 | Retry-After / backoff / jitter | network |
| 20 | HTTP status observation genişletme (408/425/5xx) | network |
| 21 | DNS/TLS error mapping | network |
| 26 | Health/readiness endpoint | engine |
| 30 | Test piramidi kurulumu | test |
| 31 | State integrity testleri | test |
| 32 | Session identity / generation modeli | engine |
| 34 | BrowserContextFactory standardizasyonu | network |
| 36 | Legacy governor backoff modelinin #3/#6'ya referans olarak değerlendirilmesi | network/engine |

---

## 📌 KRİTİK TEKNİK KARARLAR

- Production kod SADECE `src/` altına yazılacak; kök dizindeki eski dosyalar
  artık `legacy/` klasöründe (Madde #1, Session 1'de taşındı) — silinmedi,
  referans amaçlı tutuluyor (bkz. Madde #36).
- Persistent proxy store için backend seçimi (Redis vs SQLite vs PostgreSQL)
  henüz kullanıcıya soruLMADI — #2 tetiklendiğinde CORE.md §3 üzerinden sorulacak.
- Secret yönetimi için SecretProvider'ın hangi kaynaktan besleneceği
  (env vs vault) henüz belirlenmedi — #13 tetiklendiğinde netleştirilecek.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

- **Madde #1** (Session 1): Root `AdaptiveGovernor.ts`, `PersistentStateEngine.ts`,
  `IResourceAdapter.ts`, `IStateObserver.ts` → `legacy/` klasörüne taşındı.
  `src/index.ts`'in zaten yalnızca `src/` import ettiği doğrulandı (davranış
  değişikliği yok). Root governor'daki cooldown/backoff tasarımı silinmeden
  Madde #36 olarak kayda geçti. **Not: kod tarafı tamam, "kapandı" statüsü
  kullanıcının repo'yu kendi ortamında doğrulamasıyla kesinleşecek.**

---

## ⚠️ DERSLER (Bowlera projesinden taşınan, bu projede de geçerli ilkeler)

- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır — bir madde sadece kod üretildi diye kapatılmaz.
- Checkpoint/onay gelmeden sohbet kesilme riski varsa madde açık kalmaya
  devam eder; bir sonraki session'da SESSION_INDEX üzerinden kaldığı yerden
  devam edilir, "sonra eklenecek" notuyla kapanış yapılmaz.
