# STATE-SYNC-ENGINE — SESSION INDEX
> Bu dosya her session başında okunur. CORE.md ile birlikte verilir.
> Claude bu dosyadan anlık durumu, açık maddeleri ve sıradaki önceliği anlar.
> Her session kapanışında TAM DOSYA olarak güncellenir. Kapanan madde bu
> tablodan silinir, kapanış gerekçesi "Kapanan Maddeler Geçmişi" bölümüne
> tek satır olarak eklenir (Bowlera projesinden alınan ders: "tamamlandı"
> iddiası, kod + kullanıcı erişimi ikisi birden doğrulanmadan işaretlenmez).

---

## ⚡ ANLIK DURUM

- **Session:** 4 (devam ediyor)
- **(Yeni) Madde #37 alt-adım (a) — better-sqlite3 bağımlılık düzeltmesi:
  TAMAMLANDI ve DOĞRULANDI (Session 4).**
  - `package.json` güncellendi: `dependencies`'e `"better-sqlite3": "^13.0.1"`
    eklendi (ilk önerilen `^12.11.2` yerine — web_search ile doğrulandı: v13.0.0
    N-API tabanlı, prebuilt binary taşınabilirliği daha yüksek, Madde #37'nin
    "local'de çalışıyor, CI'da/production'da patlıyor" riskine doğrudan
    hitap ediyor). `devDependencies`'e `"@types/better-sqlite3": "^7.6.13"`
    eklendi (better-sqlite3 kendi TS tiplerini içermiyor, DefinitelyTyped'dan
    geliyor).
  - Repo köküne izole bir smoke-test dosyası eklendi:
    `runtime-check-better-sqlite3.ts` — in-memory DB aç → tablo oluştur →
    insert → select → kapat, structured JSON log (Kural #4), açıkça
    `process.exitCode` set eder (Madde #25 dersi).
  - **Kod + kullanıcı erişimi ikisi birden doğrulandı** (Kural #4/Dersler):
    `npm install` gerçek çıktısı paylaşıldı (temiz kurulumda "added 9
    packages", better-sqlite3 derleme gerektirmeden kuruldu — v13 prebuilt
    beklentisi doğrulandı) + runtime smoke-test gerçek çıktısı paylaşıldı
    (`allOk:true`, tüm adımlar `ok:true`, `echo $?` → `exit_code=0`).
  - **Yolda çıkan ve çözülen engel:** `npx ts-node runtime-check-better-sqlite3.ts`
    ile ilk deneme `TypeError: Cannot read properties of undefined (reading
    'fileExists')` hatasıyla patladı (`ts-node/dist/configuration.js`,
    `ts.sys.fileExists` undefined). Kök neden: `ts-node`, `typescript
    ^7.0.2` (TS7) ile uyumsuz — TS7'nin `ts.sys` iç API'si `ts-node`'un
    beklediğinden farklı. Çözüm: `npx tsx runtime-check-better-sqlite3.ts`
    kullanıldı, sorunsuz çalıştı (`tsx` esbuild tabanlı, TS compiler API'sine
    bağımlı değil). Bu, better-sqlite3'ten bağımsız, ayrı bir araç
    uyumsuzluğuydu — karıştırılmadı (Kural #5). Proje geneli etkisi olup
    olmadığı açık — bkz. ❓ Cevap Bekleyen Sorular.
  - **Sıradaki alt-adım: (b) deploy hedefi kararı hâlâ açık ve seçilmedi.**
- **(Değişmedi) Madde #37 — Deploy hedefi netleştirme + native-modül smoke
  testi: AÇIK, AKTİF ÖNCELİK (Session 4).** Gerekçe (orijinal): gerçek zip
  repo'su incelenirken şu somut blokerler bulundu:
  - ~~`better-sqlite3` `package.json`'da hiç yok~~ — **çözüldü, yukarı bakın.**
  - `package.json`'da `scripts` alanı yok — build/start/test için tek
    komut tanımsız. **Bu alt-adıma dahil edilmedi (Kural #5)**, ayrı ele
    alınacak.
  - `src/index.ts`'te gerçek `// TODO` placeholder: `validationUrl:
    'https://your-app.example.com/dashboard'` — production'a bu haliyle
    çıkarsa auth validation kırılır.
  - Deploy hedefi (Fly.io "aday") hiç somutlaşmamış — Dockerfile/fly.toml
    yok, CI (`.github/`) yok, `.env` şablonu yok.
  **(b) kapsamı (henüz UYGULANMADI):** deploy hedefini kesinleştirip minimal
  bir "hello world" smoke deploy yapmak — amaç sadece native modüllerin
  (`better-sqlite3` + Playwright headless Chromium) o ortamda ayağa
  kalktığını görmek, gerçek feature deploy'u değil. Gerçek test framework'ü
  (jest/vitest) + CI kurulumu **kasıtlı olarak bu maddeye dahil edilmedi**
  — Madde #9'un ertelenen entegrasyon testiyle aynı ana denk getirilmesi
  öneriliyor (Kural #5).
  **CI planı kaydedildi, henüz UYGULANMADI:** GitHub Actions CI'ın,
  deploy'da kullanılacak aynı resmi Playwright Docker image'ı
  (`mcr.microsoft.com/playwright:vX-noble`) üzerinde çalıştırılması
  öneriliyor — native modül derleme toolchain'i zaten image içinde geliyor,
  "local'de çalışıyor ama CI'da/production'da patlıyor" riskini CI ve
  deploy'un AYNI ortamı kullanması ortadan kaldırıyor. Deploy hedefi
  kararından BAĞIMSIZ olarak şimdiden planlanabilir.
  **Fly.io güncel durum araştırması (Session 4, web_search ile doğrulandı):**
  Resmi `fly.io/pricing/` sayfası artık "No plans and no tiers" diyor —
  genel bir ücretsiz katman YOK, tamamen kullanım bazlı (saniye bazlı)
  faturalama. Yeni hesaplar için ücretsiz kalıcı katman 2024 sonunda
  kaldırıldı. Resmi maliyet örneği: en küçük `shared-1x 256MB` makine her
  zaman açık kalırsa ~$2.32/ay; bu projenin ihtiyacı (Playwright headless
  Chromium + `better-sqlite3` için kalıcı volume) 256MB'ın muhtemelen
  yetmeyeceği için gerçekçi tahmin **$5-15+/ay** aralığında. **Kesinleşmemiş
  karar:** Fly.io'nun ücretsiz seçenek SUNMADIĞI netleşti — kullanıcının
  bunu bilerek mi devam edeceği, yoksa ücretsiz alternatif (ör. Render free
  tier) mi araştırılacağı henüz kararlaştırılmadı.
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - **Madde #1, #5, #6, #7, #8, #9 (alt-bug), #23, #22, #13, #33, #2, #15 —
    hepsi TAM KAPANDI.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 1-5).
  - **Süreç dışı `authValidator` wiring bug'ı — TAM KAPANDI.** Tam ayrıntı
    `session_arşiv.md`'de (Taşıma 2/3).
  - **Madde #24 — Engine lifecycle (start/stop/dispose): TAM KAPANDI
    (Session 3).** Tam ayrıntı artık `session_arşiv.md`'de (Taşıma 6). Kısa
    özet: `lifecycleState` guard'ı + idempotent `close()` + observer
    referans sızıntısı düzeltmesi + `EngineFactory.disposeEngine()`.
  - **Madde #25 — Graceful shutdown (SIGTERM/SIGINT): TAM KAPANDI
    (Session 3).** Tam ayrıntı artık `session_arşiv.md`'de (Taşıma 6). Kısa
    özet: `createShutdownController()` izole guard fonksiyonu, main-entry
    `SIGTERM`/`SIGINT`'e bağlandı.
  - **Madde #27 — Merkezi immutable configuration (ilk slice): TAM KAPANDI
    (Session 3).** `src/config/Config.ts` + `src/config/loadConfig.ts`,
    tüketicisiz (Kural #5). Tam ayrıntı artık `session_arşiv.md`'de
    (Taşıma 7).
  - **Madde #12 — State versioning / migration (StateEnvelope, ilk slice):
    TAM KAPANDI (tüketicisiz, Session 3).** `src/types/
    state-envelope.types.ts`, tüketicisiz (Kural #5). Tam ayrıntı artık
    `session_arşiv.md`'de (Taşıma 7).
- **Sıradaki öncelik: Madde #37 alt-adım (b) — deploy hedefi kararı
  (Session 4).** P0 tablosunda hâlâ sadece **#9** açık — ertelenmiş, aktif
  çalışılmıyor. Diğer bekleyen seçenekler (öncelik #37'nin gerisinde):
  (c) #9'un ertelenmiş entegrasyon testi; (d) Madde #27'nin tüketicilere
  bağlanması; (e) Madde #12'nin gerçek wiring'i; (f) composition-root/
  `dbPath` sorusu; (g) Madde #25 turunda çıkan `process.exitCode` gözlemi;
  (h) stray-`.js` kirliliğinin madde olarak açılıp açılmayacağı; (i) *(Yeni)*
  `ts-node`→`tsx` geçişinin proje geneline yayılıp yayılmayacağı. Ayrıca
  hâlâ açık: #9 vs #17 etiket tutarsızlığı sorusu (bkz. ❓ Cevap Bekleyen
  Sorular).
- **⚠️ Dosya boyutu notu (değişmedi):** `TASIMA_5.md`/`TASIMA_6.md`/
  `TASIMA_7.md` bloklarının `session_arşiv.md`'nin sonuna eklendiği bu
  turda kullanıcı tarafından gerçek komut çıktısıyla (`wc -l
  session_arşiv.md` → 725 satır) TEYİT EDİLDİ. Bekleyen "ekle" notu
  kaldırıldı.

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu yanıt
  gelmeden değiştirilmedi.
- **`src/network/AdvancedProxyManager.js`, `src/security/SecretProvider.js`,
  `src/state/ProxyCredentialStore.js`, `src/state/ProxyHealthStore.js` —
  stray derlenmiş `.js` dosyaları (Madde #12 doğrulaması sırasında
  bulundu):** Bunlar numaralı bir madde olarak mı açılsın (P2), yoksa
  rastgele bir sonraki turda mı temizlensin? **Kullanıcıdan yanıt
  bekleniyor.**
- **(Yeni) `ts-node` → `tsx` geçişi proje geneli mi yapılsın, yoksa sadece
  bu izole `runtime-check-better-sqlite3.ts` için mi kullanılsın?** Madde
  #30'un test planı zaten `node:test`'e göç öngörüyor (ts-node'dan tamamen
  bağımsız, esasen bu riski test tarafında zaten ortadan kaldırıyor), bu
  yüzden asıl açık soru sadece ad-hoc `runtime-check-*.ts` dosyalarının
  (test piramidi kurulana kadar) nasıl çalıştırılacağı. **Kullanıcıdan
  yanıt bekleniyor.**
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
| 14 | Telemetry aggregation katmanı | telemetry |
| 16 | Correlation ID / distributed tracing | telemetry |
| 28 | Retry budget | policies |
| 29 | Circuit breaker (proxy/session/resource) | policies |
| 37 | Deploy hedefi netleştirme + native-modül smoke testi (`better-sqlite3` + Playwright) | deploy/packaging — **AKTİF ÖNCELİK** (alt-adım (a) TAMAMLANDI, alt-adım (b) açık) |

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
| — | Stray derlenmiş `.js` kirliliği (`src/network/AdvancedProxyManager.js`,
    `src/security/SecretProvider.js`, `src/state/ProxyCredentialStore.js`,
    `src/state/ProxyHealthStore.js`) | network/security/state — Madde #12
    doğrulaması sırasında bulundu, henüz numaralı bir madde değil, formalize
    edilip edilmeyeceği kullanıcı kararına bağlı — bkz. Cevap Bekleyen
    Sorular |
| 26 | Health/readiness endpoint | engine |
| 30 | Test piramidi kurulumu | test — **UYGULAMA PLANI KAYITLI (Session 4):** `node:test` (Node'un built-in test runner'ı, Node 22+ native TS type-stripping) ile 12 mevcut `runtime-check-*.ts` dosyasının `*.test.ts`'e göçü + `package.json`'a `"test": "node --test"` script'i eklenmesi. Vitest yerine `node:test` tercih edildi çünkü (a) projede Vite yok, (b) sıfır ek bağımlılık — `ts-node`/TS7 uyumsuzluğu bir daha yaşanmaz (bkz. bu turda çıkan yeni ders), (c) mevcut custom `expect` helper mantığı `node:test`'e yakın, sıfırdan yazım değil göç olur. Henüz UYGULANMADI, sadece plan kaydedildi. |
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
  `package.json`'da `"type": "module"` YOK — yani `module: Node16` ile
  birlikte derlenmiş çıktı fiilen CommonJS'tir, CJS modülleri varsayılan
  strict mode'da DEĞİLDİR (bu, `Object.freeze()` ihlallerinin sessizce
  no-op olup throw ETMEMESİNİN kök nedeni).
- **(Yeni)** Proje `typescript ^7.0.2` (TS7) kullanıyor — bu, `ts-node` ile
  runtime çalıştırmada `ts.sys.fileExists` okuma hatasına yol açıyor
  (bkz. Dersler). Repo dosyalarını doğrudan çalıştırmak için `ts-node`
  yerine `npx tsx <dosya>.ts` kullanılmalı, ta ki Madde #30 kapsamında
  `node:test`'e geçilene kadar.
- `better-sqlite3` sürümü **`^13.0.1`** (N-API tabanlı, Node 26 prebuild
  desteği var), tip tanımları `@types/better-sqlite3 ^7.6.13`'ten geliyor
  (Madde #37 alt-adım (a), bu turda kapandı).
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
  eklendi, ikisini eşleyen TEK yer
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
  credential'lı) kasıtlı olarak farklı davranıyor.
- `EngineFactoryOptions.authValidator` **ZORUNLU** alan. Demo bloğundaki
  placeholder URL'ler production'a alınmadan gerçek değerlerle
  değiştirilmeli.
- `DefaultAuthValidator.validate()`: ağ/DNS/timeout hatası
  `AuthValidationNetworkError` fırlatıyor — (kasıtlı olarak)
  `AUTH_VALIDATION_FAILED` anomaly'si TETİKLEMİYOR.
- **Madde #2 — proxy store backend: SQLite (`better-sqlite3`), `Proxy
  CredentialStore` ile aynı DB, ayrı `proxy_health` tablosu, TTL=24 saat.**
  TAM KAPANDI — tam gerekçe/doğrulama Taşıma 5'te.
- **Madde #13 — secret kaynağı: env var (`STATE_SYNC_ENCRYPTION_KEY`) +
  AES-256-GCM envelope encryption.** TAM KAPANDI — tam gerekçe/doğrulama
  Taşıma 5'te.
- **Madde #15 — merkezi loglama: `src/telemetry/ILogger.ts` +
  `ConsoleJsonLogger.ts`, opsiyonel constructor enjeksiyonu.** TAM KAPANDI —
  tam gerekçe/doğrulama Taşıma 5'te.
- **Madde #24 — engine lifecycle sözleşmesi.** TAM KAPANDI — tam
  gerekçe/doğrulama artık Taşıma 6'da.
- **Madde #25 — graceful shutdown sözleşmesi.** TAM KAPANDI — tam
  gerekçe/doğrulama artık Taşıma 6'da.
- **Madde #27 — merkezi config sözleşmesi.** TAM KAPANDI (ilk slice,
  tüketicisiz) — tam gerekçe/doğrulama artık Taşıma 7'de.
- **Madde #12 — StateEnvelope<T> sözleşmesi (ilk slice, tüketicisiz).**
  TAM KAPANDI — tam gerekçe/doğrulama artık Taşıma 7'de.
- **Deploy hedefi (süreç kararı, madde dışı) KARARLAŞTIRILDI (aday):
  Fly.io** — persistent volume + resmi Playwright Docker image.
  Kesinleşmiş değil (ücretsiz katman yok, maliyet netleşmeli).

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

> **(Session 3, Taşıma 1-4)** Madde #1, #5, eski #6, #6/#7/#8, #9 alt-bug,
> #23, süreç dışı `authValidator` wiring bug'ı, Madde #22 ve #33 alt-adım
> girdileri — `session_arşiv.md`'ye (Taşıma 1-4) TAM olarak taşındı,
> silinmedi. Ayrıntı için o dosya.
> **(Session 3, Taşıma 5)** Madde #22, #13, #33, #2, #15'in TAM METİN
> kapanış anlatıları ve 5 adet çözülmüş Cevap Bekleyen Soru, `TASIMA_5.md`
> bloğu olarak verildi.
> **(Session 3→4, Taşıma 6)** Madde #24, #25'in TAM METİN kapanış
> anlatıları, `TASIMA_6.md` bloğu olarak verildi.
> **(Session 3→4, Taşıma 7)** Madde #27, #12'nin TAM METİN kapanış
> anlatıları, `TASIMA_7.md` bloğu olarak verildi.
> **Taşıma 5/6/7'nin `session_arşiv.md`'nin sonuna eklendiği bu turda
> kullanıcı tarafından gerçek komut çıktısıyla (`wc -l session_arşiv.md`
> → 725 satır) TEYİT EDİLDİ.** Hiçbir içerik silinmedi, sadece taşındı.
> **(Yeni — Session 4) Madde #37 alt-adım (a) — better-sqlite3 bağımlılık
> düzeltmesi TAMAMLANDI ve DOĞRULANDI** (yukarıda ANLIK DURUM'da tam
> ayrıntı; henüz arşive taşınmadı, dosya 400 satır eşiğini aşmadığı için
> gerekli değil).

- *(Madde #22, #13, #33, #2, #15'in tam kapanış kayıtları Taşıma 5 ile
  `session_arşiv.md`'ye taşındı — bkz. `TASIMA_5.md`.)*
- *(Madde #24, #25'in tam kapanış kayıtları Taşıma 6 ile `session_arşiv.md`'ye
  taşındı — bkz. `TASIMA_6.md`.)*
- *(Madde #27, #12'nin tam kapanış kayıtları Taşıma 7 ile
  `session_arşiv.md`'ye taşındı — bkz. `TASIMA_7.md`.)*

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
  kodu görülmeden karar vermek riskli.
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
  gelmez.
- **(Madde #13 turu)** "Terminalde hata satırı görünmüyor" ile "komut
  gerçekten 0 döndü" farklı doğrulama seviyeleridir — `echo $?` ile teyit
  edilmeden derleme adımı "temiz" sayılmamalı.
- **(Madde #13 turu)** Bir ekran görüntüsünde açığa çıkan gerçek bir
  secret/key, production'a alınmadan rotate edilmeli önerisi verilmeli.
- **(Madde #13 turu)** Bir madde kapansa bile, kodun production'da fiilen
  kullanılması ayrı ve hâlâ açık bir takip maddesi olabilir.
- **(Madde #33 turu)** Jenerik bir sözleşmeyi genişletirken yeni değerlere
  BİLİNÇLİ OLARAK tüketici katmandaki benzer isimli tiplerden FARKLI isimler
  vermek, iki ayrı sözleşmenin karıştırılmasını daha başından engeller.
- **(Madde #33 turu)** "Bilinçli olarak kapsam dışı bırakıldı" notu, kod
  ilerledikçe geçersiz kalabilir — kapanış notları hem SESSION_INDEX'te hem
  ilgili kod dosyasının kendi başlığında güncellenmeli.
- **(Madde #2 turu)** Write-through olmayan bir persistence kararı kalıcı
  bir trade-off yaratır — kapanışta açıkça not düşülmeli.
- **(Madde #2 turu)** Aynı composition-root açık takibi birden fazla maddede
  tekrar ediyorsa, composition-root'un kendisi ayrı bir P1/P0 madde adayı
  olarak değerlendirilmeli.
- **(Madde #15 turu)** Bir grep sonucu ile gerçek dosya içeriği arasındaki
  fark, oturum İÇİNDE üretilen ara çıktıların da bayatlayabileceğinin
  kanıtıdır.
- **(Madde #15 turu)** İzole bir birim testinin PASS olması, tüketici
  dosyaların gerçek entegrasyonunu KANITLAMAZ.
- **(Madde #15 turu)** Bir maddenin kapanışını kapsamı dışındaki başka bir
  açık bağımlılığa bağımlı hale getirmek yerine, o bağımlılığı gerektiren
  test/alt-parçayı GEÇİCİ olarak izole edip ayrı bırakmak (Kural #5), farklı
  maddelerin kapanış koşullarının birbirine karışmasını önler.
- **(Madde #24 turu)** Yerel bir `ts-node`/Node.js sürüm uyumsuzluğu
  (`ts-node@10.9.2` + Node 24), çalıştırma zamanında KOD kaynaklıymış gibi
  görünen bir config-okuma hatası üretebilir — `tsc --noEmit` zaten PASS
  veriyorsa önce araç sürümünden şüphelenilmeli.
- **(Madde #24 turu)** Bir dispose/guard bug'ı tespit sırasında sadece tek
  bir çağrı noktasında fark edilebilir ama gerçekte HER çağrı noktasında
  tekrarlanıyor olabilir.
- **(Madde #25 turu)** İzole bir `runtime-check-*.ts` dosyasının konumu,
  proje konvansiyonuna (repo kökü) uymazsa relative import yolları
  sessizce kırılır.
- **(Madde #25 turu)** Bir `catch` bloğunun hatayı loglaması, process'in
  doğru exit code ile çıktığı anlamına gelmez.
- **(Madde #27 turu)** Bir dosyanın "repo köküne verildi/kondu" şeklindeki
  bir bildirim, gerçek `ls`/`find` çıktısıyla teyit edilmeden bir sonraki
  adımda "mevcut" sayılmamalı — sohbet içinde anlatılan bir dosya, diske
  hiç yazılmamış olabilir. **(Madde #37 turunda tekrar doğrulandı:**
  `present_files`/artifact ile "verilen" bir dosya, kullanıcının kendi
  ortamına OTOMATİK kopyalanmaz — kullanıcının onu manuel olarak
  Codespace/repo'ya taşıması gerekir; bu adım atlanınca `MODULE_NOT_FOUND`
  ile sonuçlandı.**)**
- **(Madde #27 turu)** `Object.freeze()`'in bir property'ye atamayı
  ENGELLEMESİ ile bu atamanın THROW etmesi farklı garantilerdir — strict/
  sloppy ayrımı projenin gerçek modül sistemine bağlı.
- **(Yeni — Madde #37 turu)** `ts-node`, `typescript ^7.0.2` (TS7) ile
  uyumsuz: `ts.sys.fileExists` okumada `TypeError: Cannot read properties
  of undefined` hatası veriyor (`ts-node/dist/configuration.js`). Bu,
  Madde #24 turundaki "ts-node/Node sürüm uyumsuzluğu" dersinin bir
  benzeri ama farklı kaynağı — burada suçlu Node sürümü değil, TS'nin
  major sürümü. `tsc --noEmit` PASS veriyorsa ve `ts-node` yine de
  runtime'da patlıyorsa, önce TS/ts-node sürüm uyumuna bakılmalı; `tsx`
  (esbuild tabanlı, TS compiler API'sine bağımlı değil) hızlı bir
  alternatif olarak doğrulandı.
- **(Yeni — Madde #37 turu)** Bir bağımlılık sürüm numarası (özellikle
  major.minor.patch üçlüsü) kod içinde veya `package.json`'da görülünce
  bile GERÇEK olduğu varsayılmamalı — o sürümün npm registry/GitHub
  releases'te gerçekten var olup olmadığı ayrıca doğrulanmalı. Bu turda
  yerel bir `package.json` değişikliğinde hem `better-sqlite3@^13.0.3`
  hem `@types/better-sqlite3@^9.6.0` yer alıyordu, ikisi de mevcut
  olmayan sürümlerdi (gerçek en güncel sürümler sırasıyla 13.0.1 ve
  7.6.13) — web_search ile doğrulanmadan kullanılsaydı `npm install`
  hata verirdi.
