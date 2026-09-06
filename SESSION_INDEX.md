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
  - **Madde #33 — alt-adım KAPANDI.** Tam ayrıntı `session_arşiv.md`'de
    (Taşıma 3) — madde'nin kendisi kapanmadı.
  - **Süreç dışı `authValidator` wiring bug'ı — TAM KAPANDI.** Tam ayrıntı
    `session_arşiv.md`'de (Taşıma 2/3).
  - **Madde #22 — alt-kapsam (THROTTLE + ROTATE_SESSION_ONLY→`markFailed`
    köprüsü, tip-guard dahil): KAPANDI (Session 3, runtime + derleme
    doğrulaması).** Ayrıntı için Kapanan Maddeler Geçmişi. `runtime-check`
    betiğiyle 7/7 test PASS (Test1: 3, Test2: 3 — `CHALLENGE_DETECTED`'ta
    `markFailed` çağrılMADIĞINI doğrulayan regresyon assertion'ı dahil,
    Test3: 1 — `markFailed('HTTP_429')` eski aktif proxy'ye uygulandı,
    `http429Count` 0→1); `npx tsc --noEmit` → 0 hata. Madde P0 tablosunda
    AÇIK kalmaya devam ediyor — diğer `GovernorAction` türleri için
    instrumentation bağlantısı bu turda kapsanmadı.
  - **(Yeni) Madde #22 — `recordSuccess` köprüsü (başarı yolu): kod
    tarafında MEVCUT olduğu doğrulandı, runtime doğrulaması HENÜZ YOK.**
    Bir önceki turda `recordSuccess`'in kapsam dışı olduğu söylenmişti; bu
    iddia yanlıştı (muhtemelen eski dosya başlığındaki bir nottan
    kaynaklandı — bkz. ⚠️ DERSLER, "dosya başlığındaki eski not" maddesi,
    aynı hata kalıbının tekrarı). Bu turda doğrulandı: `handleObserverState`
    kodda mevcut (satır 426), `attachLifecycleObservers` içinde bağlı
    (satır 340). Kayıt düzeltildi: **`recordSuccess` kapsam dışı DEĞİL,
    kodda.**
    - `npx tsc --noEmit` temiz olması sadece "derleniyor" demek —
      `recordSuccess`'in fiilen çağrıldığı **runtime'da** henüz
      gözlemlenmedi. Mevcut `runtime-check.ts` bunu test etmiyor (o script
      THROTTLE/QUARANTINE/ROTATE için mock kullanıyor; `response.ok()`/
      `timing()` başarı senaryosu YOK).
    - **Kullanıcıdan yanıt bekleniyor** — iki seçenek sunuldu, hangisiyle
      devam edileceği netleşmeden runtime doğrulaması yapılmadı:
      1. Yeni bir mock testi (`runtime-check-recordsuccess.ts` — mock
         `Response` nesnesi `status()=200`/`ok()=true`, `request().timing()
         .responseEnd` geçerli bir sayı; `recordSuccess`'in çağrıldığını VE
         geçersiz/negatif `responseEnd` durumunda çağrılMADIĞINI doğrulayan
         2 assertion) — Claude yazar, kullanıcı çalıştırır.
      2. Gerçek ortamda bir proxy üzerinden gerçek sayfa açılıp
         `getProxyMetrics()`'in `successCount`/`latencyMs` alanlarının
         değiştiği gözlemlenir.
    - Bu madde KAPANMADI — sadece "kod var mı" sorusu netleşti, "runtime'da
      çalışıyor mu" sorusu hâlâ açık.
    - **(Yeni) [KARAR BİLDİRİMİ] onaylandı (Confidence: HIGH):** mevcut
      `runtime-check.ts`'e `recordSuccess` için 1 mock senaryo eklenecek
      (`response.ok()=true`, `request().timing().responseEnd` geçerli sayı
      → `recordSuccess` çağrıldığını doğrulayan tek assertion); ayrı dosya
      açılmayacak, mevcut script genişletilecek. **Uygulama bekliyor** —
      mevcut `runtime-check.ts`'in tam içeriği henüz bu session'a
      yüklenmedi, Kural #1/#2 gereği dosya istendi. Kod üretilmeden önce
      dosya gelmeli.
    - **(Yeni) Kullanıcı önerisi reddedildi (kayıt için):** "recordSuccess
      bu kapsam dışı, mevcut runtime-check.ts yeterli" önerisi, bu turun
      kendi bulgusuyla (kod var ama runtime'da hiç test edilmemiş)
      çeliştiği için kabul edilmedi; yukarıdaki mock-genişletme kararı
      onaylandı.
  - **(Yeni) `PersistentStateEngine.ts` debug-temiz sürüm: kullanıcı
    tarafından repo'ya uygulandığı TEYİT EDİLDİ** (debug `console.log`
    temizliği onaylanmış, kod son haline getirilmiş). Not: bu teyit sözlü
    beyan seviyesinde — dosyanın kendisi bu session'a yüklenmedi, ayrıca
    `grep`/diff ile doğrulanmadı. ⚠️ DERSLER'deki "niyet beyanı ile
    gerçekleşmiş sonuç" ayrımı gereği, ileride bu dosyaya dokunulacaksa
    güncel içerik istenmeli — mevcut teyit sadece "temizlik yapıldı" bilgisi
    olarak kaydedildi, dosya içeriği varsayılmadı.
  - Madde #13: Session 2'den değişmedi.
