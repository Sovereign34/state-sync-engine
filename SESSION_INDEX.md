# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 2 (kapanıyor)
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - Madde #1: **KAPANDI.** Bu session'da `legacy/AdaptiveGovernor.ts` ve
    `legacy/PersistentStateEngine.ts` gerçekten `src/engine/`'e taşındı
    (Session 1'de sadece "taşındı" diye işaretlenmişti ama `find`/`git show`
    ile doğrulanınca üretim kodunun hâlâ `legacy/`'de yaşadığı ortaya çıktı —
    bu, Session 1'in eksik kapanışıydı, şimdi gerçekten düzeltildi). Ayrıca
    `src/types/index.ts` adında yanlış konumda duran bir dosyanın aslında
    production entrypoint (`EngineFactory`) olduğu bulundu — `src/index.ts`'e
    taşındı, `src/types/index.ts` artık gerçekten sadece domain tiplerini
    (`governor-command.types.ts` re-export) taşıyor. `npx tsc --noEmit`
    temiz geçti.
  - Madde #5: kapalı (Session 1/2'de kapatılmıştı, bu session'da dokunulmadı).
  - Madde #6: kod tarafı tamam + derleme doğrulandı (değişmedi). **Runtime
    doğrulaması hâlâ bekliyor.**
  - Madde #7: **kod tarafı tamam + derleme doğrulandı.** `RecoveryCommandPort`
    arayüzü (`src/types/governor-command.types.ts`) eklendi, `AdaptiveGovernor`
    artık hem legacy `.on('decision', ...)` dinleyicilerini hem de (varsa)
    enjekte edilmiş `RecoveryCommandPort`'u aynı `Promise.allSettled` turunda
    bekliyor — `PersistentStateEngine.ts` güncellenmeden geriye dönük uyumlu
    kaldı. **Runtime doğrulaması açık** (port'u gerçekten implement eden bir
    tüketici henüz yok — sadece legacy path aktif olarak çalışıyor).
  - **Yan bulgu (bu session'da ortaya çıktı, ayrı madde numarası yok):**
    `SemanticAnomaly` / `AnomalyScope` / `GovernorAction` / `ProxyLease` /
    `ProxyMetrics` / `PreservedSessionState` tiplerinin merkezi bir kaynağı
    hiç var olmamış (kullanım noktaları vardı, tanım dosyası yoktu). Bu
    session'da `src/types/governor-command.types.ts` bu tiplerin gerçek
    kaynağı olarak yazıldı — önce varsayımla (YANLIŞ çıktı: `AnomalyScope`
    gerçekte `SESSION/IP/INFRASTRUCTURE`, ben `SESSION/PROXY/GLOBAL`
    varsaymıştım), sonra `PersistentStateEngine.ts` ve
    `AdvancedProxyManager.ts`'in tam içeriği görülerek düzeltildi.
    `npx tsc --noEmit` sıfır hatayla doğruladı.
  - **Push durumu:** Kullanıcı tarafından teyit edildi — `git push` başarılı.
  - Madde #8: **kod tarafı tamam.** `createSessionWithFreshState()`
    "release-then-acquire"den "acquire-then-commit" (make-before-break)
    transaction modeline geçirildi — yeni proxy/context/page tamamen hazır
    olup commit edilene kadar eski context/lease'e dokunulmuyor; herhangi
    bir adım patlarsa yeni kaynaklar rollback edilir, eski oturum bozulmadan
    kalır. `captureCurrentState`/`applyPreservedState`, `this.context`/
    `this.page` okuyan yan etkili metodlardan parametre alan saf
    fonksiyonlara (`captureState`/`applyState`) dönüştürüldü. **Derleme
    doğrulaması henüz yapılmadı** (kullanıcı `tsc --noEmit` çalıştırmadı).
    **Davranış değişikliği:** proxy release sırası tersine döndü — artık
    `ROTATE_SESSION_ONLY` aynı proxy'yi geri seçemiyor (öncesinde
    mümkündü), gerçek rotasyon garanti ediliyor.
- **Sıradaki öncelik:** Kullanıcının `tsc --noEmit` çalıştırıp Madde #8'in
  derlemesini doğrulaması. Ardından #7/#6/#8'in üçünün de runtime
  doğrulaması (gerçek bir anomaly/recovery senaryosu tetiklenerek) veya
  Madde #9 (state restore validation) — kullanıcıya sorulmalı.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 6 | Recovery concurrency — isRecovering kilidi yerine queue | engine | kod tarafı tamam, derleme doğrulandı, runtime doğrulaması bekleniyor |
| 7 | Governor↔RecoveryExecutor command interface | engine | kod tarafı tamam, derleme doğrulandı (`tsc --noEmit` temiz), runtime doğrulaması bekleniyor (port'u implement eden gerçek bir tüketici yok) |
| 8 | Recovery transaction modeli (CAPTURE→...→COMMIT) | engine | kod tarafı tamam (make-before-break transaction), derleme ve runtime doğrulaması bekleniyor |
| 9 | State restore validation (cookie≠authenticated) | state | açık |
| 13 | Credential/state encryption-at-rest | state/security | açık |
| 22 | Network telemetry → ProxyMetrics instrumentation bağlantısı | network | açık |
| 23 | Proxy credential/metrics izolasyonu (getAllMetrics sızıntısı) | network/security | açık — doğrulandı: `getAllMetrics(): ProxyMetrics[]` username/password dahil tüm alanları çıplak döndürüyor (bu session'da tipi netleşti, izolasyonu hâlâ çözülmedi) |
| 33 | IResourceAdapter/IStateObserver merkezi kullanımı | adapters | açık — bu session'da kontrol edildi, `RecoveryCommandPort` bu sözleşmelerle çakışmıyor (ikisi de gözlem odaklı, port karar-iletim odaklı) |

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
  `legacy/` klasöründe (Madde #1, Session 1'de taşındı, Session 2'de
  gerçekten tamamlandı — bkz. Kapanan Maddeler Geçmişi) — silinmedi, referans
  amaçlı tutuluyor (bkz. Madde #36).
- Repo kökünde `tsconfig.json` yoktu — Session 2'de eklendi (`target: ES2020`,
  `module: Node16`, `moduleResolution: Node16`, `types: ["node"]`,
  `strict: true`, `skipLibCheck: true`, `legacy/` ve test dosyaları
  `exclude`'da). `moduleResolution: "node"` artık TS'te `node10`'un takma adı
  ve kaldırıldı — `Node16` kullanılmalı, `module` da aynı değere ayarlı olmak
  zorunda.
- **Domain tiplerinin (SemanticAnomaly/AnomalyScope/GovernorAction/ProxyLease/
  ProxyMetrics/PreservedSessionState/GovernorDecisionEvent/RecoveryCommandPort)
  TEK merkezi kaynağı `src/types/governor-command.types.ts`.**
  `src/types/index.ts` bunu `export * from './governor-command.types'` ile
  dışa aktarır — `src/types/index.ts`'i asla production entrypoint (`EngineFactory`
  vb.) için kullanma, o `src/index.ts`'te yaşıyor. Bu iki dosyanın aynı isimle
  (`index.ts`) farklı klasörlerde bulunması Session 2'de uzun bir karışıklığa
  yol açtı (bkz. Dersler).
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de `export type { ... }` ile re-export ediliyor — `PersistentStateEngine.ts`
  bu tipi hâlâ `from './AdaptiveGovernor'` şeklinde import ediyor, tek kaynak
  ama iki erişim yolu.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edildi — tek bir
  hatalı decision handling'i tüm kuyruğu durdurmuyor. Madde #7 bu mekanizmayı
  genişletti: legacy listener'lar VE (varsa) `RecoveryCommandPort` aynı
  `Promise.allSettled` turunda bekleniyor.
- Persistent proxy store için backend seçimi (Redis vs SQLite vs PostgreSQL)
  henüz kullanıcıya soruLMADI — #2 tetiklendiğinde CORE.md §3 üzerinden sorulacak.
- Secret yönetimi için SecretProvider'ın hangi kaynaktan besleneceği
  (env vs vault) henüz belirlenmedi — #13 tetiklendiğinde netleştirilecek.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

- **Madde #1** (Session 1 kod, Session 2'de gerçek kapanış): Session 1'de
  "kod tarafı tamam" diye işaretlenmişti ama Session 2'de `find`/`git show`
  ile doğrulanınca `AdaptiveGovernor.ts` ve `PersistentStateEngine.ts`'in
  hâlâ `legacy/`'de yaşadığı, `src/engine/`'in hiç var olmadığı ortaya çıktı.
  Bu session'da her ikisi de `git mv` ile `src/engine/`'e taşındı; ayrıca
  yanlış konumdaki `src/types/index.ts` (aslında production entrypoint)
  `src/index.ts`'e taşındı. `npx tsc --noEmit` temiz geçti — **gerçekten
  kapandı.**
- **Madde #5** (Session 1 kod, Session 2 doğrulama — KAPANDI):
  `PersistentStateEngine.ts` yeni `ProxyLease` API'sine geçirildi.
  Kullanıcı `tsconfig.json` ekleyip `npx tsc --noEmit` çalıştırdı — temiz
  geçti.
- **Madde #6** (Session 1 kod, Session 2 derleme doğrulaması): `AdaptiveGovernor
  .processQueue()` artık her decision'ı `emitDecisionAndWait()` ile bekleyip
  öyle bir sonrakine geçiyor. Derleme temiz ama **runtime doğrulaması hâlâ
  açık.**

---

## ⚠️ DERSLER (Bowlera projesinden taşınan + bu session'da eklenen)

- "Kod yazıldı" ile "kullanıcı gerçekten kullanabiliyor" ayrı doğrulama
  noktalarıdır — bir madde sadece kod üretildi diye kapatılmaz.
- Derleme (`tsc --noEmit`) başarısı da tek başına yeterli değildir — sadece
  tip hatası olmadığını kanıtlar, çalışma zamanı davranışını kanıtlamaz;
  ikisi ayrı kapanış koşuludur.
- Checkpoint/onay gelmeden sohbet kesilme riski varsa madde açık kalmaya
  devam eder; bir sonraki session'da SESSION_INDEX üzerinden kaldığı yerden
  devam edilir, "sonra eklenecek" notuyla kapanış yapılmaz.
- **(Yeni) Bir maddenin SESSION_INDEX'te "kapandı" yazması, dosyaların
  gerçekten iddia edilen konumda olduğunu KANITLAMAZ.** Session 2'de Madde
  #1'in "kod tarafı tamam" iddiası, gerçek `find`/`git show` çıktısıyla
  çürütüldü — production kod hâlâ `legacy/`'deydi. Bir sonraki session bir
  maddeyi "zaten kapalı" varsayıp üzerine inşa etmeden önce, en azından
  dosya konumunu tek bir `find`/`ls` ile doğrulamalı.
- **(Yeni) Aynı dosya adının (`index.ts`) farklı klasörlerde farklı anlamlara
  gelmesi ciddi karışıklığa yol açar.** `src/types/index.ts` ile
  `src/index.ts` defalarca birbirine karıştırıldı çünkü ikisi de sadece
  "index.ts" diye anılıyordu. Belirsiz bir dosya isteğinde her zaman TAM
  yol istenmeli, sadece dosya adı değil.
- **(Yeni) Tip tanımı bulunamadığında kullanıcının "sen yaz" demesi, o
  tipin varsayımla doğru yazılacağı anlamına gelmez.** Bu session'da
  `governor-command.types.ts` ilk yazıldığında `AnomalyScope` değerleri
  yanlış tahmin edildi (`SESSION/PROXY/GLOBAL` yerine gerçeği
  `SESSION/IP/INFRASTRUCTURE`). Varsayımla yazılan bir tip dosyası her
  zaman "geçici" sayılmalı — gerçek tüketici dosyaların (bu örnekte
  `PersistentStateEngine.ts`, `AdvancedProxyManager.ts`) tam içeriği
  görülene kadar kapanış iddia edilmemeli.
- **(Yeni) Mobil terminalde `cat` ile uzun dosya okumak güvenilir değil**
  (scrollback dosyanın başını kaybediyor, aynı ekran görüntüsü tekrar
  paylaşılabiliyor). Uzun dosyalar için editörden aç → tümünü seç → kopyala
  → mesaj olarak yapıştır yöntemi çok daha güvenilir sonuç verdi.
