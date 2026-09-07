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
  - **Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3).** Tam
    ayrıntı `session_arşiv.md`'de (Taşıma 4) — özet: THROTTLE,
    ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY → hepsi doğru
    tip-guard'larla `markFailed`'e bağlı; başarı yolu `recordSuccess`'e
    guard'lı bağlı. `runtime-check.ts` (TEST 1-5, hepsi PASS) ve
    `npx tsc --noEmit` (0 hata) ile runtime + derleme seviyesinde
    doğrulandı. Madde P0 tablosundan kaldırıldı.
  - **(Yeni) `PersistentStateEngine.ts` debug-temiz sürüm: kullanıcı
    tarafından repo'ya uygulandığı TEYİT EDİLDİ** (debug `console.log`
    temizliği onaylanmış, kod son haline getirilmiş). Not: bu teyit sözlü
    beyan seviyesinde — dosyanın kendisi bu session'a yüklenmiş VE gerçek
    içeriği görülmüştür (Madde #22'nin `FULL_RECOVERY` bulgusu bu dosyanın
    güncel hâlinden çıkarıldı) — teyit artık dosya içeriğiyle de tutarlı.
  - **(Yeni) Madde #13 — Credential/state encryption-at-rest: TAM KAPANDI
    (Session 3).** Tam ayrıntı Kapanan Maddeler Geçmişi'nde — özet:
    `SecretProvider` + `ProxyCredentialStore` entegrasyonu tamamlandı,
    `runtime-check-persistence.ts` 4/4 PASS, `npx tsc --noEmit; echo
    "EXIT CODE: $?"` ile **EXIT CODE: 0** ekran görüntüsüyle teyit edildi.
    Madde P0 tablosundan kaldırıldı. **Kapsam dışı bırakılan açık takip
    (madde'nin kendisi değil, ayrı görev):** composition-root wiring
    (`credentialStore`'u kimin oluşturup enjekte edeceği) ve `package.json`'a
    `better-sqlite3`/`@types/better-sqlite3` eklenmesi hâlâ görülmedi —
    bkz. Sıradaki Öncelik.
- **Sıradaki öncelik:** Madde #13 ve #22 kapandığı için P0'da sırada:
  (a) **#9**'un ertelenmiş gerçek entegrasyon testi (ne zaman ele
  alınacağı kullanıcıdan tekrar sorulacak); (b) **#33**'ün `crash`/
  `requestfailed` ham `page.on(...)` kısmı. Ayrıca P0 dışı ama Madde #13'ün
  fiilen production'da aktif olması için gereken iki açık takip: (c)
  composition-root dosyasında (muhtemelen `src/index.ts` veya bir
  `EngineFactory`) `credentialStore`'un oluşturulup enjekte edilmesi —
  görülmedi, ayrı [KARAR BİLDİRİMİ] gerektirir; (d) `package.json`'a
  `better-sqlite3` + `@types/better-sqlite3` eklenmesi kullanıcı tarafında
  yapılmalı. Ayrıca hâlâ açık: #9 vs #17 etiket tutarsızlığı sorusu (bkz.
  ❓ Cevap Bekleyen Sorular).

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
  uygulandı mı?~~ — **kullanıcı teyit etti: evet, uygulandı** — bu turda
  dosyanın kendisi de görülüp içerik teyidiyle tutarlı bulundu.
- ~~Madde #13 — `npx tsc --noEmit` gerçekten 0 hata mı döndü?~~ —
  **çözüldü**: `npx tsc --noEmit; echo "EXIT CODE: $?"` çalıştırıldı,
  ekran görüntüsünde **EXIT CODE: 0** görüldü. Madde #13 bu teyitle kapandı.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 9 | State restore validation (cookie≠authenticated) | state | açık — re-entrancy alt-bug'ı (guard'ın senkron zincirle atlanması) `queueMicrotask` fix'i ile giderildi ve mock runtime testinde tam doğrulandı (ikinci gizli hata yok, grep ile teyit edildi); **gerçek entegrasyon testi (mock'suz Playwright/proxy/DefaultAuthValidator) kullanıcı kararıyla projenin sonuna ertelendi** — madde bu nedenle açık kalıyor, şu an aktif çalışılmıyor |
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
  **(Yeni not — henüz görülmedi)** `AdvancedProxyManager.ts`, `'../types'`'tan
  `ProxyMetrics`/`ProxyLease` import ediyor, ancak yüklenen `index.ts` bu
  ikisini re-export etmiyor (sadece `governor-command.types` ve
  `auth-validation.types`). Madde #13 turunda bu tipe yeni alan eklenmediği
  için bloklayıcı değildi, ama tip dosyasının kendisi hâlâ "görülmedi"
  sayılıyor — ileride bu tipler değişirse önce görülmesi gerekecek.
