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
  - **Madde #6, #7, #8: KAPANDI.** Tam ayrıntı `session_arşiv.md`'de
    (Taşıma 3) — özet: `runtime-check.ts` ile mock doğrulama, 2/2 test PASS,
    gerçek Playwright/proxy entegrasyonu KAPSAM DIŞI kaldı.
  - **Madde #9 — alt-bug kısmı KAPANDI (mock), gerçek entegrasyon ERTELENDİ.**
    Tam ayrıntı `session_arşiv.md`'de (Taşıma 3) — özet: re-entrancy guard
    fix'i (`queueMicrotask`) mock ortamda tam doğrulandı, gerçek ortam
    entegrasyon testi kullanıcı kararıyla **projenin sonuna ertelendi**, #9
    P0 tablosunda AÇIK kalmaya devam ediyor.
  - **Madde #23: KAPANDI.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 3).
  - **Süreç dışı `authValidator` wiring bug'ı — TAM KAPANDI.** Tam ayrıntı
    `session_arşiv.md`'de (Taşıma 2/3).
  - **Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3).** Tam
    ayrıntı `session_arşiv.md`'de (Taşıma 4) — özet: THROTTLE,
    ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY → hepsi doğru
    tip-guard'larla `markFailed`'e bağlı; başarı yolu `recordSuccess`'e
    guard'lı bağlı. `runtime-check.ts` (TEST 1-5, hepsi PASS) ve
    `npx tsc --noEmit` (0 hata) ile runtime + derleme seviyesinde
    doğrulandı. Madde P0 tablosundan kaldırıldı.
  - **(Yeni) `PersistentStateEngine.ts` debug-temiz sürüm: kullanıcı
    tarafından repo'ya uygulandığı TEYİT EDİLDİ** (debug `console.log`
    temizliği onaylanmış, kod son haline getirilmiş).
  - **Madde #13 — Credential/state encryption-at-rest: TAM KAPANDI
    (Session 3).** Tam ayrıntı Kapanan Maddeler Geçmişi'nde — özet:
    `SecretProvider` + `ProxyCredentialStore` entegrasyonu tamamlandı,
    `runtime-check-persistence.ts` 4/4 PASS, `npx tsc --noEmit; echo
    "EXIT CODE: $?"` ile **EXIT CODE: 0** ekran görüntüsüyle teyit edildi.
    Madde P0 tablosundan kaldırıldı. **Kapsam dışı bırakılan açık takip
    (madde'nin kendisi değil, ayrı görev):** composition-root wiring
    (`credentialStore`'u kimin oluşturup enjekte edeceği) ve `package.json`'a
    `better-sqlite3`/`@types/better-sqlite3` eklenmesi hâlâ görülmedi —
    bkz. Sıradaki Öncelik.
  - **(Yeni) Madde #33 — TAM KAPANDI (Session 3).** Tam ayrıntı Kapanan
    Maddeler Geçmişi'nde — özet: `crash`/`requestfailed` artık ham
    `page.on(...)` DEĞİL, `IStateObserver` sözleşmesi üzerinden geliyor.
    Sözleşmeye jenerik `PROCESS_CRASHED`/`NETWORK_ERROR` değerleri eklendi
    (governor tarafının `PAGE_CRASH`/`NETWORK_FAILURE` isimleriyle kasıtlı
    olarak FARKLI, isim çakışması önlendi). `translateObserverAnomaly()`
    bu iki yeni tipi karşılıyor. Doğrulama: `runtime-check-observer.ts` ile
    **6/6 PASS** (crash→PROCESS_CRASHED, net::ERR_→NETWORK_ERROR +
    rawError/sourceUrl doğru taşınıyor, filtre dışı hata emit edilmiyor,
    `stop()` sonrası dinleme kesiliyor), `npx tsc --noEmit; echo "EXIT
    CODE: $?"` → **EXIT CODE: 0**. Madde P0 tablosundan kaldırıldı.
  - **(Yeni) Madde #2 — Persistent proxy state: TAM KAPANDI (Session 3).**
    Tam ayrıntı Kapanan Maddeler Geçmişi'nde — özet: yeni `ProxyHealthStore`
    (`src/state/ProxyHealthStore.ts`) proxy health/quarantine alanlarını
    credential store ile aynı DB dosyasında ayrı `proxy_health` tablosunda
    kalıcı hale getiriyor; yazma sadece `markFailed()` içinde `quarantineUntil`
    güncellendiği anda tetikleniyor (write-through değil), TTL = 24 saat
    (kullanıcı onayıyla sabitlendi). Doğrulama: `runtime-check-health.js`
    ile **6/6 PASS** (runtime) + `npx tsc --noEmit` → **EXIT CODE: 0**
    (derleme) ekran görüntüleriyle teyit edildi. Madde P1 tablosundan
    kaldırıldı. **Housekeeping (kullanıcı onayıyla):** derlenmiş
    `runtime-check-health.js` repo kökünden silindi (diğer
    `runtime-check-*` dosyaları gibi yalnızca `.ts` kaynağı kalıyor).
  - **(Yeni) Madde #15 — Structured (JSON) logging: TAM KAPANDI (Session 3).**
    Tam ayrıntı Kapanan Maddeler Geçmişi'nde — özet: `src/telemetry/`
    katmanı (`ILogger` sözleşmesi + `ConsoleJsonLogger` implementasyonu)
    eklendi ve 3 tüketici dosya (`ProxyHealthStore.ts`,
    `PersistentStateEngine.ts`, `index.ts`) ayrı ayrı KARAR BİLDİRİMİ'leriyle
    güncellendi — repo genelinde düz `console.*` çağrısı kalmadı (toplam 11
    çağrı; `PersistentStateEngine.ts`'te grep'in gösterdiği 5 değil, dosyada
    gerçekten bulunan 7 çağrı temel alındı). Doğrulama: izole
    `runtime-check-logger.ts` ile **4/4 PASS** (seviye→doğru console metodu,
    `meta` çekirdek alanları ezemiyor, circular `meta` throw etmeden
    `metaSerializationError:true` ile düşüyor, `meta` verilmeyince ekstra
    alan sızmıyor) + repo genelinde `npx tsc --noEmit; echo "EXIT CODE: $?"`
    → **EXIT CODE: 0** (3 tüketici dosya dahil). Madde P1 tablosundan
    kaldırıldı. **Kapsam dışı bırakılan açık takipler:** (a) log seviyesi
    filtreleme (env var ile min-level) — muhtemelen Madde #27 (config) ile
    birleşecek; (b) `runtime-check-logger.ts` içindeki TEST 5
    (`ProxyHealthStore` entegrasyon testi) Kural #5 gereği bu turdan
    çıkarıldı, `better-sqlite3` kurulum eksikliğine bağımlı hale
    getirilmedi — Madde #13/#2'nin zaten açık olan composition-root
    takibiyle birleşiyor.
- **Sıradaki öncelik:** P0 tablosunda hâlâ sadece **#9** açık — gerçek
  entegrasyon testi kullanıcı kararıyla ertelenmiş, aktif çalışılmıyor.
  Fiilen P0'da aktif iş yok. Madde #2 ve #15'in kapanmasıyla P1'den seçim
  daha da daraldı; sıradaki iş kullanıcının önceliğine bağlı: (a) #9'un
  ertelenmiş testine şimdi mi dönülsün; (b) P1'den yeni bir madde mi seçilsin
  (öneri: **#24** Engine lifecycle ya da **#27** Merkezi immutable
  configuration — #27 artık Madde #15'in ertelediği log-level filtreleme
  ile de bağlantılı); (c) Madde #13/#2'nin kapsam dışı bırakılan ortak açık
  takibi mi ele alınsın — composition-root wiring ve `better-sqlite3`
  bağımlılığı (bu ihtiyaç artık üç madde — #13, #2 ve kısmen #15'in
  ertelenen TEST 5'i — için aynı composition-root noktasında geçerli, aynı
  `dbPath` sorusu hâlâ açık). Ayrıca hâlâ açık: #9 vs #17 etiket
  tutarsızlığı sorusu (bkz. ❓ Cevap Bekleyen Sorular).
- **⚠️ Dosya boyutu notu:** Bu dosya şu an ~430 satır, 400 satır eşiğini
  (CORE.md §7.1 / Kural #11) yeniden aşmış durumda. Bu turda arşivleme
  YAPILMADI çünkü `session_arşiv.md`'nin güncel içeriği bu oturumda
  paylaşılmadı — Taşıma 5'i güvenle ekleyebilmek için önce mevcut
  `session_arşiv.md` dosyasının paylaşılması gerekiyor. Bir sonraki session
  açılışında bu adım öncelikli yapılmalı (madde silme/özetleme değil, TAM
  taşıma).

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. Ya yorum yanlış etiketlenmiş ya da #17 kısmen zaten çözülmüş ve
  tabloya yansımamış. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu
  yanıt gelmeden değiştirilmedi.
- ~~`FULL_RECOVERY`/`AUTH_VALIDATION_FAILED` düzeltmesi doğrulama yöntemi:
  `tsc --noEmit` yeterli mi, yoksa TEST 5 mi eklensin?~~ — **fiilen
  TEST 5 eklenerek çözüldü**: hem `tsc --noEmit` (0 hata) hem
  `runtime-check.ts` TEST 5a/5b (PASS) ile doğrulandı, madde #22 kapandı.
- ~~`PersistentStateEngine.ts` (debug-log temizlenmiş sürüm) repo'ya
  uygulandı mı?~~ — **kullanıcı teyit etti: evet, uygulandı**.
- ~~Madde #13 — `npx tsc --noEmit` gerçekten 0 hata mı döndü?~~ —
  **çözüldü**: `EXIT CODE: 0` ekran görüntüsüyle teyit edildi.
- ~~Madde #33 — crash/requestfailed IStateObserver'a nasıl taşınacak,
  AnomalyType genişletilecek mi?~~ — **çözüldü**: kullanıcı onayıyla
  `PROCESS_CRASHED`/`NETWORK_ERROR` eklendi, `runtime-check-observer.ts`
  6/6 PASS + `EXIT CODE: 0` ile doğrulandı.
- ~~Madde #2 — TTL süresi (24 saat) production için uygun mu, housekeeping
  (`runtime-check-health.js`) silinsin mi?~~ — **kullanıcı onayladı**: TTL
  24 saat sabitlendi, dosya silindi.
- ~~Madde #15 — `ILogger` enjeksiyon şekli (opsiyonel + varsayılan
  `ConsoleJsonLogger`) ve `index.ts` demo bloğundaki `console.*`'ların da
  taşınıp taşınmayacağı?~~ — **fiilen çözüldü**: 3 tüketici dosya (demo
  bloğu dahil `index.ts`) merkezi `ILogger`'ı kullanacak şekilde
  güncellendi, tutarlılık tercih edildi; opsiyonel/varsayılan enjeksiyon
  deseni değişmeden uygulandı ve testlerle doğrulandı.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 9 | State restore validation (cookie≠authenticated) | state | açık — re-entrancy alt-bug'ı (guard'ın senkron zincirle atlanması) `queueMicrotask` fix'i ile giderildi ve mock runtime testinde tam doğrulandı (ikinci gizli hata yok, grep ile teyit edildi); **gerçek entegrasyon testi (mock'suz Playwright/proxy/DefaultAuthValidator) kullanıcı kararıyla projenin sonuna ertelendi** — madde bu nedenle açık kalıyor, şu an aktif çalışılmıyor |

