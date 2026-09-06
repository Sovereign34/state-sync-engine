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
  - **Madde #6, #7, #8: KAPANDI.** `runtime-check.ts` (mock `Browser` +
    mock `AdvancedProxyManager` ile Governor↔Engine mantığını izole eden
    doğrulama betiği) `npx tsx runtime-check.ts` ile çalıştırıldı, ekran
    görüntüsüyle teyit edildi:
    - Test 1 (iki farklı anomaly art arda enqueue): `acquireProxy()` tam 2
      kez çağrıldı — ikinci decision kaybolmadı (#6), legacy
      `.on('decision',...)` hâlâ genel EventEmitter olarak tetikleniyor
      ama `PersistentStateEngine` artık ondan değil `RecoveryCommandPort`
      üzerinden işliyor (#7).
    - Test 2 (kasıtlı `newContext()` hatası): eski context DEĞİŞMEDİ
      (rollback çalıştı), başarısız denemenin lease'i release edildi —
      sızıntı yok (#8).
    - Sonuç satırı: "✅ Tüm testler geçti" (`failures === 0` olmadan bu
      satır basılmaz).
    - **Kapsam sınırı:** bu doğrulama gerçek Playwright/proxy altyapısını
      test ETMEDİ — Governor/Engine arası sıralama ve komut-yönlendirme
      mantığını mock'larla izole doğruladı. Gerçek network/browser
      entegrasyonunun sağlıklı çalıştığı ayrı bir doğrulama konusu.
  - **Madde #9 — alt-bug kısmı KAPANDI (mock), gerçek entegrasyon ERTELENDİ:**
    - Madde #9 üzerinde test tasarımı yapılırken ayrı bir re-entrancy
      bug'ı ortaya çıktı: `PersistentStateEngine.handleGovernorDecision`'ın
      catch bloğundaki senkron `this.governor.enqueueAnomaly(...)` çağrısı,
      `isRecovering` guard'ını sessizce yutuyordu — senkron zincir
      (`enqueueAnomaly → processQueue → emitDecisionAndWait →
      commandPort.handleDecision → handleGovernorDecision`) hiçbir
      await'e uğramadan aynı çağrı yığınında ilerliyordu. Ayrı bir madde
      açılmadı, #9'un kapsamına dahil edildi.
    - **[KARAR BİLDİRİMİ] ile onaylanan fix (Confidence: HIGH):** senkron
      `enqueueAnomaly` çağrısı `queueMicrotask(() => ...)` ile bir sonraki
      tick'e ertelendi (`setTimeout(...,0)` değil — mikrotask sırası event
      loop'a çıkmadan çalıştığı için Node ortamında daha öngörülebilir).
    - Fix, `runtime-check-madde9.ts` (Senaryo A: `validate=false` —
      rollback + guard'ın gerçekten aşıldığını + re-entrancy olmadığını
      doğrular; Senaryo B: `validate=true` — normal COMMIT akışının
      bozulmadığını doğrular) ile test edildi. Betik kullanıcının gerçek
      ortamında (gerçek `AdvancedProxyManager`/playwright ile) çalıştırıldı,
      debug satırlı referans çıktı paylaşıldı:
      ```
      [DEBUG] handleGovernorDecision çağrıldı — action=ROTATE_SESSION_ONLY, isRecovering=false
      [DEBUG] handleGovernorDecision çağrıldı — action=FULL_RECOVERY, isRecovering=false
      [DEBUG] handleGovernorDecision çağrıldı — action=ROTATE_SESSION_ONLY, isRecovering=false
      ```
      → **Sonuç: re-entrancy fix çalışıyor, guard sorunu YOK.**
    - **İkinci kritik hata ihtimali elendi:** `grep -n "kritik hata"
      /tmp/out.log` tüm log dosyasında tek bir eşleşme döndürdü (12. satır
      — Senaryo A'nın kasıtlı enjekte ettiği `AuthRestoreFailedError`,
      testin beklenen parçası). Gizli/ikinci bir hata YOK. Log'un geri
      kalanı (rollback, lease release, Senaryo B COMMIT, queue boş) tümü
      ✓/✅ ile bitiyor — **"Tüm testler geçti"** onaylandı.
    - **Kapsam ve karar (Session 3, kullanıcı onaylı):** guard/re-entrancy
      alt-bug'ı mock seviyesinde tam doğrulandı ve bu alt-kapsam KAPANDI
      (bkz. Kapanan Maddeler Geçmişi). Ancak bu doğrulama gerçek
      Playwright/proxy/`DefaultAuthValidator` ile değil, mock
      `AuthValidationPort`/`Browser`/`AdvancedProxyManager` ile yapıldı —
      Madde #9'un asıl konusu olan **gerçek ortam entegrasyon testi**
      (gerçek context'te cookie restore edilip gerçek auth doğrulamasının
      başarısız olduğu senaryo) henüz yapılmadı. Kullanıcı kararıyla bu
      **projenin sonuna ertelendi** — #9 bu nedenle P0 tablosunda AÇIK
      kalmaya devam ediyor, aktif çalışılmıyor.
  - **Madde #23: KAPANDI (Session 3, tsc + runtime doğrulaması).** Ayrıntı
    için Kapanan Maddeler Geçmişi. Bu süreçte bir regresyon (`getProxyMetrics()`
    yanlışlıkla credential'sız tipe çevrilmiş, gerçek proxy authentication'ı
    kırmıştı) ortaya çıktı ve aynı turda düzeltildi — ders: Madde #23'ün
    kapsamını genişletirken (`getAllMetrics()`'ten `getProxyMetrics()`'e)
    gerçek tüketici kodu görülmeden onay istenmemeliydi.
  - Madde #13, #22, #33: Session 2'den değişmedi.
  - **Süreç dışı, numarasız `authValidator` wiring bug'ı — TAM KAPANDI
    (Session 3, derleme + runtime doğrulaması):** `src/index.ts`'te
    `EngineFactoryOptions`'a zorunlu bir `authValidator: { validationUrl,
    unauthenticatedUrlPatterns, navigationTimeoutMs? }` alanı eklendi;
    `createProductionEngine()` bundan bir `DefaultAuthValidator` kurup
    `PersistentStateEngine`'e 4. argüman olarak geçiyor. `options` parametresinin
    `= {}` varsayılanı kaldırıldı — `authValidator` verilmeden çağrı derleme
    zamanında reddediliyor (sessiz fallback yok, kullanıcı kararı). Demo
    bloğuna (`require.main === module`) gerçek panel/login URL'lerinin yerine
    açıkça `// TODO` etiketli placeholder'lar eklendi (uydurulmadı).
    **Runtime doğrulaması sırasında (`runtime-check-authvalidator.ts`, ilk
    sürüm) kullanıcının verdiği `validationUrl`'in örnek/placeholder
    (`app.hedef-portal.com`) olduğu ve Codespace'ten DNS çözülemediği ortaya
    çıktı — bu da `DefaultAuthValidator`'ın o anki hâlinde GERÇEK bir kusuru
    açığa çıkardı:** ağ/DNS hatası ile "sayfaya ulaşıldı ama login'e
    yönlendirildi" (gerçek unauthenticated) durumu, ikisi de sessizce `false`
    dönerek AYIRT EDİLEMİYORDU. Kullanıcı kararıyla `AuthValidationNetworkError`
    (yeni, `auth-validation.types.ts`) eklendi; `DefaultAuthValidator.validate()`
    artık ağ/DNS/timeout hatasında VE `!response.ok()` durumunda bu hatayı
    fırlatıyor — `false`/`true` SADECE sayfaya gerçekten ulaşılıp
    `unauthenticatedUrlPatterns` değerlendirilebildiğinde dönüyor.
    Doğrulama: `npx tsc --noEmit` → "0 hata"; `runtime-check-authvalidator-v2.ts`
    → **Test A** (çözümlenemeyen domain → artık `false` değil,
    `AuthValidationNetworkError` throw ediyor, `instanceof` ile teyitli) ve
    **Test B** (gerçek erişilebilir bir hedef — GitHub'ın oturum gerektiren bir
    sayfası, cookie yok → gerçekten login'e düşüp `false` dönüyor) — ikisi de
    ekran görüntüsüyle "✅ Tüm testler geçti" teyit edildi. **Sınır:** Test B
    kullanıcının KENDİ production `validationUrl`/pattern'lerini doğrulamıyor
    (o hâlâ gerçek değerler verildiğinde ayrıca yapılmalı) — sadece
    `DefaultAuthValidator`'ın davranışının (ağ hatası ≠ unauthenticated pattern
    eşleşmesi) düzeldiğini kanıtlıyor.
- **Sıradaki öncelik:** Madde #9 ertelendiği, #23 ve `authValidator` wiring'i
  (+ bulunan `AuthValidationNetworkError` regresyonu) tam kapandığı için sırada
  iki seçenek var: (a) #13 credential encryption, (b) #22 telemetry↔metrics
  bağlantısı. Kullanıcıdan teyit bekleniyor.

---

## ❓ CEVAP BEKLEYEN SORULAR

- **Madde #9 vs #17 etiket tutarsızlığı (Sağlık Kontrolü sırasında bulundu):**
  `AdaptiveGovernor.enqueueAnomaly`'deki dedup kontrolü kod yorumunda
  "Madde 9 Çözümü" diye etiketlenmiş, ama bu aslında Madde #17'nin (Anomaly
  deduplication / TTL cache) konusu — SESSION_INDEX'te #17 hâlâ **açık P2**
  görünüyor. Ya yorum yanlış etiketlenmiş ya da #17 kısmen zaten çözülmüş ve
  tabloya yansımamış. **Kullanıcıdan yanıt bekleniyor**, #17'nin durumu bu
  yanıt gelmeden değiştirilmedi.

---

## 🔴 AÇIK MADDELER — P0

| # | Madde | Katman | Durum |
|---|---|---|---|
| 9 | State restore validation (cookie≠authenticated) | state | açık — re-entrancy alt-bug'ı (guard'ın senkron zincirle atlanması) `queueMicrotask` fix'i ile giderildi ve mock runtime testinde tam doğrulandı (ikinci gizli hata yok, grep ile teyit edildi); **gerçek entegrasyon testi (mock'suz Playwright/proxy/DefaultAuthValidator) kullanıcı kararıyla projenin sonuna ertelendi** — madde bu nedenle açık kalıyor, şu an aktif çalışılmıyor |
| 13 | Credential/state encryption-at-rest | state/security | açık |
| 22 | Network telemetry → ProxyMetrics instrumentation bağlantısı | network | açık |
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
  için yukarıdaki ⚡ ANLIK DURUM.
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
  (telemetry bağlantısı) ileride sadece `getAllMetrics()`'e bağlanmalı,
  `getProxyMetrics()`'e ASLA (credential log/telemetriye sızar).
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
- Persistent proxy store için backend seçimi henüz kullanıcıya sorulmadı.
- Secret yönetimi kaynağı (env vs vault) henüz belirlenmedi.

