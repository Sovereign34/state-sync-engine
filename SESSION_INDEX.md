# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 1 (kapatıldı)
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - Madde #1: dosya taşıma yapıldı (6 dosya `legacy/`'ye taşındı). Kullanıcı
    doğrulaması hâlâ bekleniyor.
  - Madde #5: network tarafı (Session öncesi `AdvancedProxyManager.ts` lease
    mekanizması) ve engine tarafı (`PersistentStateEngine.ts` entegrasyonu,
    bu session'da yapıldı) **kod tarafı tamam**. `currentProxyServer` →
    `currentLease: ProxyLease`, acquire/release sırası, `getProxyMetrics()`
    ile credential lookup, `close()`'da lease release eklendi.
    🔴 **doğrulanmadı:** kullanıcı kendi ortamında `tsc --noEmit` çalıştırmadı
    — repo'nun artık gerçekten derlendiği iddiası henüz teyitsiz.
  - Madde #6: `AdaptiveGovernor.ts`'te `processQueue()` artık her decision'ı
    (`emitDecisionAndWait()` ile) gerçekten bekleyip sıradaki kuyruk
    elemanına öyle geçiyor — "ikinci anomaly `isRecovering=true` iken
    kaybolur" bug'ı kaynağında kapatıldı. **Kod tarafı tamam**, kullanıcı
    çalışma zamanı doğrulaması (gerçek proxy ile bir recovery senaryosu
    tetiklenip tek decision'ın işlendiğinin gözlemlenmesi) bekleniyor.
- **Sıradaki öncelik:** Madde #7 (Governor↔RecoveryExecutor command
  interface) — Madde #6'nın çözdüğü sıralama artık var, ama emit/listener
  deseni hâlâ örtük; #8 (recovery transaction) buna bağımlı olduğu için
  önce #7'ye bakılması öneriliyor. Kesin karar bir sonraki session'da
  kullanıcıyla birlikte verilecek.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 1 | Çift implementasyonların kaldırılması (root vs src) | mimari | kod tarafı tamam, kullanıcı doğrulaması bekleniyor |
| 5 | Proxy lease mekanizması (AVAILABLE→LEASED→IN_USE→RELEASED) | network/engine | kod tarafı tamam (network + engine entegrasyonu), kullanıcı derleme doğrulaması bekleniyor |
| 6 | Recovery concurrency — isRecovering kilidi yerine queue | engine | kod tarafı tamam (Governor artık decision'ları sıralı/awaited işliyor), kullanıcı çalışma zamanı doğrulaması bekleniyor |
| 7 | Governor↔RecoveryExecutor command interface | engine | açık — sıradaki öncelik |
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
| 32 | Session identity / generation modeli | engine — Madde #5 entegrasyonunda geçici `sessionId` üretimi eklendi (`Math.random().toString(36)`), gerçek model hâlâ burada ele alınacak |
| 34 | BrowserContextFactory standardizasyonu | network |
| 36 | Legacy governor backoff modelinin #3/#6'ya referans olarak değerlendirilmesi | network/engine |

---

## 📌 KRİTİK TEKNİK KARARLAR

- Production kod SADECE `src/` altına yazılacak; kök dizindeki eski dosyalar
  `legacy/` klasöründe (Madde #1, Session 1'de taşındı) — silinmedi, referans
  amaçlı tutuluyor (bkz. Madde #36).
- Madde #5 entegrasyonunda proxy acquisition fail olursa "eski lease zaten
  bırakılmış olur" riski bilinçli olarak kapsam dışı bırakıldı — Madde #8
  (recovery transaction modeli) bunu tam çözecek.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edildi — tek bir
  hatalı decision handling'i tüm kuyruğu durdurmuyor.
- Persistent proxy store için backend seçimi (Redis vs SQLite vs PostgreSQL)
  henüz kullanıcıya soruLMADI — #2 tetiklendiğinde CORE.md §3 üzerinden sorulacak.
- Secret yönetimi için SecretProvider'ın hangi kaynaktan besleneceği
  (env vs vault) henüz belirlenmedi — #13 tetiklendiğinde netleştirilecek.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

- **Madde #1** (Session 1): Root `AdaptiveGovernor.ts`, `PersistentStateEngine.ts`,
  `IResourceAdapter.ts`, `IStateObserver.ts` → `legacy/` klasörüne taşındı.
  `src/index.ts`'in zaten yalnızca `src/` import ettiği doğrulandı (davranış
  değişikliği yok). **Not: kod tarafı tamam, "kapandı" statüsü kullanıcının
  repo'yu kendi ortamında doğrulamasıyla kesinleşecek.**
- **Madde #5 — engine entegrasyonu** (Session 1): `PersistentStateEngine.ts`
  yeni `ProxyLease` API'sine geçirildi (`currentProxyServer` → `currentLease`,
  sabit `sessionId`, acquire/release sırası, `getProxyMetrics()` ile credential
  lookup, `close()`'da lease release). **Not: kod tarafı tamam, kullanıcının
  `tsc --noEmit` ile derleme doğrulaması bekleniyor.**
- **Madde #6** (Session 1): `AdaptiveGovernor.processQueue()` artık her
  decision'ı `emitDecisionAndWait()` ile bekleyip öyle bir sonrakine geçiyor;
  "ikinci anomaly kaybolur" bug'ı kaynağında kapatıldı. **Not: kod tarafı
  tamam, kullanıcının çalışma zamanında (gerçek recovery senaryosu ile)
  doğrulaması bekleniyor.**

---

## ⚠️ DERSLER (Bowlera projesinden taşınan, bu projede de geçerli ilkeler)

- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır — bir madde sadece kod üretildi diye kapatılmaz.
- Checkpoint/onay gelmeden sohbet kesilme riski varsa madde açık kalmaya
  devam eder; bir sonraki session'da SESSION_INDEX üzerinden kaldığı yerden
  devam edilir, "sonra eklenecek" notuyla kapanış yapılmaz.
