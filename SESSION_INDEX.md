# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 2 (devam ediyor)
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - Madde #1: kod tarafı tamam (6 dosya `legacy/`'ye taşındı), kullanıcı
    doğrulaması hâlâ bekleniyor.
  - Madde #5: **kapandı.** Kullanıcı kendi Codespace ortamında `tsconfig.json`
    ekleyip `npx tsc --noEmit` çalıştırdı — sıfır hata, temiz çıktı. Bilinen
    "repo derlenmiyor" durumu gerçek kanıtla kapatıldı.
  - Madde #6: kod tarafı tamam + **derleme doğrulandı** (aynı `tsc --noEmit`
    çalıştırması). **Runtime doğrulaması hâlâ bekliyor** — derleme,
    concurrency düzeltmesinin (ikinci anomaly'nin artık kaybolmadığının)
    gerçekten çalıştığını göstermez; bunun için gerçek bir anomaly/recovery
    senaryosu tetiklenmesi gerekiyor. Bu yüzden madde henüz kapatılmadı.
- **Sıradaki öncelik:** Madde #7 (Governor↔RecoveryExecutor command
  interface).

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 1 | Çift implementasyonların kaldırılması (root vs src) | mimari | kod tarafı tamam, kullanıcı doğrulaması bekleniyor |
| 6 | Recovery concurrency — isRecovering kilidi yerine queue | engine | kod tarafı tamam, derleme doğrulandı (`tsc --noEmit` temiz), runtime doğrulaması bekleniyor |
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
- Repo kökünde `tsconfig.json` yoktu — Session 2'de eklendi (`target: ES2020`,
  `module: CommonJS`, `strict: true`, `skipLibCheck: true`, `legacy/` ve test
  dosyaları `exclude`'da). Bu, 36 maddenin önkoşulu olan bir altyapı ekiydi,
  ayrı bir madde numarası almadı.
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
  **Not: kod tarafı tamam, "kapandı" statüsü kullanıcının repo'yu kendi
  ortamında doğrulamasıyla kesinleşecek.**
- **Madde #5** (Session 1 kod, Session 2 doğrulama — **KAPANDI**):
  `PersistentStateEngine.ts` yeni `ProxyLease` API'sine geçirildi
  (`currentProxyServer` → `currentLease`, sabit `sessionId`, acquire/release
  sırası, `getProxyMetrics()` ile credential lookup, `close()`'da lease
  release). Kullanıcı Session 2'de `tsconfig.json` ekleyip `npx tsc --noEmit`
  çalıştırdı — temiz geçti. Repo artık gerçekten derleniyor, kanıtlandı.
- **Madde #6** (Session 1 kod, Session 2 derleme doğrulaması): `AdaptiveGovernor
  .processQueue()` artık her decision'ı `emitDecisionAndWait()` ile bekleyip
  öyle bir sonrakine geçiyor. Derleme temiz geçti ama **runtime doğrulaması
  hâlâ açık** — concurrency düzeltmesi ancak gerçek bir anomaly/recovery
  senaryosuyla gözlemlenebilir, bu yüzden madde kapatılmadı.

---

## ⚠️ DERSLER (Bowlera projesinden taşınan, bu projede de geçerli ilkeler)

- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır — bir madde sadece kod üretildi diye kapatılmaz.
- Derleme (`tsc --noEmit`) başarısı da tek başına yeterli değildir — sadece
  tip hatası olmadığını kanıtlar, çalışma zamanı davranışını (özellikle
  concurrency/timing bug'larını) kanıtlamaz; ikisi ayrı kapanış koşuludur.
- Checkpoint/onay gelmeden sohbet kesilme riski varsa madde açık kalmaya
  devam eder; bir sonraki session'da SESSION_INDEX üzerinden kaldığı yerden
  devam edilir, "sonra eklenecek" notuyla kapanış yapılmaz.