## 🟡 AÇIK MADDELER — P1

| # | Madde | Katman |
|---|---|---|
| 10 | State kapsamı genişletme (IndexedDB/Cache/SW) | state |
| 11 | Multi-origin state izolasyonu | state |
| 12 | State versioning / migration (StateEnvelope) | state |
| 14 | Telemetry aggregation katmanı | telemetry |
| 16 | Correlation ID / distributed tracing | telemetry |
| 24 | Engine lifecycle (start/stop/dispose) | engine |
| 25 | Graceful shutdown (SIGTERM/SIGINT) | engine |
| 27 | Merkezi immutable configuration | engine — artık Madde #15'in ertelediği log-level filtreleme kararıyla da bağlantılı |
| 28 | Retry budget | policies |
| 29 | Circuit breaker (proxy/session/resource) | policies |

## 🟢 AÇIK MADDELER — P2

| # | Madde | Katman |
|---|---|---|
| 3 | Health scoring normalizasyonu + decay | network |
| 4 | Weighted proxy selection | network |
| 17 | Anomaly deduplication (TTL cache) | engine — kod yorumunda #9 diye yanlış etiketlenmiş olabilir, bkz. yukarıdaki "Cevap Bekleyen Sorular"; kullanıcı teyidi gelmeden durum değiştirilmedi |
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
  **(Yeni not — henüz görülmedi)** `AdvancedProxyManager.ts`, `'../types'`'tan
  `ProxyMetrics`/`ProxyLease` import ediyor, ancak yüklenen `index.ts` bu
  ikisini re-export etmiyor (sadece `governor-command.types` ve
  `auth-validation.types`). Bloklayıcı değil, ama tip dosyasının kendisi
  hâlâ "görülmedi" sayılıyor — ileride bu tipler değişirse önce görülmesi
  gerekecek.
