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
  - Madde #13, #22, #23, #33: Session 2'den değişmedi.
- **Sıradaki öncelik:** Madde #9 ertelendiği için başka bir P0 maddesi
  seçilmeli (#13 credential encryption, #22 telemetry↔metrics bağlantısı,
  veya #23 credential/metrics izolasyonu) — kullanıcıdan teyit bekleniyor.

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
| 23 | Proxy credential/metrics izolasyonu (getAllMetrics sızıntısı) | network/security | açık — doğrulandı: `getAllMetrics(): ProxyMetrics[]` username/password dahil tüm alanları çıplak döndürüyor |
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
