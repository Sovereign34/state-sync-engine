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
  - **Madde #1, #5, #6, #7, #8, #9 (alt-bug), #23, #22, #13, #33, #2, #15 —
    hepsi TAM KAPANDI.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 1-5,
    Madde #22/#13/#33/#2/#15 detayı bu turda Taşıma 5 ile arşive taşındı —
    bkz. bu turda eklenen `TASIMA_5.md` bloğu).
  - **Süreç dışı `authValidator` wiring bug'ı — TAM KAPANDI.** Tam ayrıntı
    `session_arşiv.md`'de (Taşıma 2/3).
  - **(Yeni) Madde #24 — Engine lifecycle (start/stop/dispose): TAM KAPANDI
    (Session 3).** `lifecycleState: 'created' | 'ready' | 'closing' |
    'closed'` guard'ı eklendi — `initialize()` artık 'created' dışında throw
    ediyor (çift initialize engellendi); `handleDecision()` artık 'ready'
    dışında no-op + warn log yapıyor (governor kararları guard'lı).
    **GERÇEK BULGU (tespit bu maddeyi açtı):** `attachLifecycleObservers()`
    her çağrıldığında yeni bir `PlaywrightPageObserver` kuruyordu ama
    referans hiçbir instance alanında saklanmıyordu — leak sadece `close()`'da
    değil HER recovery rotasyonunda oluşuyordu. Artık `this.observer`
    alanında saklanıyor; yeni observer kurulmadan ÖNCE eskisi `stop()`
    ediliyor. `close()` artık idempotent (ikinci çağrı no-op), `context`/
    `page` kapanıştan sonra `undefined`'a çekiliyor (stale referans riski
    kapatıldı — `getPage()`/`getContext()` artık kapalı bir context/page
    döndürmüyor). `index.ts`'e `EngineFactory.disposeEngine()` eklendi —
    engine/browser'ı try/finally ile güvenli kapatıyor (önceden
    `engine.close()` throw ederse `browser.close()` hiç çalışmıyordu),
    main-entry bloğu buna geçirildi. `governor.setCommandPort` kaydına
    BİLİNÇLİ OLARAK dokunulmadı (KARAR BİLDİRİMİ'nin kapsam sınırı).
    **Doğrulama (üç kanıt):** (1) statik — `npx tsc --noEmit`, gerçek
    Codespace ortamında, tam repo, **sıfır hata**; (2) kapsam — diff ile
    değişikliğin sadece onaylanan iki dosyaya (`PersistentStateEngine.ts`,
    `index.ts`) sınırlı kaldığı teyit edildi, Governor/ProxyManager'a
    dokunulmadı; (3) runtime — smoke-test (`tsx` ile; `ts-node@10.9.2`'nin
    Node 24 ile bilinen bir config-okuma uyumsuzluğu nedeniyle `tsx`'e
    geçildi) çift `initialize()`'ın throw ettiğini ve çift `close()`'un
    sessizce no-op olduğunu doğruladı — **ikisi de PASS**. Madde P1
    tablosundan kaldırıldı.
  - **(Yeni) Madde #25 — Graceful shutdown (SIGTERM/SIGINT): TAM KAPANDI
    (Session 3).** Guard mantığı, main-entry closure'ından bağımsız,
    enjekte edilebilir `disposeEngine`/`exit` alan `createShutdownController()`
    fonksiyonuna çıkarıldı (izole test edilebilirlik için) — `index.ts`'ten
    export ediliyor. `shutdown(signal, logger)` idempotent: ilk çağrı
    `disposeEngine()`'i çağırıp `exit(0)` çağırır, sonraki her çağrı
    (çift sinyal ya da normal-akış-sonrası bir sinyal) no-op'tur.
    `markDisposed()`, normal akışın (30sn bekleme sonu) kendi dispose'unu
    yaptığı durumda aynı guard'ı senkronize eder. Main-entry, `process.on
    ('SIGTERM'|'SIGINT', ...)` ile bu controller'a bağlandı; `browser`/
    `engine` referansları sinyal handler'ının erişebileceği dış scope'ta
    tutuluyor, `createProductionEngine()` dönmeden bir sinyal gelirse
    (referanslar hâlâ `undefined`) hiçbir şey dispose edilmeden no-op geçiliyor.
    **Doğrulama (üç kanıt):** (1) statik — `npx tsc --noEmit`, tam repo,
    **sıfır hata**; (2) kapsam — sadece `index.ts` (main-entry bloğu +
    yeni export) değişti, `PersistentStateEngine.ts`'e bu turda hiç
    dokunulmadı; (3) runtime — `runtime-check-shutdown.ts` (repo kökünde,
    diğer `runtime-check-*.ts` dosyalarıyla aynı konvansiyonda; ilk taslak
    yanlışlıkla `scripts/` altına konup import yolu kırılmıştı, düzeltildi)
    ile **4/4 PASS** (ilk shutdown dispose+exit(0), çift sinyal no-op,
    `markDisposed()` sonrası sinyal no-op, opsiyonel `exit` parametresi).
    **Kapsam dışı bırakılan açık gözlem (madde değil):** Codespace'te gerçek
    bir `kill -TERM` denemesinde `chromium.launch()` dbus soket hatasıyla
    başarısız oldu ve `main-entry`'nin `catch` bloğu bunu "Kritik hata"
    olarak loglayıp **`process.exitCode` ayarlamadan** (varsayılan 0 ile)
    çıktı — bu, Madde #25'in kapsamı dışında, main-entry'nin hata yolunda
    önceden var olan ayrı bir bulgu; gerçek sinyal iletiminin (`npx tsx ... &`
    ile `$!`'in gerçek node process'i mi yoksa `npx` wrapper'ı mı olduğu)
    ve Codespace'te headless Chromium'un dbus'suz çalışması gerektiğinin
    ayrıca doğrulanması gerekiyor — deploy (Fly.io) öncesi ele alınmalı,
    bu turda yeni bir madde açılmadı. Madde P1 tablosundan kaldırıldı.
- **Sıradaki öncelik:** P0 tablosunda hâlâ sadece **#9** açık — gerçek
  entegrasyon testi kullanıcı kararıyla ertelenmiş, aktif çalışılmıyor.
  Fiilen P0'da aktif iş yok. Madde #24 ve #25'in kapanmasıyla P1'den seçim
  daha da daraldı; sıradaki iş kullanıcının önceliğine bağlı: (a) #9'un
  ertelenmiş testine şimdi mi dönülsün; (b) P1'den yeni bir madde mi
  seçilsin (öneri: **#27** Merkezi immutable configuration — Madde #15'in
  ertelediği log-level filtreleme ile bağlantılı); (c) Madde #13/#2'nin
  kapsam dışı bırakılan ortak açık takibi mi ele alınsın —
  composition-root wiring ve `better-sqlite3` bağımlılığı (üç madde —
  #13, #2, kısmen #15'in ertelenen TEST 5'i — için aynı composition-root
  noktasında geçerli, aynı `dbPath` sorusu hâlâ açık); (d) Madde #25
  turunda yüzeye çıkan açık gözlem (main-entry `catch` bloğunun
  `process.exitCode` ayarlamaması + gerçek sinyal iletiminin/Codespace'te
  headless Chromium'un dbus bağımlılığının doğrulanmamış olması) ayrı bir
  madde olarak mı açılsın. Ayrıca hâlâ açık: #9 vs #17 etiket tutarsızlığı
  sorusu (bkz. ❓ Cevap Bekleyen Sorular).
- **⚠️ Dosya boyutu notu:** Bu turda **Taşıma 5** yapıldı — Madde #22, #13,
  #33, #2, #15'in tam metinli kapanış anlatıları (ANLIK DURUM, Kritik Teknik
  Kararlar ve Kapanan Maddeler Geçmişi'ndeki üç kopya dahil) ve 5 adet
  çözülmüş Cevap Bekleyen Soru, `session_arşiv.md`'ye eklenmek üzere ayrı bir
  `TASIMA_5.md` bloğu olarak verildi (arşivin kendisi yeniden üretilmedi,
  sadece yeni blok — Kural #11). SESSION_INDEX'te bu maddeler için artık
  sadece tek satır referans var. **Kullanıcıdan istenen:** `TASIMA_5.md`
  içeriğini mevcut `session_arşiv.md`'nin sonuna ekle (append) — arşivin
  şu anki tam hâli bu oturumda hâlâ paylaşılmadığı için Claude bunu kendisi
  birleştiremedi.

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. Ya yorum yanlış etiketlenmiş ya da #17 kısmen zaten çözülmüş ve
  tabloya yansımamış. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu
  yanıt gelmeden değiştirilmedi.
- *(5 adet çözülmüş soru Taşıma 5 ile `session_arşiv.md`'ye taşındı — bkz.
  `TASIMA_5.md`.)*

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
  **(Henüz görülmedi)** `AdvancedProxyManager.ts`, `'../types'`'tan
  `ProxyMetrics`/`ProxyLease` import ediyor, ancak yüklenen `index.ts` bu
  ikisini re-export etmiyor. Bloklayıcı değil, ama tip dosyasının kendisi
  hâlâ "görülmedi" sayılıyor.
- `IStateObserver.AnomalyType` (adapters katmanı, jenerik) ile
  `governor-command.types.ts`'teki `AnomalyType` (governor katmanı) BİLİNÇLİ
  OLARAK iki ayrı tip — Madde #33'te aralarına kasıtlı isim FARKLILIĞI
  eklendi (`PROCESS_CRASHED`/`NETWORK_ERROR` vs `PAGE_CRASH`/
  `NETWORK_FAILURE`), ikisini eşleyen TEK yer
  `PersistentStateEngine.translateObserverAnomaly()`.
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de re-export ediliyor.
- Madde #7 ile legacy `.on('decision', ...)` yolu **kaldırıldı**, tek yol
  `RecoveryCommandPort` (`setCommandPort` ile enjekte edilen
  `PersistentStateEngine`) oldu.
- `PersistentStateEngine.handleGovernorDecision`'ın catch bloğundaki
  `enqueueAnomaly(...)` çağrısı `queueMicrotask(() => ...)` ile ertelendi —
  senkron re-entrancy zincirinin `isRecovering` guard'ını atlamasını önlemek
  için (Madde #9 kapsamı).
- Madde #9'un gerçek entegrasyon testi **projenin sonuna ertelendi**. **Açık
  varsayım:** "proje sonu" net bir tarih/tetikleyici değil.
- `getAllMetrics()` (dışa açık) ve `getProxyMetrics()` (iç kullanım,
  credential'lı) kasıtlı olarak farklı davranıyor — credential'lar
  `AdvancedProxyManager`'ın bilmediği bir katmanda tutuluyor.
- `EngineFactoryOptions.authValidator` **ZORUNLU** alan. Demo bloğundaki
  placeholder URL'ler production'a alınmadan gerçek değerlerle
  değiştirilmeli.
- `DefaultAuthValidator.validate()`: ağ/DNS/timeout hatası
  `AuthValidationNetworkError` fırlatıyor — (kasıtlı olarak)
  `AUTH_VALIDATION_FAILED` anomaly'si TETİKLEMİYOR.
- **Madde #2 — proxy store backend: SQLite (`better-sqlite3`), `Proxy
  CredentialStore` ile aynı DB, ayrı `proxy_health` tablosu, TTL=24 saat.**
  TAM KAPANDI — tam gerekçe/doğrulama Taşıma 5'te (`TASIMA_5.md`).
- **Madde #13 — secret kaynağı: env var (`STATE_SYNC_ENCRYPTION_KEY`) +
  AES-256-GCM envelope encryption.** TAM KAPANDI — tam gerekçe/doğrulama
  Taşıma 5'te.
- **Madde #15 — merkezi loglama: `src/telemetry/ILogger.ts` +
  `ConsoleJsonLogger.ts`, opsiyonel constructor enjeksiyonu.** TAM KAPANDI —
  tam gerekçe/doğrulama Taşıma 5'te.
- **(Yeni) Madde #24 — engine lifecycle sözleşmesi: `lifecycleState:
  'created'|'ready'|'closing'|'closed'`, observer referansı `this.observer`
  alanında saklanıyor, `close()` idempotent.** TAM KAPANDI — tam gerekçe/
  doğrulama yukarıda ⚡ ANLIK DURUM'da (henüz taze, arşive taşınmadı).
  `governor.setCommandPort` kaydına BİLİNÇLİ OLARAK dokunulmadı.
- **(Yeni) Madde #25 — graceful shutdown sözleşmesi: `createShutdownController
  (disposeEngine, exit?)`, `index.ts`'ten export edilen, `browser`/`engine`
  bilmeyen (sadece bir `disposeEngine: () => Promise<void>` callback'i alan)
  jenerik bir guard.** TAM KAPANDI — tam gerekçe/doğrulama yukarıda ⚡ ANLIK
  DURUM'da. `runtime-check-*.ts` dosyaları repo KÖKÜNDE tutulur (bu turda
  yanlış konuma konup düzeltilen bir örnek yaşandı — bkz. DERSLER).
- **(Yeni) Deploy hedefi (süreç kararı, madde dışı) KARARLAŞTIRILDI (aday):
  Fly.io** — persistent volume + resmi Playwright Docker image. Kesinleşmiş
  değil.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

> **(Session 3, Taşıma 1-4)** Madde #1, #5, eski #6, #6/#7/#8, #9 alt-bug,
> #23, süreç dışı `authValidator` wiring bug'ı, Madde #22 ve #33 alt-adım
> girdileri — `session_arşiv.md`'ye (Taşıma 1-4) TAM olarak taşındı,
> silinmedi. Ayrıntı için o dosya.
> **(Yeni — Session 3, Taşıma 5)** SESSION_INDEX.md 400 satır eşiği dördüncü
> kez aşıldı (Madde #24 kapanışıyla). Bu tur: Madde #22, #13, #33, #2,
> #15'in TAM METİN kapanış anlatıları (ANLIK DURUM + Kritik Teknik Kararlar +
> bu bölümdeki üç ayrı kopya) ve 5 adet çözülmüş Cevap Bekleyen Soru, ayrı
> bir `TASIMA_5.md` bloğu olarak verildi — **kullanıcının bunu mevcut
> `session_arşiv.md`'nin sonuna eklemesi gerekiyor** (arşivin güncel hâli bu
> oturumda paylaşılmadığı için Claude tarafında birleştirilemedi). Hiçbir
> içerik silinmedi, sadece taşındı.

- **(Yeni) Madde #24 — Engine lifecycle (start/stop/dispose): TAM KAPANDI
  (Session 3), P1 tablosundan kaldırıldı.** Tam ayrıntı yukarıda ⚡ ANLIK
  DURUM'da (bu madde henüz taze — bir sonraki eşik aşımında arşive
  taşınacak). Kısa özet: `lifecycleState` guard'ı + idempotent `close()` +
  observer referansının saklanması (rotasyon dahil her çağrıda sızıntı veren
  gerçek bir bug düzeltildi) + `EngineFactory.disposeEngine()`. Üç kanıtla
  doğrulandı: `tsc --noEmit` (tam repo, 0 hata), kapsam-sınırlı diff, `tsx`
  ile runtime smoke-test (çift initialize/close PASS).
- **(Yeni) Madde #25 — Graceful shutdown (SIGTERM/SIGINT): TAM KAPANDI
  (Session 3), P1 tablosundan kaldırıldı.** Tam ayrıntı yukarıda ⚡ ANLIK
  DURUM'da (henüz taze). Kısa özet: guard mantığı `createShutdownController()`
  olarak izole edilebilir bir fonksiyona çıkarıldı, main-entry `process.on
  ('SIGTERM'|'SIGINT', ...)` ile buna bağlandı. Üç kanıtla doğrulandı:
  `tsc --noEmit` (0 hata), kapsam-sınırlı diff (sadece `index.ts`),
  `runtime-check-shutdown.ts` ile 4/4 PASS. Kapsam dışı bırakılan açık
  gözlem: main-entry `catch` bloğunun hata durumunda `process.exitCode`
  ayarlamaması + gerçek OS sinyali iletiminin Codespace'te henüz net
  doğrulanmamış olması (dbus/chromium launch hatası bu turda ayrıca
  gözlendi) — yeni madde açılıp açılmayacağı kullanıcı kararına bırakıldı.
- *(Madde #22, #13, #33, #2, #15'in tam kapanış kayıtları Taşıma 5 ile
  `session_arşiv.md`'ye taşındı — bkz. `TASIMA_5.md`. Kısa referans: hepsi
  TAM KAPANDI, sırasıyla P0/P0/P0/P1/P1 tablolarından kaldırıldı.)*

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
  çözüldüğü anlamına gelmez.
- Bir maddenin kapsamını genişletmek ya da daraltmak için gerçek tüketici
  kodu görülmeden karar vermek riskli — SESSION_INDEX'in kendisi de bir
  "eski not" kaynağı olabilir.
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
- Bir action'ın birden fazla farklı anomaly tipinden tetiklenebilmesi, her
  tetikleyici tipe aynı downstream etkinin uygulanması gerektiği anlamına
  gelmez — her yeni eşleme ayrıca kontrol edilmeli.
- **(Madde #13 turu)** "Terminalde hata satırı görünmüyor" ile "komut
  gerçekten 0 döndü" farklı doğrulama seviyeleridir — `echo $?` ile teyit
  edilmeden derleme adımı "temiz" sayılmamalı.
- **(Madde #13 turu)** Bir ekran görüntüsünde açığa çıkan gerçek bir
  secret/key, production'a alınmadan rotate edilmeli önerisi verilmeli.
- **(Madde #13 turu)** Bir madde kapansa bile, kodun production'da fiilen
  kullanılması (composition-root wiring, bağımlılık kurulumu) ayrı ve hâlâ
  açık bir takip maddesi olabilir.
- **(Madde #33 turu)** Jenerik bir sözleşmeyi genişletirken yeni değerlere
  BİLİNÇLİ OLARAK tüketici katmandaki benzer isimli tiplerden FARKLI isimler
  vermek, iki ayrı sözleşmenin karıştırılmasını daha başından engeller.
- **(Madde #33 turu)** "Bilinçli olarak kapsam dışı bırakıldı" notu, kod
  ilerledikçe geçersiz kalabilir — kapanış notları hem SESSION_INDEX'te hem
  ilgili kod dosyasının kendi başlığında güncellenmeli.
- **(Madde #2 turu)** Write-through olmayan bir persistence kararı kalıcı
  bir trade-off yaratır — kapanışta açıkça not düşülmeli, aksi halde ileride
  "bug" sanılabilir.
- **(Madde #2 turu)** Aynı composition-root açık takibi birden fazla maddede
  tekrar ediyorsa, composition-root'un kendisi ayrı bir P1/P0 madde adayı
  olarak değerlendirilmeli.
- **(Madde #15 turu)** Bir grep sonucu ile gerçek dosya içeriği arasındaki
  fark, oturum İÇİNDE üretilen ara çıktıların da bayatlayabileceğinin
  kanıtıdır — madde kapanış anında da tekrar doğrulama gerekebilir.
- **(Madde #15 turu)** İzole bir birim testinin PASS olması, tüketici
  dosyaların gerçek entegrasyonunu KANITLAMAZ — repo-genelinde ayrı bir
  derleme kontrolü gerekir, iki doğrulama seviyesi birbirinin yerine geçmez.
- **(Madde #15 turu)** Bir maddenin kapanışını kapsamı dışındaki başka bir
  açık bağımlılığa bağımlı hale getirmek yerine, o bağımlılığı gerektiren
  test/alt-parçayı GEÇİCİ olarak izole edip ayrı bırakmak (Kural #5), farklı
  maddelerin kapanış koşullarının birbirine karışmasını önler.
- **(Yeni — Madde #24 turu)** Yerel bir `ts-node`/Node.js sürüm uyumsuzluğu
  (`ts-node@10.9.2` + Node 24), çalıştırma zamanında KOD kaynaklıymış gibi
  görünen bir config-okuma hatası üretebilir (`readConfig`/
  `findAndReadConfig` aşamasında, kullanıcı kodu hiç çalışmadan patlıyorsa)
  — `tsc --noEmit` zaten PASS veriyorsa önce araç sürümünden şüphelenilmeli
  (`tsx` gibi güncel bir alternatifle çapraz doğrulanabilir).
- **(Yeni — Madde #24 turu)** Bir smoke-test script'inin kendi eksik girdisi
  (örn. boş proxy havuzu), test edilen koddaki bir hatayla karıştırılabilir
  — hatanın hangi katmandan geldiği stack trace'teki dosya/satır bilgisiyle
  ayırt edilmeli, panikle kod suçlanmamalı.
- **(Yeni — Madde #24 turu)** Bir dispose/guard bug'ı (referans
  saklanmaması) tespit sırasında sadece tek bir çağrı noktasında (`close()`)
  fark edilebilir ama gerçekte HER çağrı noktasında (rotasyon dahil)
  tekrarlanıyor olabilir — kök nedeni (referansın hiç saklanmaması)
  düzeltmeden tek noktaya yama yapmak sorunu tam kapatmaz.
- **(Yeni — Madde #25 turu)** İzole bir `runtime-check-*.ts` dosyasının
  konumu, proje konvansiyonuna (repo kökü) uymazsa (örn. bir `scripts/`
  alt klasörüne konursa) relative import yolları (`../src/...` vs
  `./src/...`) sessizce kırılır — dosya oluşturulmadan önce mevcut
  `runtime-check-*` dosyalarının GERÇEK konumu teyit edilmeli, varsayılmamalı.
- **(Yeni — Madde #25 turu)** Bir guard/controller'ı main-entry closure'ından
  bağımsız, enjekte edilebilir bağımlılıklarla (`disposeEngine`/`exit`)
  dışa çıkarmak, gerçek OS sinyali/process/Playwright hiç gerekmeden izole
  test edilebilirlik sağlar — ama bu, gerçek sinyal İLETİMİNİN (OS →
  process) ayrıca doğrulanması gerekliliğini ORTADAN KALDIRMAZ, sadece
  guard MANTIĞINI iki ayrı katmana böler.
- **(Yeni — Madde #25 turu)** Bir `catch` bloğunun hatayı loglaması,
  process'in doğru exit code ile çıktığı anlamına gelmez —
  `process.exitCode` açıkça ayarlanmadıkça Node varsayılan olarak `0` ile
  çıkabilir, "Kritik hata" logu olsa bile.

---

*Not (Session 3, önceki tur — Taşıma 5 + Madde #24 kapanışı): `PersistentState
Engine.ts`'e `lifecycleState` guard'ı + observer dispose fix'i, `index.ts`'e
`EngineFactory.disposeEngine()` eklendi — `tsc --noEmit` (tam repo, EXIT
CODE: 0), kapsam-sınırlı diff ve `tsx` runtime smoke-test (çift
initialize/close PASS) ile üç kanıtla doğrulandı. **Madde #24 TAM KAPANDI ve
P1 tablosundan kaldırıldı.** Aynı turda SESSION_INDEX.md 400 satır eşiğini
dördüncü kez aştığı için Madde #22/#13/#33/#2/#15'in tam metinli kapanış
anlatıları `TASIMA_5.md` bloğu olarak ayrıca verildi — `session_arşiv.md`'ye
eklendiği varsayılıyor (bkz. push kaydı, bir sonraki session'da
`session_arşiv.md`'nin kendisi görülünce kesin teyit edilecek).*

*Not (Session 3, bu tur — Madde #25 kapanışı): Graceful shutdown guard
mantığı `createShutdownController()` olarak `index.ts`'ten export edilen
izole bir fonksiyona çıkarıldı, main-entry `SIGTERM`/`SIGINT` handler'ları
buna bağlandı. `tsc --noEmit` (tam repo, PASS), kapsam-sınırlı diff (sadece
`index.ts`) ve `runtime-check-shutdown.ts` (repo kökünde, 4/4 PASS) ile üç
kanıtla doğrulandı. **Madde #25 TAM KAPANDI ve P1 tablosundan kaldırıldı.**
Kapsam dışı bırakılan açık gözlem: main-entry `catch` bloğu hata durumunda
`process.exitCode` ayarlamıyor + gerçek OS sinyal iletimi/Codespace'te
headless Chromium'un dbus bağımlılığı henüz doğrulanmadı — yeni madde açılıp
açılmayacağı kullanıcı kararına bırakıldı. P0 tablosunda hâlâ sadece **#9**
kalıyor (ertelenmiş, aktif çalışılmıyor). Sıradaki adım kullanıcının
tercihine bağlı (bkz. Sıradaki Öncelik).*