- **(Yeni)** `IStateObserver.AnomalyType` (adapters katmanı, jenerik) ile
  `governor-command.types.ts`'teki `AnomalyType` (governor katmanı, domain
  kararlarına bağlı) **BİLİNÇLİ OLARAK iki ayrı tip** — aynı isimde olmaları
  bir hata değil, ama karıştırılmamalı. Madde #33 (TAM KAPANIŞ) turunda bu
  ikisi arasına kasıtlı bir isim FARKLILIĞI eklendi
  (`PROCESS_CRASHED`/`NETWORK_ERROR` vs `PAGE_CRASH`/`NETWORK_FAILURE`) —
  ikisini eşleyen TEK yer `PersistentStateEngine.translateObserverAnomaly()`.
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de re-export ediliyor.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edilmişti;
  Madde #7 ile birlikte legacy `.on('decision', ...)` yolu **kaldırıldı**,
  tek yol `RecoveryCommandPort` (`setCommandPort` ile enjekte edilen
  `PersistentStateEngine`) oldu.
- `PersistentStateEngine.handleGovernorDecision`'ın catch bloğundaki
  `enqueueAnomaly(...)` çağrısı `queueMicrotask(() => ...)` ile ertelendi —
  senkron re-entrancy zincirinin `isRecovering` guard'ını atlamasını
  önlemek için (Madde #9 kapsamı). Runtime'da doğrulandı.
- Madde #9'un gerçek entegrasyon testi (mock'suz Playwright + gerçek/local
  auth server ile cookie-restore-ama-authenticate-olmadı senaryosu)
  **projenin sonuna ertelendi**. **Açık varsayım:** "proje sonu" net bir
  tarih/tetikleyici değil — ileride "artık test edelim mi" diye tekrar
  sorulacak.
