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

