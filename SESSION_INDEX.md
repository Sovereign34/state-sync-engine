# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 3 (devam ediyor)
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - Madde #7: **kod tarafı tamam + derleme doğrulandı.** `git pull`
    ile `AdaptiveGovernor.ts` (+++---, 34 satır) ve `PersistentStateEngine.ts`
    (++--, 24 satır) değişiklikleri repoya gerçekten yansımış (fast-forward
    ile teyit edildi, iddia değil). Değişiklik:
    - `PersistentStateEngine`, `RecoveryCommandPort`'u gerçekten implement
      ediyor (`handleDecision()` metodu, mevcut `handleGovernorDecision`
      mantığını kullanarak).
    - Constructor'da `governor.setCommandPort(this)` ile kendini enjekte
      ediyor.
    - `AdaptiveGovernor`'a constructor-zamanı zorunluluğu olmayan bir
      `setCommandPort()` setter eklendi.
    - Eski `.on('decision', ...)` kaydı **kaldırıldı**.
    - `npx tsc --noEmit` **çalıştırıldı ve ekran görüntüsüyle teyit edildi**
      — komut ile sıradaki `$` istemi arasında hata satırı yok, Codespaces
      durum çubuğu 0 hata gösteriyor. **Runtime doğrulaması hâlâ açık.**
  - Madde #6, #8, #9, #13, #22, #23, #33: Session 2'den değişmedi (aşağıdaki
    tabloya bakınız).
- **Sıradaki öncelik:** #6/#7/#8'in üçünün birden runtime doğrulaması
  (gerçek bir anomaly/recovery senaryosu tetiklenerek) veya Madde #9
  (state restore validation) — kullanıcıya sorulmalı.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 6 | Recovery concurrency — isRecovering kilidi yerine queue | engine | kod tarafı tamam, derleme doğrulandı, runtime doğrulaması bekleniyor |
| 7 | Governor↔RecoveryExecutor command interface | engine | kod tarafı tamam + derleme doğrulandı (port artık `PersistentStateEngine.handleDecision()` ile implement ediliyor, `AdaptiveGovernor.setCommandPort()` eklendi, legacy `.on('decision',...)` kaldırıldı, `tsc --noEmit` temiz) — runtime doğrulaması bekleniyor |
| 8 | Recovery transaction modeli (CAPTURE→...→COMMIT) | engine | kod tarafı tamam (make-before-break transaction), derleme ve runtime doğrulaması bekleniyor |
| 9 | State restore validation (cookie≠authenticated) | state | açık |
| 13 | Credential/state encryption-at-rest | state/security | açık |
| 22 | Network telemetry → ProxyMetrics instrumentation bağlantısı | network | açık |
| 23 | Proxy credential/metrics izolasyonu (getAllMetrics sızıntısı) | network/security | açık — doğrulandı: `getAllMetrics(): ProxyMetrics[]` username/password dahil tüm alanları çıplak döndürüyor |
| 33 | IResourceAdapter/IStateObserver merkezi kullanımı | adapters | açık — `RecoveryCommandPort` bu sözleşmelerle çakışmıyor (ikisi de gözlem odaklı, port karar-iletim odaklı) |

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
  `legacy/` klasöründe (Madde #1) — silinmedi, referans amaçlı tutuluyor.
- Repo kökünde `tsconfig.json` (`target: ES2020`, `module: Node16`,
  `moduleResolution: Node16`, `types: ["node"]`, `strict: true`,
  `skipLibCheck: true`, `legacy/` ve test dosyaları `exclude`'da).
- **Domain tiplerinin (SemanticAnomaly/AnomalyScope/GovernorAction/ProxyLease/
  ProxyMetrics/PreservedSessionState/GovernorDecisionEvent/RecoveryCommandPort)
  TEK merkezi kaynağı `src/types/governor-command.types.ts`.**
  `src/types/index.ts` bunu re-export eder; production entrypoint `src/index.ts`'tir.
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de re-export ediliyor.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edilmişti;
  Madde #7 ile birlikte legacy `.on('decision', ...)` yolu **kaldırıldı**,
  tek yol `RecoveryCommandPort` (`setCommandPort` ile enjekte edilen
  `PersistentStateEngine`) oldu. `Promise.allSettled`'ın artık tek bir port
  beklerken hâlâ anlamlı olup olmadığı — runtime doğrulaması sırasında
  gözden geçirilmeli (dosya içeriği henüz bu session'a yüklenmedi, sadece
  git diff istatistiği ve tsc sonucu görüldü).
- Persistent proxy store için backend seçimi henüz kullanıcıya sorulmadı.
- Secret yönetimi kaynağı (env vs vault) henüz belirlenmedi.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

- **Madde #1** (Session 1 kod, Session 2'de gerçek kapanış).
- **Madde #5** (Session 1 kod, Session 2 doğrulama — KAPANDI).
- **Madde #6** (Session 1 kod, Session 2 derleme doğrulaması) — runtime
  doğrulaması hâlâ açık.
- **Madde #7 — derleme doğrulaması** (Session 3): `PersistentStateEngine`
  `RecoveryCommandPort`'u implement etti, `AdaptiveGovernor.setCommandPort()`
  eklendi, legacy `.on('decision',...)` kaldırıldı. `git pull` diff
  istatistiği ve `tsc --noEmit` ekran görüntüsüyle teyit edildi (temiz,
  0 hata). Madde tam kapanmadı — runtime doğrulaması hâlâ P0 tablosunda açık.

---

## ⚠️ DERSLER (Bowlera projesinden taşınan + eklenen)

- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır.
- Derleme (`tsc --noEmit`) başarısı da tek başına yeterli değildir.
- Checkpoint/onay gelmeden madde kapanış yapılmaz.
- Bir maddenin "kapandı" yazması, dosyaların gerçekten iddia edilen
  konumda/durumda olduğunu KANITLAMAZ — `find`/`git show`/gerçek komut
  çıktısı ile doğrulanmalı.
- Aynı dosya adının farklı klasörlerde farklı anlama gelmesi karışıklığa
  yol açar — tam yol istenmeli.
- Tip tanımı varsayımla yazılan bir dosya her zaman "geçici" sayılmalı.
- Mobil terminalde `cat` ile uzun dosya okumak güvenilir değil.
- **(Yeni)** Bir session'ın kapanışında "şunu yapıyorum / şu komutu
  çalıştırıyorum" şeklinde bildirilen bir eylem, komutun **gerçek çıktısı**
  paylaşılmadan bir sonraki session'da "doğrulandı" sayılmamalı — niyet
  beyanı ile gerçekleşmiş sonuç arasındaki fark, tam da bu projenin var
  olma sebebi olan ayrımdır.