---

## 📜 KAPANAN MADDELER GEÇMİŞİ

- **Madde #1** (Session 1 kod, Session 2'de gerçek kapanış).
- **Madde #5** (Session 1 kod, Session 2 doğrulama — KAPANDI).
- **Madde #6** (Session 1 kod, Session 2 derleme doğrulaması) — runtime
  doğrulaması hâlâ açık.
- **Madde #6, #7, #8 — TAM KAPANDI** (Session 3, runtime doğrulaması):
  `runtime-check.ts` (mock `Browser`/`AdvancedProxyManager` ile Governor↔Engine
  mantığını izole eden betik) `npx tsx` ile çalıştırıldı, ekran görüntüsüyle
  teyit edildi. Test 1: iki farklı anomaly art arda enqueue edildiğinde
  `acquireProxy()` tam 2 kez çağrıldı (#6 — ikinci decision kaybolmadı),
  legacy `.on('decision',...)` genel EventEmitter olarak çalışmaya devam
  ediyor ama `PersistentStateEngine` artık `RecoveryCommandPort` üzerinden
  işliyor (#7). Test 2: kasıtlı `newContext()` hatasında eski context
  değişmedi ve başarısız denemenin lease'i release edildi (#8 — rollback,
  sızıntı yok). Sonuç: "✅ Tüm testler geçti". **Sınır:** gerçek
  Playwright/proxy entegrasyonu değil, Governor/Engine mantığı mock'larla
  doğrulandı — bu ayrım not düşülür, "tam entegrasyon test edildi" iddia
  edilmez.
- **Madde #9 — guard/re-entrancy alt-bug'ı KAPANDI (Session 3, mock
  runtime doğrulaması; madde'nin kendisi P0 tablosunda AÇIK kalıyor):**
  `PersistentStateEngine.handleGovernorDecision`'ın catch bloğundaki senkron
  `enqueueAnomaly` çağrısı `isRecovering` guard'ını sessizce yutuyordu;
  `queueMicrotask(() => ...)` ile ertelendi. `runtime-check-madde9.ts`
  (Senaryo A/B) gerçek kullanıcı ortamında çalıştırıldı, debug çıktısıyla
  (`isRecovering=false` her seferinde) ve `grep -n "kritik hata"`'nın tüm
  log'da tek (beklenen, kasıtlı enjekte edilmiş) eşleşme döndürmesiyle
  teyit edildi — ikinci/gizli bir hata yok. **Sınır:** bu, mock
  `AuthValidationPort`/`Browser`/`AdvancedProxyManager` ile yapılan bir
  doğrulama; gerçek Playwright/proxy/`DefaultAuthValidator` entegrasyonu
  test edilmedi, kullanıcı kararıyla projenin sonuna ertelendi (bkz.
  Kritik Teknik Kararlar).
- **Madde #23 — TAM KAPANDI (Session 3, kod + tsc + runtime doğrulaması):**
  `getAllMetrics()` ve (o sırada yanlışlıkla) `getProxyMetrics()`, credential
  alanları (`username`/`password`) olmayan yeni bir `PublicProxyMetrics`
  tipine (`Omit<ProxyMetrics, 'username' | 'password'>`) çevrildi;
  `AdvancedProxyManager.ts` içinde ortak bir `toPublicMetrics()` helper'ı
  ile credential'lar destructure edilip elendi, geri kalan alanlar spread
  ile KOPYA olarak dönüyor. **Bu turda ortaya çıkan regresyon:**
  `getProxyMetrics()`'in de credential'sız tipe çevrilmesi
  `PersistentStateEngine.ts`'in gerçek proxy authentication'ı için
  `metrics.username`/`metrics.password`'e ihtiyaç duyan tek mekanizmasını
  kırdı (`tsc --noEmit` ile yakalandı, `src/index.ts`/`PersistentStateEngine.ts`
  derleme hatası verdi). Kullanıcı onayıyla `getProxyMetrics()` credential'lı
  hâline GERİ ALINDI (İÇ KULLANIM, motorun gerçek proxy bağlantısı için) —
  sadece `getAllMetrics()` (dışa açık/toplu görünüm) `PublicProxyMetrics`
  dönmeye devam ediyor. Doğrulama sırası: (1) `tsc --noEmit` → "Found 1
  error", kalan tek hatanın Madde #23 ile ilgisiz, önceden var olan bir
  `authValidator` wiring eksikliği olduğu teyit edildi (credential tip
  hataları tamamen kayboldu); (2) `runtime-check-madde23.ts` gerçek
  `AdvancedProxyManager` sınıfıyla (mock değil) çalıştırıldı, ekran
  görüntüsüyle "✅ Tüm testler geçti" teyit edildi — Test 1: `getAllMetrics()`
  çıktısında `username`/`password` alanları hem `in` kontrolüyle hem
  serialize edilmiş string kontrolüyle YOK; Test 2: `getProxyMetrics()`
  credential'ları hâlâ İÇERİYOR (regresyon fix'i doğrulandı); Test 3:
  `getAllMetrics()` çıktısını mutasyona uğratmak sınıfın iç state'ini
  etkilemiyor (kopya, referans değil). **Ders (bu turda öğrenildi):**
  Madde #23'ün kapsamını genişletirken (`getAllMetrics()`'ten
  `getProxyMetrics()`'e) gerçek tüketici kodu (`PersistentStateEngine.ts`)
  görülmeden onay istenmemeliydi — dosya başlığındaki eski bir not
  ("tek tüketici `acquireProxy()` kullanıyor") yanıltıcı çıktı.
