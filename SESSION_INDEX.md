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
- **(Yeni) Madde #37 — Deploy hedefi netleştirme + native-modül smoke testi:
  AÇILDI, AKTİF ÖNCELİK (Session 4).** Gerekçe: gerçek zip repo'su
  incelenirken (kullanıcı isteğiyle) şu somut blokerler bulundu — hiçbiri
  daha önce SESSION_INDEX'te ayrı bir madde olarak takip edilmiyordu:
  - `better-sqlite3` (`ProxyCredentialStore.ts`, `ProxyHealthStore.ts`
    tarafından import ediliyor) `package.json`'da **hiç yok** — repo temiz
    klonlanıp `npm install` yapılırsa çalışmaz.
  - `package.json`'da `scripts` alanı yok — build/start/test için tek
    komut tanımsız.
  - `src/index.ts`'te gerçek `// TODO` placeholder: `validationUrl:
    'https://your-app.example.com/dashboard'` — production'a bu haliyle
    çıkarsa auth validation kırılır.
  - Deploy hedefi (Fly.io "aday") hiç somutlaşmamış — Dockerfile/fly.toml
    yok, CI (`.github/`) yok, `.env` şablonu yok.
  **Kapsam (bu turda üzerinde anlaşılan, henüz UYGULANMADI):**
  (a) `better-sqlite3`'ü `package.json`'a eklemek + temiz klonda kurulup
  derlendiğini teyit etmek; (b) deploy hedefini kesinleştirip minimal bir
  "hello world" smoke deploy yapmak — amaç sadece native modüllerin
  (`better-sqlite3` + Playwright headless Chromium) o ortamda ayağa
  kalktığını görmek, gerçek feature deploy'u değil. Gerçek test framework'ü
  (jest/vitest) + CI kurulumu **kasıtlı olarak bu maddeye dahil edilmedi**
  — Madde #9'un ertelenen entegrasyon testiyle aynı ana denk getirilmesi
  öneriliyor (Kural #5: kapsamı şişirmeme).
  **Fly.io güncel durum araştırması (Session 4, web_search ile
  doğrulandı):** Resmi `fly.io/pricing/` sayfası artık "No plans and no
  tiers" diyor — genel bir ücretsiz katman YOK, tamamen kullanım bazlı
  (saniye bazlı) faturalama. Yeni hesaplar için ücretsiz kalıcı katman
  2024 sonunda kaldırıldı; yeni kayıtlar kısa bir deneme süresiyle
  başlıyor, sonrasında kredi kartı zorunlu. Resmi maliyet örneği: en küçük
  `shared-1x 256MB` makine her zaman açık kalırsa ~$2.32/ay; bu projenin
  ihtiyacı (Playwright headless Chromium + `better-sqlite3` için kalıcı
  volume) 256MB'ın muhtemelen yetmeyeceği için gerçekçi tahmin **$5-15+/ay**
  aralığında. İlk 10GB snapshot depolama ücretsiz. **Kesinleşmemiş karar:**
  Fly.io'nun ücretsiz bir seçenek SUNMADIĞI netleşti — kullanıcının bunu
  bilerek mi devam edeceği, yoksa ücretsiz alternatif (ör. Render free
  tier, sadece statik/uyku modlu) mi araştırılacağı henüz kararlaştırılmadı.
- **Kaynak:** `ARCHITECTURE_ASSESSMENT.md` (36 madde)
- **Kod durumu:**
  - **Madde #1, #5, #6, #7, #8, #9 (alt-bug), #23, #22, #13, #33, #2, #15 —
    hepsi TAM KAPANDI.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 1-5).
  - **Süreç dışı `authValidator` wiring bug'ı — TAM KAPANDI.** Tam ayrıntı
    `session_arşiv.md`'de (Taşıma 2/3).
  - **Madde #24 — Engine lifecycle (start/stop/dispose): TAM KAPANDI
    (Session 3).** Tam ayrıntı artık `session_arşiv.md`'de (Taşıma 6, bkz.
    bu turda eklenen `TASIMA_6.md` bloğu). Kısa özet: `lifecycleState` guard'ı
    + idempotent `close()` + observer referans sızıntısı düzeltmesi +
    `EngineFactory.disposeEngine()`.
  - **Madde #25 — Graceful shutdown (SIGTERM/SIGINT): TAM KAPANDI
    (Session 3).** Tam ayrıntı artık `session_arşiv.md`'de (Taşıma 6). Kısa
    özet: `createShutdownController()` izole guard fonksiyonu, main-entry
    `SIGTERM`/`SIGINT`'e bağlandı.
  - **(Yeni) Madde #27 — Merkezi immutable configuration (ilk slice): TAM
    KAPANDI (Session 3).** `src/config/Config.ts` + `src/config/
    loadConfig.ts`, tüketicisiz (Kural #5). Tam ayrıntı artık
    `session_arşiv.md`'de (Taşıma 7, `TASIMA_7.md`).
  - **(Yeni) Madde #12 — State versioning / migration (StateEnvelope, ilk
    slice): TAM KAPANDI (tüketicisiz, Session 3).** `src/types/
    state-envelope.types.ts` (`StateEnvelope<T>`, `CURRENT_STATE_VERSION`,
    `UnknownStateVersionError`), tüketicisiz (Kural #5). Tam ayrıntı artık
    `session_arşiv.md`'de (Taşıma 7).
- **Sıradaki öncelik: Madde #37 (kullanıcı kararıyla, Session 4).** P0
  tablosunda hâlâ sadece **#9** açık — ertelenmiş, aktif çalışılmıyor.
  Madde #37 kapsamındaki iki alt-adımdan hangisiyle başlanacağı henüz
  seçilmedi: (a) `better-sqlite3` bağımlılık düzeltmesi (küçük, hızlı,
  bloklayıcı) mı önce, yoksa (b) deploy hedefi kararı (Fly.io'nun artık
  ücretsiz katman sunmadığı netleşti, alternatif değerlendirmesi
  gerekebilir) mı önce ele alınsın. Diğer bekleyen seçenekler (öncelik
  #37'nin gerisinde): (c) #9'un ertelenmiş entegrasyon testi; (d) Madde
  #27'nin tüketicilere bağlanması; (e) Madde #12'nin gerçek wiring'i;
  (f) composition-root/`dbPath` sorusu; (g) Madde #25 turunda çıkan
  `process.exitCode` gözlemi; (h) stray-`.js` kirliliğinin madde olarak
  açılıp açılmayacağı. Ayrıca hâlâ açık: #9 vs #17 etiket tutarsızlığı
  sorusu (bkz. ❓ Cevap Bekleyen Sorular).
- **⚠️ Dosya boyutu notu:** Bu turda **Taşıma 7** yapıldı — Madde #27 ve
  #12'nin tam metinli kapanış anlatıları (ANLIK DURUM, Kritik Teknik
  Kararlar ve Kapanan Maddeler Geçmişi'ndeki kopyalar dahil)
  `session_arşiv.md`'ye eklenmek üzere ayrı bir `TASIMA_7.md` bloğu olarak
  verildi (arşivin kendisi yeniden üretilmedi, sadece yeni blok —
  Kural #11). **Kullanıcıdan istenen:** `TASIMA_7.md` içeriğini mevcut
  `session_arşiv.md`'nin sonuna ekle (append) — Taşıma 5 ve 6 için de bu
  adım hâlâ teyit edilmedi, üçü birlikte eklenebilir.

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. Ya yorum yanlış etiketlenmiş ya da #17 kısmen zaten çözülmüş ve
  tabloya yansımamış. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu
  yanıt gelmeden değiştirilmedi.
- **(Yeni) `src/network/AdvancedProxyManager.js`, `src/security/
  SecretProvider.js`, `src/state/ProxyCredentialStore.js`, `src/state/
  ProxyHealthStore.js` — stray derlenmiş `.js` dosyaları (Madde #12
  doğrulaması sırasında bulundu):** Bunlar numaralı bir madde olarak mı
  açılsın (P2), yoksa `src/types/` kirliliğinde olduğu gibi rastgele bir
  sonraki turda mı temizlensin? **Kullanıcıdan yanıt bekleniyor.**
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
| 37 | Deploy hedefi netleştirme + native-modül smoke testi (`better-sqlite3` + Playwright) | deploy/packaging — **AKTİF ÖNCELİK** (Session 4'te kullanıcı kararıyla açıldı) |

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
    doğrulaması sırasında bulundu (`src/types/` altındaki benzer kirlilik
    o turda temizlendi), henüz numaralı bir madde değil, formalize edilip
    edilmeyeceği kullanıcı kararına bağlı — bkz. Cevap Bekleyen Sorular |
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
  **(Yeni — Madde #27 turu)** `package.json`'da `"type": "module"` YOK —
  yani `module: Node16` ile birlikte derlenmiş çıktı fiilen CommonJS'tir,
  CJS modülleri varsayılan strict mode'da DEĞİLDİR (bu, `Object.freeze()`
  ihlallerinin sessizce no-op olup throw ETMEMESİNİN kök nedeni — değerin
  gerçekten korunması bundan etkilenmez, sadece throw davranışı etkilenir).
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
- **Madde #24 — engine lifecycle sözleşmesi.** TAM KAPANDI — tam
  gerekçe/doğrulama artık Taşıma 6'da (`TASIMA_6.md`).
- **Madde #25 — graceful shutdown sözleşmesi.** TAM KAPANDI — tam
  gerekçe/doğrulama artık Taşıma 6'da.
- **(Yeni) Madde #27 — merkezi config sözleşmesi: `src/config/Config.ts` +
  `src/config/loadConfig.ts`, `STATE_SYNC_*` env prefix konvansiyonu
  (Madde #13 ile aynı), `deepFreeze()` ile runtime immutability.** TAM
  KAPANDI (ilk slice, tüketicisiz) — tam gerekçe/doğrulama artık
  Taşıma 7'de (`TASIMA_7.md`).
- **(Yeni) Madde #12 — StateEnvelope<T> sözleşmesi (ilk slice,
  tüketicisiz).** TAM KAPANDI — tam gerekçe/doğrulama artık Taşıma 7'de.
- **(Yeni) Deploy hedefi (süreç kararı, madde dışı) KARARLAŞTIRILDI (aday):
  Fly.io** — persistent volume + resmi Playwright Docker image. Kesinleşmiş
  değil.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

> **(Session 3, Taşıma 1-4)** Madde #1, #5, eski #6, #6/#7/#8, #9 alt-bug,
> #23, süreç dışı `authValidator` wiring bug'ı, Madde #22 ve #33 alt-adım
> girdileri — `session_arşiv.md`'ye (Taşıma 1-4) TAM olarak taşındı,
> silinmedi. Ayrıntı için o dosya.
> **(Session 3, Taşıma 5)** SESSION_INDEX.md 400 satır eşiği dördüncü kez
> aşıldı (Madde #24 kapanışıyla). Bu tur: Madde #22, #13, #33, #2, #15'in
> TAM METİN kapanış anlatıları ve 5 adet çözülmüş Cevap Bekleyen Soru, ayrı
> bir `TASIMA_5.md` bloğu olarak verildi — kullanıcının bunu
> `session_arşiv.md`'nin sonuna eklemesi gerekiyor.
> **(Yeni — Session 3→4, Taşıma 7)** SESSION_INDEX.md 400 satır eşiği
> altıncı kez aşıldı (Madde #37'nin açılmasıyla). Bu tur: Madde #27, #12'nin
> TAM METİN kapanış anlatıları (ANLIK DURUM + Kritik Teknik Kararlar + bu
> bölümdeki kopyalar), ayrı bir `TASIMA_7.md` bloğu olarak verildi —
> **kullanıcının bunu mevcut `session_arşiv.md`'nin sonuna eklemesi
> gerekiyor** (Taşıma 5/6 ile birlikte, üçü de henüz teyit edilmedi).
> Hiçbir içerik silinmedi, sadece taşındı.

- *(Madde #22, #13, #33, #2, #15'in tam kapanış kayıtları Taşıma 5 ile
  `session_arşiv.md`'ye taşındı — bkz. `TASIMA_5.md`. Kısa referans: hepsi
  TAM KAPANDI, sırasıyla P0/P0/P0/P1/P1 tablolarından kaldırıldı.)*
- *(Madde #24, #25'in tam kapanış kayıtları Taşıma 6 ile `session_arşiv.md`'ye
  taşındı — bkz. `TASIMA_6.md`. Kısa referans: hepsi TAM KAPANDI, P1
  tablosundan kaldırıldı.)*
- *(Madde #27, #12'nin tam kapanış kayıtları Taşıma 7 ile
  `session_arşiv.md`'ye taşındı — bkz. `TASIMA_7.md`. Kısa referans: ikisi
  de TAM KAPANDI (ilk slice, tüketicisiz), P1 tablosundan kaldırıldı.)*

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
- **(Madde #24 turu)** Yerel bir `ts-node`/Node.js sürüm uyumsuzluğu
  (`ts-node@10.9.2` + Node 24), çalıştırma zamanında KOD kaynaklıymış gibi
  görünen bir config-okuma hatası üretebilir — `tsc --noEmit` zaten PASS
  veriyorsa önce araç sürümünden şüphelenilmeli.
- **(Madde #24 turu)** Bir dispose/guard bug'ı (referans saklanmaması)
  tespit sırasında sadece tek bir çağrı noktasında fark edilebilir ama
  gerçekte HER çağrı noktasında tekrarlanıyor olabilir — kök nedeni
  düzeltmeden tek noktaya yama yapmak sorunu tam kapatmaz.
- **(Madde #25 turu)** İzole bir `runtime-check-*.ts` dosyasının konumu,
  proje konvansiyonuna (repo kökü) uymazsa relative import yolları
  sessizce kırılır — dosya oluşturulmadan önce mevcut konum teyit edilmeli.
- **(Madde #25 turu)** Bir `catch` bloğunun hatayı loglaması, process'in
  doğru exit code ile çıktığı anlamına gelmez — `process.exitCode` açıkça
  ayarlanmadıkça Node varsayılan olarak `0` ile çıkabilir.
- **(Yeni — Madde #27 turu)** Bir dosyanın "repo köküne verildi/kondu"
  şeklindeki bir bildirim, gerçek `ls`/`find` çıktısıyla teyit edilmeden bir
  sonraki adımda "mevcut" sayılmamalı — sohbet içinde anlatılan bir dosya,
  diske hiç yazılmamış olabilir (AGENT.md Kural #10'un fiilen ihlali, aynı
  zamanda "eylem gerçek çıktı olmadan doğrulanmış sayılmaz" dersinin bir
  örneği daha).
- **(Yeni — Madde #27 turu)** `Object.freeze()`'in bir property'ye atamayı
  ENGELLEMESİ (değerin değişmemesi) ile bu atamanın THROW etmesi farklı
  garantilerdir — ikincisi sadece strict mode'da geçerlidir ve strict/sloppy
  ayrımı projenin gerçek modül sistemine (`package.json` `"type"`, tsconfig
  `"module"`) bağlıdır; bir test'in "throw etmeli" varsayımı, projenin
  fiilen CJS'e mi ESM'e mi derlendiği teyit edilmeden yazılmamalı — asıl
  doğrulanması gereken sözleşme genelde "değer değişmedi"dir, "throw etti"
  değil.
