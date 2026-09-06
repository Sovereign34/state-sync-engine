# STATE-SYNC-ENGINE — SESSION ARŞİVİ (_ilk parça_)
> AGENT.md Kural #11 gereği: SESSION_INDEX.md 400 satır eşiğini aştığında,
> kapanmış/tamamlanmış içerik buraya TAM olarak taşınır — özetlenmez,
> silinmez. Bu dosyanın kendisi asla tam olarak yeniden üretilmez, sadece
> yeni taşınan blok eklenir (append mantığı).

---

## Taşıma 1 (Session 3 sonu)

**Gerekçe:** SESSION_INDEX.md, Madde #33 alt-adımının (legacy→src/adapters
taşıma) kapanış girdisi eklendikten sonra 420 satıra ulaştı (400 eşiğinin
üzerinde). Kapanan Maddeler Geçmişi'ndeki en eski girdiler (Madde #1, #5,
eski #6, tam kapanmış #6/#7/#8 bloğu, #9 alt-bug, #23) buraya taşındı.
En yeni iki kapanış (authValidator wiring + Madde #33 alt-adımı) hâlâ
aktif çalışmayla doğrudan ilişkili olduğu için SESSION_INDEX.md'de kaldı.

**Taşınan içerik (SESSION_INDEX.md Kapanan Maddeler Geçmişi'nden, değiştirilmeden):**

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
  Kritik Teknik Kararlar — SESSION_INDEX.md).
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

----
## Taşıma 2 (Session 3 — SESSION_INDEX.md 400 satır eşiği, Kural #11)

> Aşağıdaki iki girdi, Madde #22 alt-kapsam kapanışı SESSION_INDEX.md'ye
> eklenirken eşiği aşmamak için oradan TAM METİN olarak buraya taşındı.
> Hiçbir şey özetlenmedi/silinmedi.

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
- **Madde #33 — alt-adım (legacy→src/adapters taşıma + PlaywrightPageObserver
  429/403 wiring) TAM KAPANDI (Session 3, git mv + tsc + runtime doğrulaması;
  madde'nin kendisi P0 tablosunda AÇIK kalıyor):** Yeni
  `PlaywrightPageObserver implements IStateObserver` sınıfı (`src/adapters/`)
  oluşturuldu — SADECE 429/403 (`RATE_LIMIT_EXCEEDED`/`ACCESS_RESTRICTED`,
  `IStateObserver.AnomalyType`'a lossless eşlenen iki sinyal) buraya
  taşındı. `crash`/`requestfailed` (DNS/network) sinyalleri **bilinçli
  olarak bu turda taşınmadı** — `IStateObserver.AnomalyType`
  (`RATE_LIMIT_EXCEEDED | ACCESS_RESTRICTED | SESSION_EXPIRED |
  CHALLENGE_DETECTED`) bunlar için lossless bir karşılık içermiyor, zorla
  sığdırmak (örn. crash'i `SESSION_EXPIRED` yapmak) yanlış sinyal üretir —
  genişletme ayrı bir tur. `PersistentStateEngine.attachLifecycleObservers()`
  bu observer'ı + `AnomalyPayload → SemanticAnomaly` çeviri handler'ını
  kullanacak şekilde güncellendi; çeviri metodunun `default` dalı beklenmeyen
  bir `AnomalyType` gelirse sessizce yutmuyor, `console.warn` basıyor
  (Madde 22 disiplini). **Kod verilirken ortaya çıkan bulgu:**
  `IStateObserver.ts`/`IResourceAdapter.ts`'in gerçek konumunun
  `src/adapters/` değil `legacy/` olduğu bulundu — Madde #1'in tam önlemeye
  çalıştığı legacy-bağımlılığı riskiydi (`find` ile ikisi de teyit edildi).
  Kullanıcı onayıyla (a) seçildi: iki dosya içerik değiştirilmeden
  `git mv legacy/IStateObserver.ts src/adapters/IStateObserver.ts` ve aynısı
  `IResourceAdapter.ts` için uygulandı. Doğrulama: `tsc --noEmit` → önce
  "Found 2 errors in 2 files" (`PlaywrightPageObserver.ts:33`,
  `PersistentStateEngine.ts:54`, taşıma öncesi import kırıklığı), taşıma
  sonrası → 0 hata; `runtime-check.ts` → "✅ Tüm testler geçti" (Madde
  #6/#7/#8 regresyonu yok); `git status` rename'i %100 eşleşme olarak
  gösterdi (silme+ekleme değil); `git commit` + `git push` temiz
  (`484afae..4f4840b main -> main`). **Sınır:** Madde #33'ün kendisi
  KAPANMADI — sadece bu alt-adım (429/403 wiring + legacy taşıma). Açık
  kalanlar: crash/requestfailed genişletmesi (ayrı tur) ve `legacy/`
  klasöründe başka unutulmuş dosya olup olmadığının genel taraması
  (yapılmadı, sadece bu iki dosya için nokta atışı `find` çalıştırıldı).
