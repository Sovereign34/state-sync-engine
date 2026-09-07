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
    betiğiyle 7/7 test PASS; `npx tsc --noEmit` → 0 hata.
  - **(Yeni) Madde #22 — `recordSuccess` köprüsü: KAPANDI (Session 3,
    runtime doğrulamalı).** `npx tsx runtime-check.ts` gerçek komut çıktısı
    paylaşıldı (ekran görüntüsü) — TEST 4a PASS (geçerli `latencyMs`=123 ile
    `recordSuccess(proxy-5, 123)` doğru çağrıldı), TEST 4b PASS (negatif
    `latencyMs`=-5 ile `recordSuccess` çağrılMADI, guard doğru çalışıyor).
    Önceki turların TEST 1-3'ü de aynı çalıştırmada PASS. **Sınır aynen
    geçerli:** `!this.currentLease` dalı bu script'te kasıtlı kapsam dışı,
    hâlâ sadece kod okumasıyla biliniyor, runtime'da ayrıca doğrulanmadı.
  - **(Yeni) Madde #22 — "diğer `GovernorAction` türleri için instrumentation
    bağlantısı kapsanmadı" iddiası YANLIŞTI, kayıt düzeltildi.**
    `PersistentStateEngine.ts` (`handleGovernorDecision`) gerçek kod
    okunarak doğrulandı: THROTTLE, QUARANTINE_PROXY, ROTATE_SESSION_ONLY,
    FULL_RECOVERY case'lerinin HEPSİ zaten `markFailed`'e bağlıydı
    (`if (this.currentLease) { ... }` deseniyle) — bu turdan önce de
    kodda mevcuttu. `NO_ACTION` kasıtlı olarak bağlı değil. Bu, daha önce
    `recordSuccess` için yaşanan "dosya başlığındaki eski not güncel
    gerçeği yansıtmıyordu" kalıbının bir tekrarı (bkz. ⚠️ DERSLER).
  - **(Yeni) Madde #22 — kod okuması sırasında YENİ bir bulgu: `FULL_RECOVERY`
    case'i anomaly tipine bakmadan HER durumda `markFailed(proxyId,
    'NETWORK_FAIL')` çağırıyordu.** `FULL_RECOVERY`, üç farklı anomaly
    tipinden tetiklenebiliyor (`PAGE_CRASH`, `NETWORK_FAILURE`,
    `AUTH_VALIDATION_FAILED`) — son ikisi proxy'yle ilgisiz olabilir,
    özellikle `AUTH_VALIDATION_FAILED` tamamen session-state sorunu, proxy
    sağlıklı olabilir. Bu, `ROTATE_SESSION_ONLY` case'inde zaten uygulanmış
    disiplinin (HTTP_429 vs CHALLENGE_DETECTED type-guard'ı) `FULL_RECOVERY`'ye
    uygulanmamış hâli — sağlıklı proxy'ler gereksiz yere 45sn karantinaya
    giriyordu (yanlış telemetri, Madde 22 disiplini ihlali).
    **[KARAR BİLDİRİMİ] kullanıcı onaylandı ve UYGULANDI:** `FULL_RECOVERY`
    case'i artık `event.anomaly.type !== AnomalyType.AUTH_VALIDATION_FAILED`
    koşuluyla sınırlı — `AUTH_VALIDATION_FAILED` artık `markFailed`'den
    hariç tutuluyor. **Durum: KAPANDI (Session 3).** `npx tsc --noEmit` →
    temiz, 0 hata (ekran görüntüsü). Ardından `runtime-check.ts`'e TEST 5
    eklendi (5a: `NETWORK_FAILURE` → `markFailed('NETWORK_FAIL')` HÂLÂ
    çağrılıyor — guard fazla geniş değil; 5b: `AUTH_VALIDATION_FAILED` →
    `markFailed` HİÇ ÇAĞRILMIYOR — asıl bulgunun regresyon testi),
    `npx tsx runtime-check.ts` ile ÇALIŞTIRILDI, 5a/5b ikisi de PASS
    (ekran görüntüsü, gerçek komut çıktısı görüldü).
  - **(Yeni) Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3).**
    THROTTLE, ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY → hepsi
    doğru tip-guard'larla `markFailed`'e bağlı; başarı yolu `recordSuccess`'e
    guard'lı bağlı. Tamamı `runtime-check.ts` (TEST 1-5, hepsi PASS) ve
    `npx tsc --noEmit` (0 hata) ile runtime + derleme seviyesinde doğrulandı.
    Madde P0 tablosundan kaldırıldı, ayrıntı Kapanan Maddeler Geçmişi'nde.
  - **(Yeni) `PersistentStateEngine.ts` debug-temiz sürüm: kullanıcı
    tarafından repo'ya uygulandığı TEYİT EDİLDİ** (debug `console.log`
    temizliği onaylanmış, kod son haline getirilmiş). Not: bu teyit sözlü
    beyan seviyesinde — dosyanın kendisi bu session'a yüklenmiş VE gerçek
    içeriği görülmüştür (yukarıdaki `FULL_RECOVERY` bulgusu bu dosyanın
    güncel hâlinden çıkarıldı) — teyit artık dosya içeriğiyle de tutarlı.
  - Madde #13: Session 2'den değişmedi.
- **Sıradaki öncelik:** Madde #22 kapandığı için P0'da sırada: (a) #13
  credential/state encryption-at-rest — secret kaynağı (env var + AES-256-GCM)
  ve persistence backend'i (SQLite) kullanıcıyla KARARLAŞTIRILDI (bkz. 📌
  Kritik Teknik Kararlar), ancak kod üretimi için `ProxyCredential` tip
  tanımı ve `AdvancedProxyManager.ts` HÂLÂ BEKLENİYOR (Kural #2, eksik
  veriyle çözüm üretilmez); (b) #9'un ertelenmiş gerçek entegrasyon testi
  (ne zaman ele alınacağı kullanıcıdan tekrar sorulacak). Ayrıca hâlâ açık:
  #9 vs #17 etiket tutarsızlığı sorusu (bkz. ❓ Cevap Bekleyen Sorular).

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

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 9 | State restore validation (cookie≠authenticated) | state | açık — re-entrancy alt-bug'ı (guard'ın senkron zincirle atlanması) `queueMicrotask` fix'i ile giderildi ve mock runtime testinde tam doğrulandı (ikinci gizli hata yok, grep ile teyit edildi); **gerçek entegrasyon testi (mock'suz Playwright/proxy/DefaultAuthValidator) kullanıcı kararıyla projenin sonuna ertelendi** — madde bu nedenle açık kalıyor, şu an aktif çalışılmıyor |
| 13 | Credential/state encryption-at-rest | state/security | açık |
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
  log/telemetriye sızar).
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
  `markFailed`'den hariç tutuyor (bkz. ⚡ ANLIK DURUM) — bu, proxy sağlığı
  ile session/auth-state sağlığının ayrı katmanlar olduğu ilkesinin
  `ROTATE_SESSION_ONLY`'den sonra ikinci uygulanışı; gelecekte benzer bir
  action/anomaly kombinasyonu eklenirse aynı ayrım (anomaly.type'a göre
  proxy'yi suçlamadan önce "bu gerçekten proxy'nin suçu mu" sorusu)
  tekrar sorulmalı.
- **(Yeni) Madde #2 — Persistent proxy store backend KARARLAŞTIRILDI: SQLite**
  (`better-sqlite3`). Gerekçe: tek-node motor, ekstra servis/network bağımlılığı
  istenmiyor; Redis (ek servis) ve Neon/Postgres (network round-trip, serverless
  cold-start riski — özellikle `FULL_RECOVERY` anında ekstra gecikme riski) kullanıcı
  onayıyla elendi.
- **(Yeni) Madde #13 — Secret yönetimi kaynağı KARARLAŞTIRILDI: env var
  (`STATE_SYNC_ENCRYPTION_KEY`) + AES-256-GCM envelope encryption, bir
  `SecretProvider` interface'i arkasında** (ileride Vault/KMS'e geçiş için
  dependency-inversion, Madde 33 disiplinine uyumlu). Vault/KMS, operasyonel
  karmaşıklık gerekçesiyle kullanıcı onayıyla elendi.
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

- **Madde #22 — alt-kapsam genişletmesi (THROTTLE + ROTATE_SESSION_ONLY→
  `markFailed` köprüsü, tip-guard dahil) KAPANDI (Session 3, runtime +
  derleme doğrulaması; madde'nin kendisi P0 tablosunda AÇIK kalıyor):**
  `THROTTLE` aksiyonu için `markFailed` köprüsü önceki turda kapatılmıştı;
  bu turda `ROTATE_SESSION_ONLY` aksiyonu için aynı köprü + iki aksiyon
  arasında doğru ayrımı yapan bir tip-guard eklendi (`CHALLENGE_DETECTED`
  gibi diğer aksiyonlarda `markFailed` YANLIŞLIKLA tetiklenmemeli). Doğrulama
  — `runtime-check` betiğiyle **7/7 PASS, 0 FAIL**, `npx tsc --noEmit` →
  temiz, **0 hata**.
- **(Yeni) Madde #22 — `recordSuccess()` köprüsü KAPANDI (Session 3, runtime
  doğrulamalı):** `PlaywrightPageObserver`'ın genuinely başarılı (2xx)
  response'larda emit ettiği `'state'` event'i, `handleObserverState()` ile
  dinlenip `proxyManager.recordSuccess()`'e bağlanıyor; `latencyMs`
  sayısal değilse veya negatifse kayıt yapılmıyor (guard). `runtime-check.ts`'e
  eklenen TEST 4, `npx tsx runtime-check.ts` ile ÇALIŞTIRILDI ve PASS etti
  (4a: geçerli latency ile çağrıldı, 4b: negatif latency ile guard
  ÇAĞIRMADI) — gerçek komut çıktısı görüldü, "niyet beyanı" aşaması bitti.
  **Sınır:** `!this.currentLease` dalı bu script'te kasıtlı kapsam dışı,
  hâlâ sadece kod okumasıyla biliniyor.
- **(Yeni) Madde #22 — "diğer `GovernorAction` türleri kapsanmadı" kaydı
  DÜZELTİLDİ:** Önceki turlarda P0 tablosuna ve bu bölüme yazılan
  "THROTTLE/ROTATE_SESSION_ONLY dışındaki türler bağlı değil" iddiası,
  `PersistentStateEngine.ts`'in tam içeriği görülünce yanlış çıktı —
  QUARANTINE_PROXY ve FULL_RECOVERY zaten `markFailed`'e bağlıydı (muhtemelen
  daha önceki, ayrıntısı bu SESSION_INDEX'e hiç yazılmamış bir turda
  eklenmişti). Ders için bkz. ⚠️ DERSLER.
- **(Yeni) Madde #22 — TAM KAPANDI (Session 3), P0 tablosundan kaldırıldı:**
  Son açık alt-kapsam olan `FULL_RECOVERY`/`AUTH_VALIDATION_FAILED`
  tip-guard'ı doğrulandı. Bulgu: `FULL_RECOVERY` case'i anomaly tipine
  bakmadan HER durumda `markFailed('NETWORK_FAIL')` çağırıyordu; ancak
  `FULL_RECOVERY` üç farklı anomaly tipinden tetiklenebiliyor (`PAGE_CRASH`,
  `NETWORK_FAILURE`, `AUTH_VALIDATION_FAILED`) ve sonuncusu proxy'yle
  ilgisiz (tamamen session/auth-state sorunu) — sağlıklı proxy'ler
  gereksiz yere karantinaya giriyordu. Düzeltme: case artık
  `event.anomaly.type !== AnomalyType.AUTH_VALIDATION_FAILED` koşuluyla
  sınırlı. Doğrulama: `npx tsc --noEmit` → 0 hata; `runtime-check.ts`'e
  eklenen TEST 5, `npx tsx runtime-check.ts` ile ÇALIŞTIRILDI — 5a PASS
  (`NETWORK_FAILURE` hâlâ `markFailed` tetikliyor, guard fazla geniş
  değil), 5b PASS (`AUTH_VALIDATION_FAILED` artık `markFailed`
  tetiklemiyor, asıl bulgunun regresyonu). `PAGE_CRASH` yolu (ham
  `page.on('crash')`) bu testte kasıtlı kapsam dışı bırakıldı — Madde #33
  kapsamında ayrıca ele alınacak. Sonuç: Madde #22'nin TÜM alt-kapsamları
  (THROTTLE, ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY →
  `markFailed`; başarı yolu → `recordSuccess`) runtime + derleme
  seviyesinde doğrulandı, madde P0 tablosundan kaldırıldı.

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
  için de geçerli — **(Yeni)** bu turda üçüncü kez doğrulandı: SESSION_INDEX
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
- **(Yeni — Session 3)** Bir action'ın (örn. `FULL_RECOVERY`) birden fazla
  farklı anomaly tipinden tetiklenebilmesi, o action'ın downstream etkisinin
  (örn. `markFailed`) TÜM tetikleyici anomaly tiplerine aynı şekilde
  uygulanması gerektiği anlamına gelmez — `ROTATE_SESSION_ONLY`'de bu ayrım
  yapılmıştı ama `FULL_RECOVERY`'de yapılmamıştı, kod okunana kadar fark
  edilmedi. Ders: bir action'ı tetikleyen anomaly tiplerinin listesi
  değiştiğinde veya yeni bir action/anomaly eşlemesi eklendiğinde, mevcut
  benzer case'lerdeki guard'ların yeni eşlemeye de uygulanıp uygulanmadığı
  AYRICA kontrol edilmeli — "bir case'de yapıldı" diğerinde de yapıldığı
  anlamına gelmez.

---

*Not (Session 3, bu tur): `FULL_RECOVERY`/`AUTH_VALIDATION_FAILED`
tip-guard'ı TEST 5a/5b ile runtime doğrulandı (`npx tsx runtime-check.ts`,
ikisi de PASS) ve `npx tsc --noEmit` temiz — bu, Madde #22'nin son açık
alt-kapsamıydı. **Madde #22 bu turda TAM KAPANDI ve P0 tablosundan
kaldırıldı.** Açık P0 maddeleri artık: #9, #13, #33 (3 madde, önceki
turda 4'tü). P1/P2 sayı/kapsam olarak değişmedi.*
