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
----
## TAŞIMA 3 (Session 3 — SESSION_INDEX.md 400 satır eşiği ikinci kez aşıldığında)

> Kaynak: SESSION_INDEX.md ⚡ ANLIK DURUM bölümü. Bu bloklar daha önce
> Kapanan Maddeler Geçmişi'nden Taşıma 1/2 ile arşive gönderilmişti, ama
> aynı içeriğin ANLIK DURUM'daki tam-metin kopyaları o taşımalarda
> gözden kaçmıştı — bu turda onlar da taşınıyor. Hiçbir şey özetlenmedi,
> tam metin aşağıda.

### Madde #6, #7, #8: KAPANDI

`runtime-check.ts` (mock `Browser` + mock `AdvancedProxyManager` ile
Governor↔Engine mantığını izole eden doğrulama betiği) `npx tsx
runtime-check.ts` ile çalıştırıldı, ekran görüntüsüyle teyit edildi:
- Test 1 (iki farklı anomaly art arda enqueue): `acquireProxy()` tam 2
  kez çağrıldı — ikinci decision kaybolmadı (#6), legacy
  `.on('decision',...)` hâlâ genel EventEmitter olarak tetikleniyor ama
  `PersistentStateEngine` artık ondan değil `RecoveryCommandPort`
  üzerinden işliyor (#7).
- Test 2 (kasıtlı `newContext()` hatası): eski context DEĞİŞMEDİ
  (rollback çalıştı), başarısız denemenin lease'i release edildi —
  sızıntı yok (#8).
- Sonuç satırı: "✅ Tüm testler geçti" (`failures === 0` olmadan bu satır
  basılmaz).
- **Kapsam sınırı:** bu doğrulama gerçek Playwright/proxy altyapısını
  test ETMEDİ — Governor/Engine arası sıralama ve komut-yönlendirme
  mantığını mock'larla izole doğruladı. Gerçek network/browser
  entegrasyonunun sağlıklı çalıştığı ayrı bir doğrulama konusu.

### Madde #9 — alt-bug kısmı KAPANDI (mock), gerçek entegrasyon ERTELENDİ

Madde #9 üzerinde test tasarımı yapılırken ayrı bir re-entrancy bug'ı
ortaya çıktı: `PersistentStateEngine.handleGovernorDecision`'ın catch
bloğundaki senkron `this.governor.enqueueAnomaly(...)` çağrısı,
`isRecovering` guard'ını sessizce yutuyordu — senkron zincir
(`enqueueAnomaly → processQueue → emitDecisionAndWait →
commandPort.handleDecision → handleGovernorDecision`) hiçbir await'e
uğramadan aynı çağrı yığınında ilerliyordu. Ayrı bir madde açılmadı, #9'un
kapsamına dahil edildi.

**[KARAR BİLDİRİMİ] ile onaylanan fix (Confidence: HIGH):** senkron
`enqueueAnomaly` çağrısı `queueMicrotask(() => ...)` ile bir sonraki
tick'e ertelendi (`setTimeout(...,0)` değil — mikrotask sırası event
loop'a çıkmadan çalıştığı için Node ortamında daha öngörülebilir).

Fix, `runtime-check-madde9.ts` (Senaryo A: `validate=false` — rollback +
guard'ın gerçekten aşıldığını + re-entrancy olmadığını doğrular; Senaryo
B: `validate=true` — normal COMMIT akışının bozulmadığını doğrular) ile
test edildi. Betik kullanıcının gerçek ortamında (gerçek
`AdvancedProxyManager`/playwright ile) çalıştırıldı, debug satırlı
referans çıktı paylaşıldı:
```
[DEBUG] handleGovernorDecision çağrıldı — action=ROTATE_SESSION_ONLY, isRecovering=false
[DEBUG] handleGovernorDecision çağrıldı — action=FULL_RECOVERY, isRecovering=false
[DEBUG] handleGovernorDecision çağrıldı — action=ROTATE_SESSION_ONLY, isRecovering=false
```
→ **Sonuç: re-entrancy fix çalışıyor, guard sorunu YOK.**

**İkinci kritik hata ihtimali elendi:** `grep -n "kritik hata" /tmp/out.log`
tüm log dosyasında tek bir eşleşme döndürdü (12. satır — Senaryo A'nın
kasıtlı enjekte ettiği `AuthRestoreFailedError`, testin beklenen parçası).
Gizli/ikinci bir hata YOK. Log'un geri kalanı (rollback, lease release,
Senaryo B COMMIT, queue boş) tümü ✓/✅ ile bitiyor — **"Tüm testler geçti"**
onaylandı.

**Kapsam ve karar (Session 3, kullanıcı onaylı):** guard/re-entrancy
alt-bug'ı mock seviyesinde tam doğrulandı ve bu alt-kapsam KAPANDI. Ancak
bu doğrulama gerçek Playwright/proxy/`DefaultAuthValidator` ile değil,
mock `AuthValidationPort`/`Browser`/`AdvancedProxyManager` ile yapıldı —
Madde #9'un asıl konusu olan **gerçek ortam entegrasyon testi** (gerçek
context'te cookie restore edilip gerçek auth doğrulamasının başarısız
olduğu senaryo) henüz yapılmadı. Kullanıcı kararıyla bu **projenin sonuna
ertelendi** — #9 bu nedenle P0 tablosunda AÇIK kalmaya devam ediyor, aktif
çalışılmıyor.

### Madde #23: KAPANDI (Session 3, tsc + runtime doğrulaması)

Bu süreçte bir regresyon (`getProxyMetrics()` yanlışlıkla credential'sız
tipe çevrilmiş, gerçek proxy authentication'ı kırmıştı) ortaya çıktı ve
aynı turda düzeltildi — ders: Madde #23'ün kapsamını genişletirken
(`getAllMetrics()`'ten `getProxyMetrics()`'e) gerçek tüketici kodu
görülmeden onay istenmemeliydi.

### Madde #33 — alt-adım KAPANDI (Session 3, git mv + tsc + runtime doğrulaması)

legacy→src/adapters taşıma + `PlaywrightPageObserver` 429/403 wiring.
Madde'nin kendisi kapanmadı — crash/requestfailed genişletmesi bilinçli
olarak ayrı bir tura bırakıldı.

### Süreç dışı, numarasız `authValidator` wiring bug'ı — TAM KAPANDI (Session 3, derleme + runtime doğrulaması)

Ayrıntı için bu bloğun bir üstündeki Taşıma 2 girdisi (aynı konunun
`AuthValidationNetworkError` fix'iyle birlikte daha önce taşınmış hâli).
----
---

## Taşıma 4 (Session 3) — Madde #22 tam detayı

> Bu blok, SESSION_INDEX.md'nin 400 satır eşiğini aşması nedeniyle (Kural #11)
> ⚡ ANLIK DURUM ve 📜 KAPANAN MADDELER GEÇMİŞİ bölümlerindeki Madde #22
> girdilerinin TAM METİN kopyasıdır — silinmedi, SESSION_INDEX'te kısa
> referans bırakıldı. Bu, mevcut session_arşiv.md'nin sonuna eklenecek
> YENİ bloktur; dosyanın geri kalanı bu blokla birlikte yeniden üretilmedi
> (Kural #11 / SELF-CORRECTION tablosu).

### A) ANLIK DURUM'dan taşınan detay

- **Madde #22 — alt-kapsam (THROTTLE + ROTATE_SESSION_ONLY→`markFailed`
  köprüsü, tip-guard dahil): KAPANDI (Session 3, runtime + derleme
  doğrulaması).** `runtime-check` betiğiyle 7/7 test PASS; `npx tsc --noEmit`
  → 0 hata.
- **Madde #22 — `recordSuccess` köprüsü: KAPANDI (Session 3, runtime
  doğrulamalı).** `npx tsx runtime-check.ts` gerçek komut çıktısı paylaşıldı
  (ekran görüntüsü) — TEST 4a PASS (geçerli `latencyMs`=123 ile
  `recordSuccess(proxy-5, 123)` doğru çağrıldı), TEST 4b PASS (negatif
  `latencyMs`=-5 ile `recordSuccess` çağrılMADI, guard doğru çalışıyor).
  Önceki turların TEST 1-3'ü de aynı çalıştırmada PASS. **Sınır aynen
  geçerli:** `!this.currentLease` dalı bu script'te kasıtlı kapsam dışı,
  hâlâ sadece kod okumasıyla biliniyor, runtime'da ayrıca doğrulanmadı.
- **Madde #22 — "diğer `GovernorAction` türleri için instrumentation
  bağlantısı kapsanmadı" iddiası YANLIŞTI, kayıt düzeltildi.**
  `PersistentStateEngine.ts` (`handleGovernorDecision`) gerçek kod
  okunarak doğrulandı: THROTTLE, QUARANTINE_PROXY, ROTATE_SESSION_ONLY,
  FULL_RECOVERY case'lerinin HEPSİ zaten `markFailed`'e bağlıydı
  (`if (this.currentLease) { ... }` deseniyle) — bu turdan önce de
  kodda mevcuttu. `NO_ACTION` kasıtlı olarak bağlı değil. Bu, daha önce
  `recordSuccess` için yaşanan "dosya başlığındaki eski not güncel
  gerçeği yansıtmıyordu" kalıbının bir tekrarı (bkz. ⚠️ DERSLER).
- **Madde #22 — kod okuması sırasında YENİ bir bulgu: `FULL_RECOVERY`
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
- **Madde #22 — TÜM ALT-KAPSAMLARIYLA TAM KAPANDI (Session 3).**
  THROTTLE, ROTATE_SESSION_ONLY, QUARANTINE_PROXY, FULL_RECOVERY → hepsi
  doğru tip-guard'larla `markFailed`'e bağlı; başarı yolu `recordSuccess`'e
  guard'lı bağlı. Tamamı `runtime-check.ts` (TEST 1-5, hepsi PASS) ve
  `npx tsc --noEmit` (0 hata) ile runtime + derleme seviyesinde doğrulandı.
  Madde P0 tablosundan kaldırıldı, ayrıntı Kapanan Maddeler Geçmişi'nde.

### B) Kapanan Maddeler Geçmişi'nden taşınan detay

- **Madde #22 — alt-kapsam genişletmesi (THROTTLE + ROTATE_SESSION_ONLY→
  `markFailed` köprüsü, tip-guard dahil) KAPANDI (Session 3, runtime +
  derleme doğrulaması; madde'nin kendisi P0 tablosunda AÇIK kalıyor):**
  `THROTTLE` aksiyonu için `markFailed` köprüsü önceki turda kapatılmıştı;
  bu turda `ROTATE_SESSION_ONLY` aksiyonu için aynı köprü + iki aksiyon
  arasında doğru ayrımı yapan bir tip-guard eklendi (`CHALLENGE_DETECTED`
  gibi diğer aksiyonlarda `markFailed` YANLIŞLIKLA tetiklenmemeli). Doğrulama
  — `runtime-check` betiğiyle **7/7 PASS, 0 FAIL**, `npx tsc --noEmit` →
  temiz, **0 hata**.
- **Madde #22 — `recordSuccess()` köprüsü KAPANDI (Session 3, runtime
  doğrulamalı):** `PlaywrightPageObserver`'ın genuinely başarılı (2xx)
  response'larda emit ettiği `'state'` event'i, `handleObserverState()` ile
  dinlenip `proxyManager.recordSuccess()`'e bağlanıyor; `latencyMs`
  sayısal değilse veya negatifse kayıt yapılmıyor (guard). `runtime-check.ts`'e
  eklenen TEST 4, `npx tsx runtime-check.ts` ile ÇALIŞTIRILDI ve PASS etti
  (4a: geçerli latency ile çağrıldı, 4b: negatif latency ile guard
  ÇAĞIRMADI) — gerçek komut çıktısı görüldü, "niyet beyanı" aşaması bitti.
  **Sınır:** `!this.currentLease` dalı bu script'te kasıtlı kapsam dışı,
  hâlâ sadece kod okumasıyla biliniyor.
- **Madde #22 — "diğer `GovernorAction` türleri kapsanmadı" kaydı
  DÜZELTİLDİ:** Önceki turlarda P0 tablosuna ve bu bölüme yazılan
  "THROTTLE/ROTATE_SESSION_ONLY dışındaki türler bağlı değil" iddiası,
  `PersistentStateEngine.ts`'in tam içeriği görülünce yanlış çıktı —
  QUARANTINE_PROXY ve FULL_RECOVERY zaten `markFailed`'e bağlıydı (muhtemelen
  daha önceki, ayrıntısı bu SESSION_INDEX'e hiç yazılmamış bir turda
  eklenmişti). Ders için bkz. ⚠️ DERSLER.