- **Sıradaki öncelik:** Madde #22'nin THROTTLE/ROTATE_SESSION_ONLY
  alt-kapsamı kapandığı için sırada iki seçenek var: (a) #22'nin kalan
  `GovernorAction` türleri için instrumentation bağlantısı, (b) #13
  credential encryption. Buna ek olarak #22'nin `recordSuccess` köprüsü için
  yukarıdaki iki test seçeneğinden hangisiyle ilerleneceği de netleşmeli.
  Kullanıcıdan teyit bekleniyor.

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. Ya yorum yanlış etiketlenmiş ya da #17 kısmen zaten çözülmüş ve
  tabloya yansımamış. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu
  yanıt gelmeden değiştirilmedi.
- ~~Madde #22 `recordSuccess` runtime doğrulama yöntemi~~ — **karar verildi
  (bu turda):** mevcut `runtime-check.ts`'e 1 mock senaryo eklenerek
  genişletilecek. Soru kapandı; **uygulama** için mevcut `runtime-check.ts`
  dosyasının tam içeriği bekleniyor (Kural #1/#2 — dosya görülmeden kod
  üretilmeyecek).
- ~~`PersistentStateEngine.ts` (debug-log temizlenmiş sürüm) repo'ya
  uygulandı mı?~~ — **kullanıcı teyit etti: evet, uygulandı.** (Teyit sözlü
  seviyede, dosya içeriğiyle ayrıca doğrulanmadı — bkz. ⚡ ANLIK DURUM notu.)

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 9 | State restore validation (cookie≠authenticated) | state | açık — re-entrancy alt-bug'ı (guard'ın senkron zincirle atlanması) `queueMicrotask` fix'i ile giderildi ve mock runtime testinde tam doğrulandı (ikinci gizli hata yok, grep ile teyit edildi); **gerçek entegrasyon testi (mock'suz Playwright/proxy/DefaultAuthValidator) kullanıcı kararıyla projenin sonuna ertelendi** — madde bu nedenle açık kalıyor, şu an aktif çalışılmıyor |
| 13 | Credential/state encryption-at-rest | state/security | açık |
| 22 | Network telemetry → ProxyMetrics instrumentation bağlantısı | network | açık — THROTTLE ve ROTATE_SESSION_ONLY→`markFailed` köprüsü (tip-guard dahil) TAMAMLANDI ve doğrulandı (bkz. Kapanan Maddeler Geçmişi); **`recordSuccess` köprüsü kodda VAR (satır 426/340) ama runtime doğrulaması henüz yapılmadı — mock-genişletme kararı ONAYLANDI, uygulama mevcut `runtime-check.ts` dosyasının paylaşılmasını bekliyor**; diğer `GovernorAction` türleri için instrumentation bağlantısı da henüz kapsanmadı. **"Tamamlandı" iddiası bu turda kabul edilmedi** — dar kapsam bile `recordSuccess` runtime doğrulaması olmadan kapanamaz. |
| 33 | IResourceAdapter/IStateObserver merkezi kullanımı | adapters | açık — legacy→`src/adapters/` taşıması ve `PlaywrightPageObserver` (429/403) wiring'i TAMAMLANDI (bkz. Kapanan Maddeler Geçmişi); `crash`/`requestfailed` hâlâ ham `page.on(...)` — bilinçli olarak ayrı bir tura bırakıldı; `RecoveryCommandPort` bu sözleşmelerle çakışmıyor (ikisi de gözlem odaklı, port karar-iletim odaklı) |

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
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de re-export ediliyor.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edilmişti;
  Madde #7 ile birlikte legacy `.on('decision', ...)` yolu **kaldırıldı**,
  tek yol `RecoveryCommandPort` (`setCommandPort` ile enjekte edilen
  `PersistentStateEngine`) oldu. `Promise.allSettled`'ın artık tek bir port
  beklerken hâlâ anlamlı olup olmadığı — runtime doğrulaması sırasında
  gözden geçirilmeli (dosya içeriği henüz bu session'a yüklenmedi, sadece
  git diff istatistiği ve tsc sonucu görüldü).