- `getAllMetrics()` (dışa açık/toplu görünüm) ve `getProxyMetrics()` (iç
  kullanım, gerçek proxy bağlantısı için credential'lı) **kasıtlı olarak
  farklı davranıyor**. `SecretProvider`/`ProxyCredentialStore` credential'ları
  yalnızca kendi katmanında tutuyor, `AdvancedProxyManager` şifreleme
  detayını bilmiyor.
- `EngineFactoryOptions.authValidator` (`validationUrl`,
  `unauthenticatedUrlPatterns`, `navigationTimeoutMs?`) **ZORUNLU** alan.
  Demo bloğundaki placeholder URL'ler production'a alınmadan gerçek
  değerlerle değiştirilmeli.
- `DefaultAuthValidator.validate()`: ağ/DNS/timeout hatası ve beklenmeyen
  HTTP yanıtı `AuthValidationNetworkError` fırlatıyor — bu, (kasıtlı olarak)
  `AUTH_VALIDATION_FAILED` anomaly'si TETİKLEMİYOR, ağ hatası auth hatası
  değildir.
- `IStateObserver.ts`/`IResourceAdapter.ts`, Madde #33 kapsamında
  `legacy/`'den `src/adapters/`'a taşındı — artık `src/`'in resmi parçası.
  **(Yeni) Madde #33 TAM KAPANDI** — `crash`/`requestfailed` de artık bu
  sözleşme üzerinden, hiçbir ham `page.on(...)` kalmadı.
- **(Yeni)** `PersistentStateEngine.handleGovernorDecision`'daki
  `FULL_RECOVERY` case'i `AUTH_VALIDATION_FAILED` anomaly'sini `markFailed`'den
  hariç tutuyor (bkz. `session_arşiv.md` Taşıma 4) — proxy sağlığı ile
  session/auth-state sağlığının ayrı katmanlar olduğu ilkesi.
- **Madde #2 — Persistent proxy store backend KARARLAŞTIRILDI ve UYGULANDI:
  SQLite (`better-sqlite3`), `ProxyCredentialStore` ile aynı DB dosyası,
  ayrı `proxy_health` tablosu.** Gerekçe: tek-node motor, ekstra
  servis/network bağımlılığı istenmiyor; Redis ve Neon/Postgres kullanıcı
  onayıyla elendi. **Madde TAM KAPANDI** — TTL = 24 saat kullanıcı onayıyla
  sabitlendi; yazma `markFailed()` içinde best-effort. **Kapsam dışı
  bırakılan açık takip:** composition-root'ta hangi `dbPath`'in
  kullanılacağı hâlâ görülmedi — Madde #13'ün aynı türden açık takibiyle
  birleşiyor, ikisi de aynı composition-root noktasında çözülecek.
- **Madde #13 — Secret yönetimi kaynağı KARARLAŞTIRILDI ve UYGULANDI: env var
  (`STATE_SYNC_ENCRYPTION_KEY`) + AES-256-GCM envelope encryption, bir
  `SecretProvider` interface'i arkasında.** **Madde TAM KAPANDI** — production'da
  fiilen aktif olması için composition-root wiring'i hâlâ ayrı bir açık takip
  (bkz. Sıradaki Öncelik).
- **(Yeni) Deploy hedefi (süreç kararı, madde dışı) KARARLAŞTIRILDI (aday):
  Fly.io** — persistent volume + resmi Playwright Docker image. Kesinleşmiş
  değil, deploy aşamasında tekrar teyit edilecek.
- **(Yeni) Madde #15 — Merkezi loglama kaynağı KARARLAŞTIRILDI ve UYGULANDI:
  `src/telemetry/ILogger.ts` (arayüz: `debug/info/warn/error`, her biri
  `message: string` + opsiyonel `meta: Record<string, unknown>` alır) +
  `src/telemetry/ConsoleJsonLogger.ts` (constructor'da `component: string`
  alır, `{"level","component","message",...meta}` JSON şeklini üretir).**
  Enjeksiyon deseni **opsiyonel constructor parametresi** (verilmezse
  `ConsoleJsonLogger` varsayılan) — `authValidator`'ın ZORUNLU olmasından
  BİLİNÇLİ OLARAK farklı, çünkü loglama eksikliği Kural #4 anlamında "sahte
  veri/sessiz fallback" üretmiyor, sadece log basmıyor. **Madde TAM
  KAPANDI.** **Kapsam dışı bırakılan açık takipler:** (a) log seviyesi
  filtreleme (env var ile min-level) — Madde #27 ile birleşebilir; (b)
  composition-root/`better-sqlite3` ile aynı ailede duran, ertelenmiş bir
  entegrasyon testi (bkz. Kapanan Maddeler Geçmişi).

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

> **(Yeni — Session 3)** Madde #1, #5, eski #6, tam kapanmış #6/#7/#8 bloğu,
> #9 alt-bug ve #23 girdileri, 400 satır eşiği aşıldığı için (Kural #11)
> `session_arşiv.md`'ye (Taşıma 1) TAM olarak taşındı — silinmedi. Ayrıntı
> için o dosya.
> **(Yeni — Session 3)** Süreç dışı `authValidator` wiring bug'ı +
> `AuthValidationNetworkError` fix'i ve Madde #33 alt-adım girdileri, 400
> satır eşiği aşıldığı için (Kural #11) `session_arşiv.md`'ye (Taşıma 2)
> TAM olarak taşındı — silinmedi. Ayrıntı için o dosya.
> **(Yeni — Session 3, Taşıma 3)** SESSION_INDEX.md 400 satır eşiği ikinci
> kez aşıldı. Bu kez ⚡ ANLIK DURUM'daki Madde #6/#7/#8, #9 alt-bug, #23,
> #33 alt-adım ve süreç dışı `authValidator` bloklarının TAM METİN
> kopyaları `session_arşiv.md`'ye (Taşıma 3) eklendi, ekteki
> `session_arsiv_tasima3.md` dosyasına bakınız — silinmedi, sadece
> SESSION_INDEX'te kısa özet/referans bırakıldı.
> **(Yeni — Session 3, Taşıma 4)** Madde #22 TAM KAPANDIĞI için ⚡ ANLIK
> DURUM'daki ve bu bölümdeki tüm Madde #22 girdilerinin TAM METİN kopyaları
> `session_arşiv.md`'ye (Taşıma 4) eklendi, `TASIMA_4.md` dosyasına bakınız
> — silinmedi, sadece SESSION_INDEX'te kısa özet/referans bırakıldı.
> **(Bekliyor — Taşıma 5)** SESSION_INDEX.md 400 satır eşiği ÜÇÜNCÜ kez
> aşıldı (bu tur, Madde #15 kapanışıyla). Bu turda `session_arşiv.md`'nin
> güncel hâli elimizde olmadığı için TAM taşıma YAPILMADI — sadece bu not
> düşüldü. Bir sonraki session'da öncelik: mevcut `session_arşiv.md`
> paylaşılsın, en eski kapanmış bloklar (aday: Madde #22 ve #13 tam
> metinleri) Taşıma 5 olarak arşive eklensin.

- **Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3), P0
  tablosundan kaldırıldı.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 4) —
  özet: THROTTLE, ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY →
  hepsi doğru tip-guard'larla `markFailed`'e bağlı; başarı yolu
  `recordSuccess`'e guard'lı bağlı. Son kapanan alt-bulgu:
  `FULL_RECOVERY` case'i anomaly tipine bakmadan HER durumda `markFailed`
  çağırıyordu; `AUTH_VALIDATION_FAILED` artık hariç tutuluyor — düzeltme
  TEST 5a/5b ile regresyona karşı da doğrulandı.
- **Madde #13 — Credential/state encryption-at-rest TAM KAPANDI (Session 3),
  P0 tablosundan kaldırıldı:** `SecretProvider` (`src/security/`, env var
  `STATE_SYNC_ENCRYPTION_KEY` + AES-256-GCM envelope encryption) ve
  `ProxyCredentialStore` (`src/state/`, SQLite / `better-sqlite3`) eklendi;
  `AdvancedProxyManager` constructor'ı geriye dönük uyumlu opsiyonel 3.
  parametre (`credentialStore?`) ile genişletildi. Doğrulama:
  `runtime-check-persistence.ts` ile **4/4 PASS**; `npx tsc --noEmit; echo
  "EXIT CODE: $?"` → **EXIT CODE: 0**. **Güvenlik notu:** doğrulama
  sırasında üretilen bir `STATE_SYNC_ENCRYPTION_KEY` örneği bir ekran
  görüntüsünde açığa çıkmıştı, kullanıcıya rotate etmesi önerildi. **Kapsam
  dışı bırakılan açık takip:** (a) `package.json`'a `better-sqlite3`
  eklenmesi, (b) composition-root'ta `credentialStore` injection — ikisi de
  hâlâ görülmedi.
- **(Yeni) Madde #33 — TAM KAPANDI (Session 3), P0 tablosundan kaldırıldı:**
  `crash`/`requestfailed`, `PersistentStateEngine.attachLifecycleObservers()`
  içinde ham `page.on(...)` olarak kalan son iki sinyaldi. `IStateObserver.
  AnomalyType`'a jenerik `PROCESS_CRASHED`/`NETWORK_ERROR` değerleri
  eklendi — governor tarafından BİLİNÇLİ OLARAK farklı isimlerle.
  Doğrulama: `runtime-check-observer.ts` **6/6 PASS**, `npx tsc --noEmit` →
  **EXIT CODE: 0**.
- **(Yeni) Madde #2 — Persistent proxy state TAM KAPANDI (Session 3), P1
  tablosundan kaldırıldı:** `ProxyHealthStore`
  (`src/state/ProxyHealthStore.ts`) proxy health/quarantine alanlarını
  `ProxyCredentialStore` ile aynı DB dosyasında ayrı `proxy_health`
  tablosunda kalıcı hale getiriyor — yazma sadece `markFailed()` içinde
  `quarantineUntil` güncellendiği anda tetikleniyor, TTL = 24 saat.
  Doğrulama: `runtime-check-health.js` ile **6/6 PASS**, `npx tsc --noEmit`
  → **EXIT CODE: 0**. **Housekeeping:** derlenmiş `.js` repo kökünden
  silindi. **Kapsam dışı bırakılan açık takip:** composition-root `dbPath`
  sorusu, Madde #13'ünkiyle birleşiyor.
- **(Yeni) Madde #15 — Structured (JSON) logging TAM KAPANDI (Session 3),
  P1 tablosundan kaldırıldı:** Kural #5 ("Governor/ProxyManager/StateEngine
  aynı turda birlikte değiştirilmez") gereği önce sözleşme + implementasyon
  izole verildi: `src/telemetry/ILogger.ts` (`debug/info/warn/error`, her
  biri `message` + opsiyonel `meta: Record<string, unknown>`) ve
  `src/telemetry/ConsoleJsonLogger.ts` (constructor'da `component: string`,
  `{"level","component","message",...meta}` JSON çıktısı üretir — daha
  önce `ProxyHealthStore`'un stopgap olarak kullandığı şeklin tek merkezi
  kaynağı). Ardından 3 tüketici dosya (`ProxyHealthStore.ts`,
  `PersistentStateEngine.ts`, `index.ts`) SecretProvider/AuthValidationPort'ta
  izlenen sırayla, ayrı ayrı KARAR BİLDİRİMİ'leriyle güncellendi.
  **Tutarsızlık bulundu ve düzeltildi:** `PersistentStateEngine.ts` için
  grep çıktısı (2 gün önce alınmış) 5 `console.*` çağrısı gösteriyordu,
  ama gerçek dosyada 7 vardı (`captureState`/`applyState` catch
  bloklarındaki 2 `console.warn` grep'te kayıptı) — gerçek dosya esas
  alındı, 7 çağrının tamamı değiştirildi. Repo genelinde toplam **11**
  `console.*` çağrısı `ILogger`'a taşındı (`index.ts`'teki demo bloğu
  dahil — tutarlılık için taşınmasına karar verildi). Enjeksiyon deseni
  `healthStore?`/`credentialStore?` ile aynı desende **opsiyonel constructor
  parametresi**; verilmezse `ConsoleJsonLogger` varsayılan olur — bu,
  `authValidator`'ın ZORUNLU yapılmasından BİLİNÇLİ OLARAK farklı, çünkü
  loglama eksikliği "sahte veri/sessiz fallback" (Kural #4) üretmiyor,
  sadece log basmıyor. Doğrulama: izole `runtime-check-logger.ts` ile
  **4/4 PASS** (seviye→doğru `console.*` metodu + doğru JSON şekli; `meta`
  içindeki çakışan anahtarlar `level/component/message`'ı ezemiyor;
  circular `meta` throw etmiyor, `metaSerializationError:true` ile
  `message` kaybolmadan devam ediyor; `meta` verilmediğinde ekstra alan
  sızmıyor) + repo genelinde (3 tüketici dosya dahil, projenin kendi
  `tsconfig.json`'ıyla) `npx tsc --noEmit; echo "EXIT CODE: $?"` →
  **EXIT CODE: 0**. **Kapsam dışı bırakılan açık takipler:** (a) log
  seviyesi filtreleme (env var ile min-level) — muhtemelen Madde #27
  (merkezi config) ile birleşecek; (b) `runtime-check-logger.ts` içindeki
  `ProxyHealthStore` entegrasyon testi (TEST 5) bu turda dosyadan çıkarıldı
  — Kural #5 gereği Madde #15'in kapanışını `better-sqlite3` kurulumuna
  bağımlı hale getirmemek için, `ILogger` importu/kullanımı bırakılıp
  sadece izole sözleşme test edildi; `better-sqlite3` kendi başına Madde
  #13/#2'nin zaten açık olan composition-root takibinde kalmaya devam
  ediyor. **Ayrıca not (araç uyumsuzluğu, kod kaynaklı değil):** Node'un
  yerleşik TypeScript desteği (Node 24) uzantısız relative import'ları
  çözemediği için `runtime-check-logger.ts` doğrudan `node` ile
  çalıştırılamadı — projenin kendi konvansiyonuna uyularak `npx tsc`
  ile `/tmp` altına derlenip derlenmiş `.js` çalıştırıldı (repo köküne
  housekeeping gereken bir dosya bırakılmadı).

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
- Bir session'ın kapanışında "şunu yapıyorum / şu komutu çalıştırıyorum"
  şeklinde bildirilen bir eylem, komutun **gerçek çıktısı** paylaşılmadan
  bir sonraki session'da "doğrulandı" sayılmamalı.
- Bir alt-katmanın (guard/re-entrancy) temiz doğrulanması, üst semptomun
  çözüldüğü anlamına gelmez — kapsam daraldıkça madde AÇIK kalmaya devam
  eder, erken kapanış iddiası yasak.
- Bir maddenin kapsamını genişletmek ya da daraltmak için gerçek tüketici
  kodu görülmeden karar vermek riskli — dosya başlığındaki eski bir not
  güncel gerçeği yansıtmayabilir, **her iki yönde de** gerçek koda
  bakılmalı. SESSION_INDEX'in kendisi de bir "eski not" kaynağı olabilir.
- Bir hata durumunu başka bir hata durumuyla aynı dönüş değerine
  sıkıştırmak, ikisini birbirinden ayırt edilemez hale getirir.
- Verilen dosya adı, hedef repo yoluyla nokta/alt çizgi dahil BİREBİR
  eşleşmeli, ya da hedef yol açıkça belirtilmeli.
- "Madde X kapandı" etiketi, benzer riskli dosyaların TAMAMININ tarandığı
  anlamına gelmez.
- Test/derleme aracı sürüm uyumsuzluğu, çalıştırma zamanında KOD kaynaklıymış
  gibi görünen bir hataya yol açabilir.
- "Derleniyor" (`tsc --noEmit` temiz) ile "runtime'da fiilen çağrılıyor"
  arasındaki fark tekrar eden bir kalıp.
- Bir action'ın (örn. `FULL_RECOVERY`) birden fazla farklı anomaly tipinden
  tetiklenebilmesi, downstream etkisinin TÜM tetikleyici tiplere aynı
  şekilde uygulanması gerektiği anlamına gelmez — her yeni eşleme ayrıca
  kontrol edilmeli.
- **(Madde #13 turu)** "Terminalde hata satırı görünmüyor" ile "komut
  gerçekten 0 döndü" farklı doğrulama seviyeleridir — `echo $?` ile teyit
  edilmeden derleme adımı "temiz" sayılmamalı.
- **(Madde #13 turu)** Bir ekran görüntüsünde açığa çıkan gerçek bir
  secret/key, production'a alınmadan rotate edilmeli önerisi verilmeli.
- **(Madde #13 turu)** Bir madde kapansa bile, kodun production'da fiilen
  kullanılması (composition-root wiring, bağımlılık kurulumu) ayrı ve hâlâ
  açık bir takip maddesi olabilir — "madde kapandı" ile "özellik
  production'da aktif" karıştırılmamalı.
- **(Madde #33 turu)** Jenerik/domain-bağımsız tasarlanmış bir sözleşmeyi
  (örn. `IStateObserver.AnomalyType`) genişletirken, yeni değerlere BİLİNÇLİ
  OLARAK tüketici katmandaki (governor) benzer isimli tiplerden FARKLI
  isimler vermek, iki ayrı sözleşmenin yanlışlıkla aynı tip sanılmasını
  daha başından engeller.
- **(Madde #33 turu)** Bir "bilinçli olarak kapsam dışı bırakıldı" notu
  (dosya başlığında), kod ilerledikçe geçersiz kalabilir — kapanış notları
  sadece SESSION_INDEX'te değil, ilgili kod dosyasının kendi başlığında da
  güncellenmeli.
- **(Madde #2 turu)** Write-through olmayan (yalnızca belirli bir olayda
  tetiklenen) bir persistence kararı, "hangi alanların ne zaman güncel
  olduğu" konusunda kalıcı bir trade-off yaratır — bu, madde kapanışında
  açıkça kabul edilmiş bir sınırlama olarak not düşülmeli, aksi halde
  ileride "bug" sanılabilir.
- **(Madde #2 turu)** Aynı composition-root açık takibi birden fazla
  maddede tekrar ediyorsa, bu maddeler kapandıkça tek tek not düşmek yerine
  composition-root'un kendisi ayrı bir P1/P0 madde adayı olarak
  değerlendirilmeli.
- **(Yeni — Madde #15 turu)** Bir grep sonucu ile gerçek dosya içeriği
  arasındaki fark, sadece "SESSION_INDEX eski olabilir" ilkesinin değil,
  aynı zamanda oturum İÇİNDE üretilen ARA çıktıların (birkaç gün önce
  alınmış bir grep) da bayatlayabileceğinin somut kanıtıdır — bir madde
  kapanmadan hemen önce referans alınan herhangi bir komut çıktısının
  "hâlâ güncel mi" diye tekrar doğrulanması, sadece session açılışında
  değil, madde kapanış anında da gerekli olabilir.
- **(Yeni — Madde #15 turu)** İzole bir birim testinin (`runtime-check-
  logger.ts`, sadece `ILogger`/`ConsoleJsonLogger` sözleşmesini test eden)
  tamamı PASS olması, 3 tüketici dosyanın gerçek entegrasyonunu KANITLAMAZ
  — bunun için ayrı, repo-genelinde bir derleme kontrolü (`tsc --noEmit`,
  gerçek `tsconfig.json` ile, tüm tüketici dosyalar dahil) gerekti; iki
  doğrulama seviyesi birbirinin yerine geçmez.
- **(Yeni — Madde #15 turu)** Bir maddenin kapanışını, kapsamı dışındaki
  başka bir açık bağımlılığa (burada: `better-sqlite3` kurulumu) bağımlı
  hale getirmek yerine, o bağımlılığı gerektiren test/alt-parçayı GEÇİCİ
  olarak izole edip ayrı bırakmak (Kural #5), üç farklı maddenin kapanış
  koşullarının birbirine karışmasını önler.

---

*Not (Session 3, önceki tur): `ProxyHealthStore` ile Madde #2 (persistent
proxy state) kapatıldı — `runtime-check-health.js` 6/6 PASS + `tsc --noEmit`
EXIT CODE: 0 ile doğrulandı, TTL=24 saat ve housekeeping kullanıcı
tarafından onaylandı. **Madde #2 TAM KAPANDI ve P1 tablosundan
kaldırıldı.***

*Not (Session 3, bu tur): `src/telemetry/` katmanı (`ILogger` +
`ConsoleJsonLogger`) eklendi, 3 tüketici dosya (`ProxyHealthStore.ts`,
`PersistentStateEngine.ts`, `index.ts`) tek tek güncellendi — izole logger
testi 4/4 PASS + repo genelinde `tsc --noEmit` EXIT CODE: 0 ile doğrulandı.
**Madde #15 TAM KAPANDI ve P1 tablosundan kaldırıldı.** P0 tablosunda hâlâ
sadece **#9** kalıyor — kullanıcı kararıyla ertelenmiş, aktif çalışılmıyor.
Fiilen P0'da aktif iş yok; sıradaki adım kullanıcının tercihine bağlı (bkz.
Sıradaki Öncelik). P2 sayı/kapsam olarak değişmedi. **Dosya 400 satır
eşiğini tekrar aştı — Taşıma 5 bir sonraki session'da `session_arşiv.md`
paylaşıldıktan sonra yapılacak.***