- **Madde #22 — TAM KAPANDI (Session 3), P0 tablosundan kaldırıldı:**
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

----.## TAŞIMA 5 (Session 3 — SESSION_INDEX.md 400 satır eşiği dördüncü kez aşıldı)

> Bu blok `session_arşiv.md`'nin SONUNA eklenir (append). Arşivin kendisi bu
> turda yeniden üretilmedi — sadece bu yeni taşıma bloğu verildi (Kural #11 —
> "arşiv parçasının kendisi hiçbir zaman tam dosya olarak yeniden üretilmez").
> Taşınan madde: #22, #13, #33, #2, #15 (tam kapanmış, SESSION_INDEX'te artık
> sadece tek satır referans bırakıldı) + 3 adet çözülmüş Cevap Bekleyen Soru.
> Hiçbir içerik silinmedi, sadece SESSION_INDEX.md'den buraya taşındı.

---

### Madde #22 — Governor aksiyonlarının proxy sağlığına doğru bağlanması (TAM KAPANDI, Session 3, P0 tablosundan kaldırıldı)

TÜM ALT-KAPSAMLARIYLA TAM KAPANDI. THROTTLE, ROTATE_SESSION_ONLY,
QUARANTINE_PROXY, FULL_RECOVERY case'lerinin hepsi doğru tip-guard'larla
`proxyManager.markFailed()`'e bağlandı; başarı yolu (`recordSuccess()` köprüsü)
guard'lı şekilde bağlandı. Ayrıntılar:

- THROTTLE case'i önceden `proxyManager`'ı hiç haberdar etmiyordu —
  QUARANTINE_PROXY/FULL_RECOVERY ile aynı desende `markFailed(proxyId,
  'HTTP_429')` eklendi.
- ROTATE_SESSION_ONLY case'ine de aynı desende `markFailed('HTTP_429')`
  eklendi, ama SADECE gerçek anomaly tipi `HTTP_429` ise (CHALLENGE_DETECTED
  de aynı action'a düştüğü için, proxy'nin `http429Count`'unun yanlışlıkla
  artmaması için tip-guard'lı).
- FULL_RECOVERY case'i önceden anomaly tipine bakmadan HER durumda
  `markFailed` çağırıyordu; düzeltme ile `AUTH_VALIDATION_FAILED` artık HARİÇ
  tutuluyor (proxy sağlığı ile session/auth-state sağlığı ayrı katmanlar).
- `recordSuccess()` köprüsü eklendi: `PlaywrightPageObserver`, genuinely
  başarılı (`response.ok()`, 2xx) response'larda `IStateObserver`'ın önceden
  var olan ama hiç kullanılmayan `'state'` kanalını emit ediyor;
  `PersistentStateEngine.handleObserverState()` bunu dinleyip
  `proxyManager.recordSuccess()`'e bağlıyor.

Doğrulama: `runtime-check.ts` (TEST 1-5, hepsi PASS) + `npx tsc --noEmit`
(0 hata) ile runtime + derleme seviyesinde doğrulandı.

### Madde #13 — Credential/state encryption-at-rest (TAM KAPANDI, Session 3, P0 tablosundan kaldırıldı)

Secret yönetimi kaynağı KARARLAŞTIRILDI ve UYGULANDI: env var
(`STATE_SYNC_ENCRYPTION_KEY`) + AES-256-GCM envelope encryption, bir
`SecretProvider` interface'i (`src/security/`) arkasında. `ProxyCredentialStore`
(`src/state/`, SQLite / `better-sqlite3`) eklendi. `AdvancedProxyManager`
constructor'ı geriye dönük uyumlu opsiyonel 3. parametre (`credentialStore?`)
ile genişletildi.

Doğrulama: `runtime-check-persistence.ts` ile **4/4 PASS**; `npx tsc --noEmit;
echo "EXIT CODE: $?"` → **EXIT CODE: 0** ekran görüntüsüyle teyit edildi.

**Güvenlik notu:** doğrulama sırasında üretilen bir `STATE_SYNC_ENCRYPTION_KEY`
örneği bir ekran görüntüsünde açığa çıkmıştı, kullanıcıya rotate etmesi
önerildi.

**Kapsam dışı bırakılan açık takip (production'da fiilen aktif olması için
hâlâ gerekli):** (a) `package.json`'a `better-sqlite3`/`@types/better-sqlite3`
eklenmesi, (b) composition-root'ta `credentialStore`/`dbPath` injection —
ikisi de hâlâ görülmedi, Madde #2'nin aynı türden açık takibiyle birleşiyor.

### Madde #33 — crash/requestfailed'in IStateObserver sözleşmesine taşınması (TAM KAPANDI, Session 3, P0 tablosundan kaldırıldı)

`crash`/`requestfailed`, `PersistentStateEngine.attachLifecycleObservers()`
içinde ham `page.on(...)` olarak kalan son iki sinyaldi — artık ikisi de
`IStateObserver` sözleşmesi üzerinden, `PlaywrightPageObserver` aracılığıyla
geliyor. `IStateObserver.AnomalyType`'a jenerik `PROCESS_CRASHED`/
`NETWORK_ERROR` değerleri eklendi — governor tarafının `PAGE_CRASH`/
`NETWORK_FAILURE` isimlerinden BİLİNÇLİ OLARAK farklı (iki ayrı sözleşmenin
yanlışlıkla aynı tip sanılmaması için), ikisini eşleyen TEK yer
`PersistentStateEngine.translateObserverAnomaly()`.
`requestfailed` için önceki filtre (SADECE `net::ERR_`/`DNS` içeren hatalar)
AYNEN korundu.

Doğrulama: `runtime-check-observer.ts` ile **6/6 PASS** (crash→PROCESS_CRASHED,
net::ERR_→NETWORK_ERROR + rawError/sourceUrl doğru taşınıyor, filtre dışı hata
emit edilmiyor, `stop()` sonrası dinleme kesiliyor), `npx tsc --noEmit; echo
"EXIT CODE: $?"` → **EXIT CODE: 0**.

`IStateObserver.ts`/`IResourceAdapter.ts`, bu madde kapsamında `legacy/`'den
`src/adapters/`'a taşındı — artık `src/`'in resmi parçası.

### Madde #2 — Persistent proxy state (TAM KAPANDI, Session 3, P1 tablosundan kaldırıldı)

Proxy store backend KARARLAŞTIRILDI ve UYGULANDI: SQLite (`better-sqlite3`),
`ProxyCredentialStore` ile aynı DB dosyası, ayrı `proxy_health` tablosu.
Gerekçe: tek-node motor, ekstra servis/network bağımlılığı istenmiyor; Redis
ve Neon/Postgres kullanıcı onayıyla elendi. Yeni `ProxyHealthStore`
(`src/state/ProxyHealthStore.ts`) proxy health/quarantine alanlarını kalıcı
hale getiriyor; yazma sadece `markFailed()` içinde `quarantineUntil`
güncellendiği anda tetikleniyor (write-through DEĞİL — bu bilinçli bir
trade-off olarak not düşülüyor, aksi halde ileride "bug" sanılabilir). TTL =
24 saat, kullanıcı onayıyla sabitlendi.

Doğrulama: `runtime-check-health.js` ile **6/6 PASS** (runtime) + `npx tsc
--noEmit` → **EXIT CODE: 0** (derleme) ekran görüntüleriyle teyit edildi.

**Housekeeping (kullanıcı onayıyla):** derlenmiş `runtime-check-health.js`
repo kökünden silindi (diğer `runtime-check-*` dosyaları gibi yalnızca `.ts`
kaynağı kalıyor).

**Kapsam dışı bırakılan açık takip:** composition-root'ta hangi `dbPath`'in
kullanılacağı hâlâ görülmedi — Madde #13'ün aynı türden açık takibiyle
birleşiyor, ikisi de aynı composition-root noktasında çözülecek.

### Madde #15 — Structured (JSON) logging (TAM KAPANDI, Session 3, P1 tablosundan kaldırıldı)

Kural #5 ("Governor/ProxyManager/StateEngine aynı turda birlikte
değiştirilmez") gereği önce sözleşme + implementasyon izole verildi:
`src/telemetry/ILogger.ts` (arayüz: `debug/info/warn/error`, her biri
`message: string` + opsiyonel `meta: Record<string, unknown>` alır) +
`src/telemetry/ConsoleJsonLogger.ts` (constructor'da `component: string` alır,
`{"level","component","message",...meta}` JSON şeklini üretir — daha önce
`ProxyHealthStore`'un stopgap olarak kullandığı şeklin tek merkezi kaynağı).
Ardından 3 tüketici dosya (`ProxyHealthStore.ts`, `PersistentStateEngine.ts`,
`index.ts`) SecretProvider/AuthValidationPort'ta izlenen sırayla, ayrı ayrı
KARAR BİLDİRİMİ'leriyle güncellendi. Enjeksiyon deseni: `healthStore?`/
`credentialStore?` ile aynı desende **opsiyonel constructor parametresi**
(verilmezse `ConsoleJsonLogger` varsayılan) — `authValidator`'ın ZORUNLU
olmasından BİLİNÇLİ OLARAK farklı, çünkü loglama eksikliği Kural #4 anlamında
"sahte veri/sessiz fallback" üretmiyor, sadece log basmıyor.

**Tutarsızlık bulundu ve düzeltildi:** `PersistentStateEngine.ts` için grep
çıktısı (2 gün önce alınmış) 5 `console.*` çağrısı gösteriyordu, ama gerçek
dosyada 7 vardı (`captureState`/`applyState` catch bloklarındaki 2
`console.warn` grep'te kayıptı) — gerçek dosya esas alındı, 7 çağrının tamamı
değiştirildi. Repo genelinde toplam **11** `console.*` çağrısı `ILogger`'a
taşındı (`index.ts`'teki demo bloğu dahil — tutarlılık için taşınmasına karar
verildi).

Doğrulama: izole `runtime-check-logger.ts` ile **4/4 PASS** (seviye→doğru
`console.*` metodu + doğru JSON şekli; `meta` içindeki çakışan anahtarlar
`level/component/message`'ı ezemiyor; circular `meta` throw etmiyor,
`metaSerializationError:true` ile `message` kaybolmadan devam ediyor; `meta`
verilmediğinde ekstra alan sızmıyor) + repo genelinde (3 tüketici dosya
dahil, projenin kendi `tsconfig.json`'ıyla) `npx tsc --noEmit; echo "EXIT
CODE: $?"` → **EXIT CODE: 0**.

**Kapsam dışı bırakılan açık takipler:** (a) log seviyesi filtreleme (env var
ile min-level) — Madde #27 (merkezi config) ile birleşebilir; (b)
`runtime-check-logger.ts` içindeki `ProxyHealthStore` entegrasyon testi
(TEST 5) bu turda dosyadan çıkarıldı — Kural #5 gereği Madde #15'in kapanışını
`better-sqlite3` kurulumuna bağımlı hale getirmemek için, sadece izole
sözleşme test edildi. **Ayrıca not (araç uyumsuzluğu, kod kaynaklı değil):**
Node'un yerleşik TypeScript desteği (Node 24) uzantısız relative import'ları
çözemediği için `runtime-check-logger.ts` doğrudan `node` ile çalıştırılamadı
— projenin kendi konvansiyonuna uyularak `npx tsc` ile `/tmp` altına
derlenip derlenmiş `.js` çalıştırıldı (repo köküne housekeeping gereken bir
dosya bırakılmadı).

---

### Çözülmüş Cevap Bekleyen Sorular (Taşıma 5 ile arşive alındı)

- **`FULL_RECOVERY`/`AUTH_VALIDATION_FAILED` düzeltmesi doğrulama yöntemi:**
  `tsc --noEmit` yeterli mi, yoksa TEST 5 mi eklensin? — **fiilen TEST 5
  eklenerek çözüldü**: hem `tsc --noEmit` (0 hata) hem `runtime-check.ts`
  TEST 5a/5b (PASS) ile doğrulandı, Madde #22 kapandı.
- **`PersistentStateEngine.ts` (debug-log temizlenmiş sürüm) repo'ya
  uygulandı mı?** — **kullanıcı teyit etti: evet, uygulandı**.
- **Madde #13 — `npx tsc --noEmit` gerçekten 0 hata mı döndü?** — **çözüldü**:
  `EXIT CODE: 0` ekran görüntüsüyle teyit edildi.
- **Madde #33 — crash/requestfailed `IStateObserver`'a nasıl taşınacak,
  `AnomalyType` genişletilecek mi?** — **çözüldü**: kullanıcı onayıyla
  `PROCESS_CRASHED`/`NETWORK_ERROR` eklendi, `runtime-check-observer.ts`
  6/6 PASS + `EXIT CODE: 0` ile doğrulandı.
- **Madde #2 — TTL süresi (24 saat) production için uygun mu, housekeeping
  (`runtime-check-health.js`) silinsin mi?** — **kullanıcı onayladı**: TTL
  24 saat sabitlendi, dosya silindi.
- **Madde #15 — `ILogger` enjeksiyon şekli (opsiyonel + varsayılan
  `ConsoleJsonLogger`) ve `index.ts` demo bloğundaki `console.*`'ların da
  taşınıp taşınmayacağı?** — **fiilen çözüldü**: 3 tüketici dosya (demo bloğu
  dahil `index.ts`) merkezi `ILogger`'ı kullanacak şekilde güncellendi,
  tutarlılık tercih edildi; opsiyonel/varsayılan enjeksiyon deseni değişmeden
  uygulandı ve testlerle doğrulandı.

------
## TAŞIMA 6 (Session 3) — Madde #24, #25 tam kapanış anlatıları

> Gerekçe: SESSION_INDEX.md 400 satır eşiği Madde #27'nin kapanışıyla
> (beşinci kez) aşıldı. CORE.md §7.1 gereği, artık kapanmış/tamamlanmış
> içerik (Madde #24 ve #25'in ANLIK DURUM + Kritik Teknik Kararlar +
> Kapanan Maddeler Geçmişi'ndeki üç kopyası, ve bu ikisine ait iki eski
> oturum-sonu notu) TAM METİN olarak buraya taşındı. Hiçbir içerik
> silinmedi/özetlenmedi — SESSION_INDEX.md'de artık sadece tek satırlık
> referanslar var.

---

### Madde #24 — Engine lifecycle (start/stop/dispose): TAM KAPANDI (Session 3)

`lifecycleState: 'created' | 'ready' | 'closing' | 'closed'` guard'ı eklendi —
`initialize()` artık 'created' dışında throw ediyor (çift initialize
engellendi); `handleDecision()` artık 'ready' dışında no-op + warn log
yapıyor (governor kararları guard'lı).

**GERÇEK BULGU (tespit bu maddeyi açtı):** `attachLifecycleObservers()` her
çağrıldığında yeni bir `PlaywrightPageObserver` kuruyordu ama referans
hiçbir instance alanında saklanmıyordu — leak sadece `close()`'da değil HER
recovery rotasyonunda oluşuyordu. Artık `this.observer` alanında
saklanıyor; yeni observer kurulmadan ÖNCE eskisi `stop()` ediliyor.
`close()` artık idempotent (ikinci çağrı no-op), `context`/`page`
kapanıştan sonra `undefined`'a çekiliyor (stale referans riski kapatıldı —
`getPage()`/`getContext()` artık kapalı bir context/page döndürmüyor).
`index.ts`'e `EngineFactory.disposeEngine()` eklendi — engine/browser'ı
try/finally ile güvenli kapatıyor (önceden `engine.close()` throw ederse
`browser.close()` hiç çalışmıyordu), main-entry bloğu buna geçirildi.
`governor.setCommandPort` kaydına BİLİNÇLİ OLARAK dokunulmadı (KARAR
BİLDİRİMİ'nin kapsam sınırı).

**Doğrulama (üç kanıt):** (1) statik — `npx tsc --noEmit`, gerçek Codespace
ortamında, tam repo, **sıfır hata**; (2) kapsam — diff ile değişikliğin
sadece onaylanan iki dosyaya (`PersistentStateEngine.ts`, `index.ts`)
sınırlı kaldığı teyit edildi, Governor/ProxyManager'a dokunulmadı; (3)
runtime — smoke-test (`tsx` ile; `ts-node@10.9.2`'nin Node 24 ile bilinen
bir config-okuma uyumsuzluğu nedeniyle `tsx`'e geçildi) çift
`initialize()`'ın throw ettiğini ve çift `close()`'un sessizce no-op
olduğunu doğruladı — **ikisi de PASS**. Madde P1 tablosundan kaldırıldı.

---

### Madde #25 — Graceful shutdown (SIGTERM/SIGINT): TAM KAPANDI (Session 3)

Guard mantığı, main-entry closure'ından bağımsız, enjekte edilebilir
`disposeEngine`/`exit` alan `createShutdownController()` fonksiyonuna
çıkarıldı (izole test edilebilirlik için) — `index.ts`'ten export ediliyor.
`shutdown(signal, logger)` idempotent: ilk çağrı `disposeEngine()`'i
çağırıp `exit(0)` çağırır, sonraki her çağrı (çift sinyal ya da
normal-akış-sonrası bir sinyal) no-op'tur. `markDisposed()`, normal akışın
(30sn bekleme sonu) kendi dispose'unu yaptığı durumda aynı guard'ı
senkronize eder. Main-entry, `process.on('SIGTERM'|'SIGINT', ...)` ile bu
controller'a bağlandı; `browser`/`engine` referansları sinyal
handler'ının erişebileceği dış scope'ta tutuluyor, `createProductionEngine()`
dönmeden bir sinyal gelirse (referanslar hâlâ `undefined`) hiçbir şey
dispose edilmeden no-op geçiliyor.

**Doğrulama (üç kanıt):** (1) statik — `npx tsc --noEmit`, tam repo, **sıfır
hata**; (2) kapsam — sadece `index.ts` (main-entry bloğu + yeni export)
değişti, `PersistentStateEngine.ts`'e bu turda hiç dokunulmadı; (3) runtime
— `runtime-check-shutdown.ts` (repo kökünde, diğer `runtime-check-*.ts`
dosyalarıyla aynı konvansiyonda; ilk taslak yanlışlıkla `scripts/` altına
konup import yolu kırılmıştı, düzeltildi) ile **4/4 PASS** (ilk shutdown
dispose+exit(0), çift sinyal no-op, `markDisposed()` sonrası sinyal no-op,
opsiyonel `exit` parametresi).

**Kapsam dışı bırakılan açık gözlem (madde değil):** Codespace'te gerçek bir
`kill -TERM` denemesinde `chromium.launch()` dbus soket hatasıyla başarısız
oldu ve `main-entry`'nin `catch` bloğu bunu "Kritik hata" olarak loglayıp
**`process.exitCode` ayarlamadan** (varsayılan 0 ile) çıktı — bu, Madde
#25'in kapsamı dışında, main-entry'nin hata yolunda önceden var olan ayrı
bir bulgu; gerçek sinyal iletiminin (`npx tsx ... &` ile `$!`'in gerçek
node process'i mi yoksa `npx` wrapper'ı mı olduğu) ve Codespace'te headless
Chromium'un dbus'suz çalışması gerektiğinin ayrıca doğrulanması gerekiyor —
deploy (Fly.io) öncesi ele alınmalı, bu turda yeni bir madde açılmadı.
Madde P1 tablosundan kaldırıldı.

---

### Eski oturum-sonu notları (arşive taşındı, SESSION_INDEX'ten kaldırıldı)

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

*Not (Session 3, önceki tur — Madde #25 kapanışı): Graceful shutdown guard
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