- `GovernorDecisionEvent` ve `RecoveryCommandPort`, `AdaptiveGovernor.ts`'ten
  de re-export ediliyor.
- Madde #6'da listener hatası `Promise.allSettled` ile izole edilmişti;
  Madde #7 ile birlikte legacy `.on('decision', ...)` yolu **kaldırıldı**,
  tek yol `RecoveryCommandPort` (`setCommandPort` ile enjekte edilen
  `PersistentStateEngine`) oldu. `Promise.allSettled`'ın artık tek bir port
  beklerken hâlâ anlamlı olup olmadığı — runtime doğrulaması sırasında
  gözden geçirilmeli.
- `PersistentStateEngine.handleGovernorDecision`'ın catch bloğundaki
  `enqueueAnomaly(...)` çağrısı `queueMicrotask(() => ...)` ile ertelendi —
  senkron re-entrancy zincirinin `isRecovering` guard'ını atlamasını
  önlemek için (Madde #9 kapsamı). Runtime'da doğrulandı; debug-log
  temizlenmiş sürümün repo'ya uygulandığı hem kullanıcı teyidi hem dosya
  içeriğiyle doğrulandı.
- Madde #9'un gerçek entegrasyon testi (mock'suz Playwright + gerçek/local
  auth server ile cookie-restore-ama-authenticate-olmadı senaryosu)
  **projenin sonuna ertelendi**. **Açık varsayım:** "proje sonu" net bir
  tarih/tetikleyici değil — ileride "artık test edelim mi" diye tekrar
  sorulacak.
- `getAllMetrics()` (dışa açık/toplu görünüm) ve `getProxyMetrics()` (iç
  kullanım, gerçek proxy bağlantısı için credential'lı) **kasıtlı olarak
  farklı davranıyor**. Madde #22 (telemetry bağlantısı) SADECE
  `getAllMetrics()`'e bağlanmalı, `getProxyMetrics()`'e ASLA (credential
  log/telemetriye sızar). **Madde #13 kapsamında da bu ayrım korundu** —
  `SecretProvider`/`ProxyCredentialStore` credential'ları yalnızca kendi
  katmanında tutuyor, `AdvancedProxyManager` şifreleme detayını bilmiyor.
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
- **(Yeni)** `PersistentStateEngine.handleGovernorDecision`'daki
  `FULL_RECOVERY` case'i artık `AUTH_VALIDATION_FAILED` anomaly'sini
  `markFailed`'den hariç tutuyor (bkz. `session_arşiv.md` Taşıma 4) — bu,
  proxy sağlığı ile session/auth-state sağlığının ayrı katmanlar olduğu
  ilkesinin `ROTATE_SESSION_ONLY`'den sonra ikinci uygulanışı; gelecekte
  benzer bir action/anomaly kombinasyonu eklenirse aynı ayrım (anomaly.type'a
  göre proxy'yi suçlamadan önce "bu gerçekten proxy'nin suçu mu" sorusu)
  tekrar sorulmalı.
- **(Yeni) Madde #2 — Persistent proxy store backend KARARLAŞTIRILDI: SQLite**
  (`better-sqlite3`). Gerekçe: tek-node motor, ekstra servis/network bağımlılığı
  istenmiyor; Redis (ek servis) ve Neon/Postgres (network round-trip, serverless
  cold-start riski — özellikle `FULL_RECOVERY` anında ekstra gecikme riski) kullanıcı
  onayıyla elendi.
- **Madde #13 — Secret yönetimi kaynağı KARARLAŞTIRILDI ve UYGULANDI: env var
  (`STATE_SYNC_ENCRYPTION_KEY`) + AES-256-GCM envelope encryption, bir
  `SecretProvider` interface'i arkasında** (ileride Vault/KMS'e geçiş için
  dependency-inversion, Madde 33 disiplinine uyumlu). Vault/KMS, operasyonel
  karmaşıklık gerekçesiyle kullanıcı onayıyla elendi. **Madde TAM KAPANDI**
  (bkz. Kapanan Maddeler Geçmişi) — production'da fiilen aktif olması için
  composition-root wiring'i hâlâ ayrı bir açık takip (bkz. Sıradaki Öncelik).
- **(Yeni) Deploy hedefi (süreç kararı, madde dışı) KARARLAŞTIRILDI (aday):
  Fly.io** — persistent volume (SQLite dosyası için) + resmi Playwright Docker
  image. Gerekçe: Playwright ağır CPU/RAM + uzun-yaşayan process gerektiriyor,
  serverless/edge (Vercel, Cloudflare Workers, Lambda) bu nedenle elendi;
  Hetzner (çıplak VPS) alternatifi, Fly.io'nun sunucu yönetimini (patch,
  restart-on-crash, secrets) üstlenmesi lehine ertelendi. Kesinleşmiş değil,
  "aday" — deploy aşamasında tekrar teyit edilecek.

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