- **(Yeni — Session 3)** `PersistentStateEngine.handleGovernorDecision`'ın
  catch bloğundaki `enqueueAnomaly(...)` çağrısı `queueMicrotask(() => ...)`
  ile ertelendi — senkron re-entrancy zincirinin `isRecovering` guard'ını
  atlamasını önlemek için (Madde #9 kapsamı). Runtime'da doğrulandı; ayrıntı
  için yukarıdaki ⚡ ANLIK DURUM. **Bu turda soruldu ama henüz teyit edilmedi:**
  debug-log'u temizlenmiş sürümün repo'ya fiilen uygulanıp uygulanmadığı
  (bkz. Cevap Bekleyen Sorular) — teyit gelmeden bu satır "uygulandı" olarak
  güncellenmeyecek.
- **(Yeni — Session 3, kullanıcı onaylı)** Madde #9'un gerçek entegrasyon
  testi (mock'suz Playwright + gerçek/local auth server ile cookie-restore-
  ama-authenticate-olmadı senaryosu) **projenin sonuna ertelendi**.
  Gerekçe: gerçek proxy + gerçek `DefaultAuthValidator` hedefine karşı test
  kurmak şu an için yan iş; ana geliştirme ilerledikçe zaten bir test
  ortamı (CI/local mock server) oturacak. **Açık varsayım:** "proje sonu"
  net bir tarih/tetikleyici değil — bu kalemin sessizce sonsuza kadar
  ertelenmiş kalmaması için ileride "artık test edelim mi" diye tekrar
  sorulacak.
- **(Yeni — Session 3)** `getAllMetrics()` (dışa açık/toplu görünüm) ve
  `getProxyMetrics()` (iç kullanım, gerçek proxy bağlantısı için
  credential'lı) **kasıtlı olarak farklı davranıyor** — bu ayrım
  `AdvancedProxyManager.ts` içinde yorumla işaretlendi. Madde #22
  (telemetry bağlantısı) SADECE `getAllMetrics()`'e bağlanmalı,
  `getProxyMetrics()`'e ASLA (credential log/telemetriye sızar). Bu kural
  THROTTLE/ROTATE_SESSION_ONLY köprüsü kapatılırken de korundu.
- **(Yeni — Session 3)** `EngineFactoryOptions.authValidator` (`validationUrl`,
  `unauthenticatedUrlPatterns`, `navigationTimeoutMs?`) **ZORUNLU** alan —
  bilinçli olarak opsiyonel bırakılmadı. Composition root bu değerleri
  vermeden `EngineFactory.createProductionEngine()` derleme zamanında
  reddedilir; `DefaultAuthValidator`'ın kendi constructor'ı da aynı alanlar
  boşsa ayrıca runtime'da throw eder (iki kat güvence, sessiz fallback yasak
  — Madde 22 disiplini). Demo bloğundaki `validationUrl`/
  `unauthenticatedUrlPatterns` gerçek panel/login URL'leri DEĞİL, açıkça
  `// TODO` etiketli placeholder — production'a alınmadan gerçek değerlerle
  değiştirilmeli.
- **(Yeni — Session 3)** `DefaultAuthValidator.validate()`: ağ/DNS/timeout
  hatası (`page.goto()` throw) ve beklenmeyen HTTP yanıtı (`!response.ok()`)
  artık `AuthValidationNetworkError` (yeni, `auth-validation.types.ts`)
  fırlatıyor — `false`/`true` SADECE hedef sayfaya gerçekten ulaşılıp
  `unauthenticatedUrlPatterns` değerlendirilebildiğinde dönüyor. Bu hata,
  `PersistentStateEngine`'in genel rollback `catch`'i tarafından yakalanıyor
  ama (kasıtlı olarak) `AuthRestoreFailedError` gibi özel bir
  `AUTH_VALIDATION_FAILED` anomaly'si TETİKLEMİYOR — ağ hatası, auth hatası
  değildir. `PersistentStateEngine.ts`'e bu ayrım için ayrıca dokunulmadı.
- **(Yeni — Session 3)** `IStateObserver.ts`/`IResourceAdapter.ts`, Madde #33
  kapsamında `legacy/`'den `src/adapters/`'a taşındı (`git mv`, içerik
  değişmedi) — artık `src/`'in resmi parçası, legacy değil. Bu iki dosya,
  root-level `AdaptiveGovernor.ts`/`PersistentStateEngine.ts` (Madde #1)
  taramasında gözden kaçmıştı.
- Persistent proxy store için backend seçimi henüz kullanıcıya sorulmadı.
- Secret yönetimi kaynağı (env vs vault) henüz belirlenmedi.

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
> kopyaları (bunlar Taşıma 1/2'de Kapanan Maddeler Geçmişi'nden arşive
> gitmişti ama ANLIK DURUM'daki aynı içerik o taşımalarda gözden kaçmıştı)
> `session_arşiv.md`'ye (Taşıma 3) eklendi, ekteki `session_arsiv_tasima3.md`
> dosyasına bakınız — silinmedi, sadece SESSION_INDEX'te kısa özet/referans
> bırakıldı.

- **Madde #22 — alt-kapsam genişletmesi (THROTTLE + ROTATE_SESSION_ONLY→
  `markFailed` köprüsü, tip-guard dahil) KAPANDI (Session 3, runtime +
  derleme doğrulaması; madde'nin kendisi P0 tablosunda AÇIK kalıyor):**
  `THROTTLE` aksiyonu için `markFailed` köprüsü önceki turda kapatılmıştı;
  bu turda `ROTATE_SESSION_ONLY` aksiyonu için aynı köprü + iki aksiyon
  arasında doğru ayrımı yapan bir tip-guard eklendi (`CHALLENGE_DETECTED`
  gibi diğer aksiyonlarda `markFailed` YANLIŞLIKLA tetiklenmemeli — bu,
  Test 2'nin yeni regresyon assertion'ının konusu). Doğrulama —
  `runtime-check` betiğiyle **7/7 PASS, 0 FAIL**:
  - Test 1 (3 assertion) — ayrıntı bu turda paylaşılmadı, önceki turdan
    geçerliliğini koruyor olarak kabul edildi.
  - Test 2 (3 assertion) — `CHALLENGE_DETECTED` action'ında `markFailed`
    çağrıl**MADIĞI** yeni regresyon assertion'ı ile doğrulandı.
  - Test 3 (1 assertion) — `markFailed('HTTP_429')` eski aktif proxy'ye
    doğru uygulandı, `http429Count` 0→1 değişimi doğrulandı.
  `npx tsc --noEmit` → temiz prompt, **0 hata**.
  **Sınır:** Madde #22'nin diğer `GovernorAction` türleri (varsa —
  `FULL_RECOVERY` dahil) için instrumentation bağlantısı bu turda
  kapsanmadı; madde bu nedenle P0 tablosunda AÇIK kalmaya devam ediyor.
  **Açık nokta:** Bu turun test/derleme ortamında `ts-node@10.9.2` ile
  `typescript@^7.0.2` arasında bir uyumsuzluk gözlemlendi (`tsx` ile
  atlatıldı) — ayrıntı ve genelleştirilebilirlik kararı için aşağıdaki
  ⚠️ DERSLER bölümüne bakınız.

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
- **(Yeni — Session 3)** Bir alt-katmanın (guard/re-entrancy) temiz
  doğrulanması, üst semptomun (auth-validation başarısızlığı) çözüldüğü
  anlamına gelmez — kapsam daraldıkça madde AÇIK kalmaya devam eder, teşhis
  bir sonraki katmana taşınır; erken kapanış iddiası yasak.
- **(Yeni — Session 3)** Bir maddenin kapsamını genişletmek (örn. "aynı
  dosyada, aynı sızıntıya sahip ikinci bir metod daha var") için gerçek
  tüketici kodu görülmeden onay istemek riskli — dosya başlığındaki eski
  bir not güncel gerçeği yansıtmayabilir, genişletme onayı SADECE gerçek
  kod görüldükten sonra istenmeli. **(Doğrulanan tekrar — bu turda)** aynı
  kalıp ters yönde de gerçekleşti: `recordSuccess`'in "kapsam dışı" olduğu
  iddiası da eski bir dosya başlığı notuna dayanıyordu ve yanlıştı — gerçek
  kod (`handleObserverState`, satır 426/340) görülünce düzeltildi. Ders
  ikiye katlandı: dosya başlığı notu ne "genişletme" ne de "daraltma"
  yönünde tek başına yeterli kanıt değildir, her iki yönde de gerçek koda
  bakılmalı.
- **(Yeni — Session 3)** Bir hata durumunu (ağ/DNS hatası) başka bir hata
  durumuyla (gerçek "unauthenticated" pattern eşleşmesi) aynı dönüş
  değerine (`false`) sıkıştırmak, ikisini birbirinden ayırt edilemez hale
  getirir — bu, "runtime doğrulaması" adımının kendisi sırasında (yanlışlıkla
  girilen bir placeholder domain üzerinden) ortaya çıktı; test yanlış
  sebepten "geçmiş" görünüyordu. Ders: bir testin "geçti" demesi yetmez,
  NEDEN geçtiği de doğrulanmalı.
- **(Yeni — Session 3)** Bir dosyayı repo'daki gerçek adından farklı bir
  isimle (`auth-validation_types.ts` vs gerçek `auth-validation.types.ts`)
  artifact olarak vermek, kullanıcının onu üzerine yazmak yerine ayrı bir
  dosya olarak yüklemesine yol açtı — hem `tsc` hem runtime import hatası
  bu yüzden çıktı. Ders: verilen dosya adı, hedef repo yoluyla nokta/alt
  çizgi dahil BİREBİR eşleşmeli, ya da hedef yol açıkça belirtilmeli.
- **(Yeni — Session 3)** Madde #1'in "root-level duplicate dosyalar
  legacy'ye taşınsın" taraması, aynı riski taşıyan interface/sözleşme
  dosyalarını (`IStateObserver.ts`, `IResourceAdapter.ts`) yakalamamıştı —
  bu, yeni bir modül `src/` altına yazılırken sadece "dosyayı nereye
  yazıyorum" değil, "import ettiğim şey gerçekte nerede duruyor" sorusunun
  da ayrıca kontrol edilmesi gerektiğini gösterdi; "Madde X kapandı" etiketi
  benzer riskli dosyaların tamamının tarandığı anlamına gelmez.
- **(Yeni — Session 3)** Test/derleme aracı sürüm uyumsuzluğu (bu turda:
  `ts-node@10.9.2` + `typescript@^7.0.2`) çalıştırma zamanında KOD
  kaynaklıymış gibi görünen bir hataya yol açabilir — kök sebep kodda değil
  araç/sürüm zincirindeydi, `tsx` ile atlatılınca ortaya çıktı. Ders: bir
  betik çalıştırma hatası alındığında önce "hangi araç, hangi sürüm"
  kontrol edilmeli; kod içi teşhise (Kural #1 — tahmin etme) bundan önce
  geçilmemeli. Bu proje TypeScript/Node tabanlı olduğu için sürüm
  uyumsuzlukları tekrar edebilir — bu nedenle not projeye genel, tek bir
  kullanıcının ortamına özgü değil.
- **(Yeni — Session 3)** "Derleniyor" (`tsc --noEmit` temiz) ile "runtime'da
  fiilen çağrılıyor" arasındaki fark tek bir maddeye özgü değil, tekrar eden
  bir kalıp: Madde #22'nin `markFailed` köprüsünde runtime-check ile
  kapatıldı, `recordSuccess` köprüsünde ise henüz sadece kod-varlığı
  doğrulandı — aynı maddenin iki alt-kapsamı bile farklı doğrulama
  seviyelerinde olabilir, "madde #22 çalışıyor" gibi genellemeler yasak;
  hangi alt-kapsamın hangi seviyede doğrulandığı ayrı ayrı izlenmeli.

---

*Not (Session 3, `wc -l` ile doğrulandı): Madde #22 alt-kapsam girdisi
eklenmesiyle dosya önce 400 satır eşiğine yaklaşacaktı (Kural #11); bunu
önlemek için en eski iki kapanmış girdi (Süreç dışı `authValidator` wiring
bug'ı + Madde #33 alt-adımı) `session_arşiv.md`'ye (Taşıma 2) TAM olarak
taşındı — hiçbir şey özetlenmedi/silinmedi, ayrıntı için o dosya.
SESSION_INDEX.md bu turda `recordSuccess` bulgusu ve iki yeni açık soru
eklenmesiyle satır sayısı arttı; 400 satır eşiği bu turda AŞILMADI (dosya
hâlâ eşiğin altında), bu nedenle ek bir arşivleme yapılmadı. Açık maddeler
(P0/P1/P2) ve anlık durum değişmeden korunuyor; Madde #22 P0 tablosunda
AÇIK, `recordSuccess` alt-kapsamı için runtime doğrulama yöntemi kullanıcı
onayı bekliyor.*