- **Süreç dışı `authValidator` wiring bug'ı + `AuthValidationNetworkError`
  fix'i — TAM KAPANDI (Session 3, derleme + runtime + push doğrulaması):**
  `index.ts`'teki composition-root wiring'i (`EngineFactoryOptions.authValidator`
  zorunlu alan, `DefaultAuthValidator` DI) tamamlandı. Runtime doğrulaması
  sırasında kullanıcının verdiği `validationUrl`'in placeholder olduğu ortaya
  çıktı; bu da `DefaultAuthValidator`'ın ağ/DNS hatasını "unauthenticated"
  (`false`) ile karıştırdığı GERÇEK bir kusuru açığa çıkardı. Kullanıcı
  kararıyla yeni `AuthValidationNetworkError` eklendi — `false`/`true` artık
  SADECE sayfaya gerçekten ulaşılıp pattern değerlendirilebildiğinde dönüyor.
  Doğrulama: `tsc --noEmit` → 0 hata; `runtime-check-authvalidator-v2.ts` →
  Test A (çözümlenemeyen domain → `false` değil, `AuthValidationNetworkError`
  throw, `instanceof` ile teyitli) + Test B (gerçek erişilebilir hedef —
  GitHub'ın oturum gerektiren sayfası, cookie yok → gerçekten `false`) — ikisi
  de "✅ Tüm testler geçti" ile ekran görüntüsüyle teyit edildi. `git commit`
  + `git push` tamamlandı (`1f4e015..948fc44 main -> main`, hata yok — merge
  sırasında editör takılması bir git/ortam sorunuydu, kodla ilgisizdi).
  **Sınır:** Test B kullanıcının kendi production `validationUrl`/pattern'lerini
  DOĞRULAMADI (sadece davranış düzeltmesini kanıtladı) — gerçek değerler
  geldiğinde ayrıca test edilmeli.

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
  kod görüldükten sonra istenmeli.
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

---

*Not (Session 3 sonu, `wc -l` ile doğrulandı): Bu dosya şu an 372 satır —
AGENT.md Kural #11'deki 400 satır arşivleme eşiğine yaklaşıyor. Bir sonraki
büyük kapanışta arşive taşıma yapılmalı. Eşik aşıldığında en eski kapanmış
madde geçmişi (örn. Madde #1/#5/#6 girdileri) `session_arşiv.md`'ye TAM
taşınacak.*