- **Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3), P0
  tablosundan kaldırıldı.** Tam ayrıntı `session_arşiv.md`'de (Taşıma 4) —
  özet: THROTTLE, ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY →
  hepsi doğru tip-guard'larla `markFailed`'e bağlı; başarı yolu
  `recordSuccess`'e guard'lı bağlı. `runtime-check.ts` (TEST 1-5, hepsi
  PASS) ve `npx tsc --noEmit` (0 hata) ile runtime + derleme seviyesinde
  doğrulandı. Son kapanan alt-bulgu: `FULL_RECOVERY` case'i anomaly tipine
  bakmadan HER durumda `markFailed` çağırıyordu; `AUTH_VALIDATION_FAILED`
  (session/auth-state sorunu, proxy'yle ilgisiz) artık hariç tutuluyor —
  düzeltme TEST 5a/5b ile regresyona karşı da doğrulandı.
- **(Yeni) Madde #13 — Credential/state encryption-at-rest TAM KAPANDI
  (Session 3), P0 tablosundan kaldırıldı:** `SecretProvider`
  (`src/security/`, env var `STATE_SYNC_ENCRYPTION_KEY` + AES-256-GCM
  envelope encryption) ve `ProxyCredentialStore` (`src/state/`, SQLite /
  `better-sqlite3`) eklendi; `AdvancedProxyManager` constructor'ı geriye
  dönük uyumlu opsiyonel 3. parametre (`credentialStore?`) ile
  genişletildi. Entegrasyon: constructor'da önce `credentialStore.loadAll()`
  ile DB'deki kayıtlar sessizce (DB'ye tekrar yazmadan) map'e yüklenir;
  `initialProxies` SONRA işlenir — `registerProxy()`'nin var olan "zaten
  kayıtlıysa dokunma" kuralı sayesinde DB'deki kayıt config'teki ile
  çakışırsa DB kazanır, `initialProxies` sadece DB'de olmayanları ekler ve
  bunlar için tek seferlik DB yazması tetiklenir. **Doğrulama:**
  `runtime-check-persistence.ts` ile **4/4 PASS** — (1) env var yokken
  constructor throw etti (fail-fast), (2) `registerProxy()` iki kez aynı
  server ile çağrılınca DB'de tek satır kaldı, (3) yanlış key ile
  `loadAll()` fail-closed oldu, (4) DB'den yüklenen credential doğru
  kazanıldı (`persisted-user`) — gerçek komut çıktısı ekran görüntüsüyle
  görüldü. Derleme: `npx tsc --noEmit; echo "EXIT CODE: $?"` çalıştırıldı,
  ekran görüntüsünde **EXIT CODE: 0** görüldü — "hata satırı yok" ile
  "gerçekten 0 döndü" arasındaki fark bu şekilde kapatıldı. **Güvenlik
  notu:** Doğrulama sürecinde üretilen bir `STATE_SYNC_ENCRYPTION_KEY`
  örneği bir ekran görüntüsünde açığa çıkmıştı, kullanıcıya bu örnek key'i
  production'a almadan rotate etmesi önerildi (test script kendi geçici
  key'lerini ürettiği için testin geçerliliğini etkilemiyor). **Kapsam
  dışı bırakılan açık takip (madde'nin kendisi kapandı, ama bu ikisi
  ayrı görev olarak devam ediyor):** (a) `package.json`'a
  `better-sqlite3` + `@types/better-sqlite3` eklenmesi kullanıcı tarafında
  yapılmalı, görülmedi; (b) gerçek composition-root dosyası (muhtemelen
  `src/index.ts` veya bir `EngineFactory`) — `credentialStore`'u kimin
  oluşturup enjekte edeceği (env var okuma, DB path) hâlâ görülmedi, ayrı
  bir [KARAR BİLDİRİMİ] gerektirir.

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
  güncel gerçeği yansıtmayabilir, **her iki yönde de** (genişletme VEYA
  daraltma) gerçek koda bakılmalı. Bu ders SESSION_INDEX'in kendi kayıtları
  için de geçerli — bu turda üçüncü kez doğrulandı: SESSION_INDEX
  "diğer `GovernorAction` türleri bağlı değil" diye kaydetmişti, gerçek kod
  görülünce bu da yanlış çıktı (QUARANTINE_PROXY/FULL_RECOVERY zaten
  bağlıydı). SESSION_INDEX'in kendisi de bir "eski not" kaynağı olabilir —
  önceki turun kaydı, yeni tur için otomatik doğru kabul edilmemeli.
- Bir hata durumunu başka bir hata durumuyla aynı dönüş değerine
  sıkıştırmak, ikisini birbirinden ayırt edilemez hale getirir — bir testin
  "geçti" demesi yetmez, NEDEN geçtiği de doğrulanmalı.
- Verilen dosya adı, hedef repo yoluyla nokta/alt çizgi dahil BİREBİR
  eşleşmeli, ya da hedef yol açıkça belirtilmeli.
- "Madde X kapandı" etiketi, benzer riskli dosyaların TAMAMININ tarandığı
  anlamına gelmez — ilgili tüm dosyalar (interface/sözleşme dahil) ayrıca
  kontrol edilmeli.
- Test/derleme aracı sürüm uyumsuzluğu, çalıştırma zamanında KOD kaynaklıymış
  gibi görünen bir hataya yol açabilir — bir betik çalıştırma hatası
  alındığında önce "hangi araç, hangi sürüm" kontrol edilmeli.
- "Derleniyor" (`tsc --noEmit` temiz) ile "runtime'da fiilen çağrılıyor"
  arasındaki fark tekrar eden bir kalıp — aynı maddenin farklı alt-kapsamları
  farklı doğrulama seviyelerinde olabilir, genellemeler yasak.
- Bir action'ın (örn. `FULL_RECOVERY`) birden fazla farklı anomaly tipinden
  tetiklenebilmesi, o action'ın downstream etkisinin (örn. `markFailed`)
  TÜM tetikleyici anomaly tiplerine aynı şekilde uygulanması gerektiği
  anlamına gelmez — `ROTATE_SESSION_ONLY`'de bu ayrım yapılmıştı ama
  `FULL_RECOVERY`'de yapılmamıştı, kod okunana kadar fark edilmedi. Ders:
  bir action'ı tetikleyen anomaly tiplerinin listesi değiştiğinde veya yeni
  bir action/anomaly eşlemesi eklendiğinde, mevcut benzer case'lerdeki
  guard'ların yeni eşlemeye de uygulanıp uygulanmadığı AYRICA kontrol
  edilmeli — "bir case'de yapıldı" diğerinde de yapıldığı anlamına gelmez.
- **(Madde #13 turu)** "Terminalde hata satırı görünmüyor" ile "komut
  gerçekten 0 (başarı) döndü" farklı doğrulama seviyeleridir — `tsc`
  başarılıysa sessiz çıkar, ama ekran kaydırılmış/kesilmiş olabilir; net
  `echo $?` (veya eşdeğeri) görülmeden derleme adımı "temiz" olarak
  kapatılmamalı. **Bu turda fiilen uygulandı:** `echo "EXIT CODE: $?"`
  istendi, `EXIT CODE: 0` görülünce madde kapatıldı.
- **(Madde #13 turu)** Bir doğrulama ekran görüntüsünde, üretilen gerçek
  bir secret/key değeri (örn. `openssl rand` çıktısı) açıkta görünüyorsa,
  bu değerin artık sohbet geçmişinde ifşa olduğu kabul edilip production'a
  alınmadan rotate edilmesi önerilmeli — script'in kendi test-amaçlı
  geçici key'leri kullanması bu öneriyi geçersiz kılmaz.
- **(Yeni — Madde #13 turu)** Bir madde ("kod uygulandı + runtime testleri
  geçti") kapansa bile, o kodun **production'da fiilen kullanılması**
  (composition-root wiring, bağımlılık kurulumu) ayrı ve hâlâ açık bir
  takip maddesi olabilir — "madde kapandı" ile "özellik production'da
  aktif" birbirine karıştırılmamalı, ikisi ayrı satırlarda takip edilmeli.

---

*Not (Session 3, önceki tur): `FULL_RECOVERY`/`AUTH_VALIDATION_FAILED`
tip-guard'ı TEST 5a/5b ile runtime doğrulandı (`npx tsx runtime-check.ts`,
ikisi de PASS) ve `npx tsc --noEmit` temiz — bu, Madde #22'nin son açık
alt-kapsamıydı. **Madde #22 bu turda TAM KAPANDI ve P0 tablosundan
kaldırıldı.***

*Not (Session 3, bu tur): `SecretProvider` + `ProxyCredentialStore` ile
Madde #13'ün derleme adımı `npx tsc --noEmit; echo "EXIT CODE: $?"` →
**EXIT CODE: 0** ile teyit edildi (ekran görüntüsü). **Madde #13 bu turda
TAM KAPANDI ve P0 tablosundan kaldırıldı.** Açık P0 maddeleri artık: **#9,
#33** (2 madde, önceki turda 3'tü). Composition-root wiring ve
`better-sqlite3` bağımlılığı, madde #13'ün kendisi kapanmış olsa da ayrı
açık takip olarak Sıradaki Öncelik'te kayıtlı. P1/P2 sayı/kapsam olarak
değişmedi.*
