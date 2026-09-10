# Agent Project Memory & Architectural Governance

## 🎯 Core Operating Principles & Intent
- **Operational Objective:** Execute high-concurrency, resilient state synchronization and automation against heavily protected target portals (utilizing Cloudflare, Akamai, and advanced bot mitigations) while strictly preventing IP bans through dynamic mobile (4G/5G) proxy leasing.
- **Engineering Standard:** Zero tolerance for shortcut implementations ("sahte kod"), silent fallbacks, or unvalidated assumptions. All changes must compile cleanly via `tsc --noEmit` and adhere to rigorous domain-driven design principles.

## 🛠️ Architectural & Design Invariants
1. **Strict Port & Adapter Separation (Dependency Inversion):**
   - Core engine logic must never hardcode site-specific selectors or heuristics.
   - All external interactions and validations must flow through abstract interfaces (e.g., `RecoveryCommandPort`, `AuthValidationPort`).
2. **The Make-Before-Break Restore Pipeline (`APPLY -> Validation -> COMMIT`):**
   - When restoring preserved sessions, state application (`APPLY`) must be followed immediately by authentication validation (`AuthValidationPort`) *before* final resource commitment (`COMMIT`).
   - If validation fails, an `AuthRestoreFailedError` must be triggered to execute safe rollbacks, release lease resources without leaks, and escalate through the governor (`FULL_RECOVERY` with `preserve=false`).
3. **Mandatory Configuration Enforcement:**
   - Critical configuration options (such as validation URLs and unauthenticated redirect patterns) must be strictly mandatory in factory options (`EngineFactoryOptions`). 
   - No silent defaults or "assume valid" fallbacks are permitted; missing configurations must throw explicit errors at initialization time to eliminate security blind spots.

## 🔒 Quality & Verification Protocols
- **Proof of Execution:** Never assume a fix works based on theory or compilation alone; verify behaviors through isolated runtime checks and explicit script validations.
- **Context Preservation:** Maintain strict alignment with the ACOS framework, ensuring modularity, trace safety, and clean separation between network, state, and engine layers.
Claude, PersistentStateEngine içindeki GovernorAction.THROTTLE durumuna this.proxyManager.markFailed(this.currentLease.proxyId, 'HTTP_429') çağrısının eklenmesini (Madde #22'nin dar kapsamlı telemetri köprüsü) onaylamıştır. Bu değişiklikle birlikte THROTTLE kararı alındığında proxy sağlık skoru ve http429Count mekanizması düzgün bir şekilde tetiklenecektir. Ek bir doğrulama betiğine gerek duyulmaksızın, kodun mevcut runtime-check.ts akışına dahil edilmesi ve npx tsc --noEmit ile kontrol edilmesi kararlaştırılmıştır.
----
ACOS (AI-Augmented Cognitive Operating System) Yol Haritası ve Entegrasyon Planı
Mevcut çekirdek altyapı (P0, P1 ve P2 fazları) tamamlandıktan sonra, hedef sistem (konsolosluk/randevu platformları) entegrasyonu ve site keşfi (discovery) aşamaları için izlenecek uçtan uca mimari yol haritası:
Faz 1: Çekirdek Altyapının Tamamlanması (Mevcut Faz)
 * PersistentStateEngine & Recovery: Oturumların (cookie, localStorage) güvenli saklanması ve çökme durumunda otomatik geri yükleme mekanizmaları.
 * AdvancedProxyManager: IP havuzu yönetimi, sağlık skorları ve HTTP_429 / engellenme durumlarında anlık karantina döngüleri.
 * AdaptiveGovernor: İstek hızlarının kontrolü, mekanik döngülerin engellenmesi ve insan benzeri rastgele gecikmelerin (jitter) uygulanması.
Faz 2: Hedef Keşif ve Analiz Katmanı (Discovery Phase)
 * DOM ve Ağ Trafiği Analizi: Hedef sistemin arkasındaki WAF (Cloudflare/Akamai vb.) katmanlarının, çerez set etme politikalarının ve istek/yanıt imzalarının taranması.
 * Endpoint Haritalandırma: Randevu takvimlerinin ve slot verilerinin çekildiği gizli API uç noktalarının (XHR/Fetch) veya sayfa içi form elementlerinin tespiti.
 * Rate-Limit Eşik Testleri: Hedef sistemin IP veya oturum başına kaç istekte blok atacağının güvenli test senaryolarıyla belirlenmesi.
Faz 3: Adaptör Katmanı Entegrasyonu (IResourceAdapter)
 * İzolasyon Prensibi: Hedef sisteme özgü tüm seçiciler (selectors), form doldurma mantığı ve sayfa akışları çekirdek motordan bağımsız olarak IResourceAdapter arayüzü üzerinden yazılır.
 * Modüler Genişleme: Çekirdek motor hedef sistemin adını bilmez; yalnızca adaptörden gelen başarı veya hata sinyallerine göre proxy değiştirir veya bekler.
Faz 4: Zamanlama ve Polling Motoru (Slot Tespiti)
 * Akıllı Yoklama (Smart Polling): AdaptiveGovernor ile entegre çalışarak, sunucuyu yormayacak ve engellenmeyecek şekilde optimize edilmiş aralıklarla slot kontrolü yapılması.
 * Olay Güdümlü Tetikleyici (Event-Driven): Boş slot tespit edildiği anda ilgili adaptörün orkestrasyon katmanına sinyal göndermesi.
Faz 5: WAF, Captcha ve Kritik İşlem Hattı (Commit Pipeline)
 * Harici Çözüm Entegrasyonları: Gerekli durumlarda CAPTCHA veya doğrulama adımlarını aşmak için adaptör katmanına harici çözüm servislerinin bağlanması.
 * Commit State Akışı: Tespit edilen slotun APPLY -> Validation -> COMMIT adımlarıyla, oturum bütünlüğü bozulmadan en hızlı şekilde rezerve edilmesi.
----
Eklenmesi Önerilen Kritik Başlıklar
Mevcut yol haritasına operasyonel güvenlik, hata yönetimi ve otomasyon kararlılığı açısından şu kritik maddeleri de eklemek, sistemin canlıda (production) kesintiye uğramasını önlemek için oldukça faydalı olacaktır:
 * Simülasyon / Dry-Run Modu: Hedef sistemde gerçek rezervasyon (commit) adımını tetiklemeden önce adaptörün form doldurma, element seçimi ve DOM okuma mantığını test eden güvenli bir "kuru sıkı" test modu.
 * Anlık Bildirim ve Telemetri Köprüsü: ConsoleJsonLogger yapısına ek olarak, kritik bir slot bulunduğunda, proxy havuzu tükendiğinde veya HTTP_429 blokları tavan yaptığında Telegram/Discord üzerinden anlık uyarı alacak bir webhook entegrasyonu.
 * Devre Kesici (Circuit Breaker) ve DOM Değişiklik Algılama: Hedef sitenin arayüzünde (DOM) yapısal bir güncelleme yapıldığında adaptörün hatalı veri girmesini veya sonsuz döngüye girmesini engelleyen otomatik durdurma emniyeti.
 * Çoklu Hesap ve Profil Segmentasyonu: Her bir hedef hesabın çerezleri, oturum bilgileri ve parmak izlerinin ProxyCredentialStore ile birebir eşleştirilerek cross-contamination (oturum karışması) riskinin tamamen ortadan kaldırılması.
Bu eklemeleri de içeren nihai yol haritasını doğrudan GEMINI_NOTES.md veya SESSION_INDEX.md dosyasına işleyerek bir sonraki oturumda kaldığın yerden tam bağlamla devam edebilirsin.
-----

---

## 🧩 Eksik Görülen Katmanlar (Faz 6+ Adayları)

> Bu bölüm, mevcut 5 fazlı yol haritasının DIŞINDA kalan, hedef sistem
> (VFS/konsolosluk/randevu platformları) entegrasyonunda kritik olduğu
> değerlendirilen ek katmanları listeler. Sıralama öncelik değil, konu
> bütünlüğüne göredir. Her başlık altında **sorun → çözüm → teknik not**
> akışı izlenir. Production'a alınmadan önce ilgili başlık KARAR BİLDİRİMİ
> formatına dönüştürülüp SESSION_INDEX.md'ye taşınmalıdır.

---

### 🌐 Ağ Katmanı — TLS / JA3 / JA4 İmza Yönetimi

**Sorun:** Node.js `axios`/`fetch` varsayılan TLS stack'i, ClientHello
paketinde sabit cipher suite ve extension sıralaması kullanır. Cloudflare
bu hash'i (JA3/JA4) bilinen bot imzaları listesinde tutar. Proxy residential
olsa bile TLS katmanından yakalanma riski yüksektir.

**Çözüm:** Node.js TLS stack'ini tarayıcı benzeri imza üretecek şekilde
değiştiren bir transport katmanı.

**Araç adayları:**

| Araç | Dil | Boyut | Bakım | Değerlendirme |
|---|---|---|---|---|
| `impit` (Apify) | Node (Rust binding) | ~5-10MB | ✅ Aktif | Birincil aday |
| `curl-impersonate` | C wrapper | Büyük | ⚠️ Bakımsız | Yedek |
| `cycletls` | Go subprocess | ~81MB | ⚠️ Zayıf | Yedek |
| `got-scraping` | Node | Orta | ⚠️ | Değerlendirilebilir |

**Teknik not:**
- İki ayrı katman ayrı ele alınmalı: (a) **CAPTCHA solver API çağrıları**,
  (b) **hedef site istekleri**. Playwright Chromium zaten kendi TLS'ini
  kullanır ama Chrome'un TLS'i de fingerprint'lenebilir.
- `impit` seçilirse `CapSolverAdapter`'ın `axios` bağımlılığı değişir;
  mevcut `AxiosInstance` enjeksiyonu bir `HttpClientPort` soyutlamasına
  çevrilmeli (test edilebilirlik korunur).
- **Kritik:** Proxy residential + TLS imzası tarayıcı-benzeri + browser
  fingerprint (`StealthContextBuilder`) = üçü birlikte olduğunda Cloudflare
  geçiş oranı %80+.

**Kapsam dışı:** HTTP/2 ve HTTP/3 fingerprint'leri (Akamai bunlara da
bakar) — ayrı başlık açılmalı.

---

### 📝 Form-Filling & Selector Adaptörü

**Sorun:** VFS/konsolosluk formları site-spesifik; her form değişikliğinde
kod kırılır. Mevcut `AuthValidationPort` deseni var ama form doldurma için
karşılığı yok.

**Çözüm:** `IFormFillingPort` — `AuthValidationPort` ile aynı DI disiplini.

**Teknik not:**
- Selector map **config'den** gelir, koda gömülmez.
- Adımlar: `fill → select → check → upload → submit` — her biri ayrı
  metot, her biri idempotent.
- **Dry-run modu** ile bağlantılı: gerçek submit yerine "form hazır" sinyali
  döner.
- Slot bulunduğunda form-filling hızlı çalışmalı (saniyeler içinde).

---

### 🕵️ CAPTCHA Katmanı — Detector + Solver + Injector

**Sorun:** `CapSolverAdapter` yazıldı ama `PersistentStateEngine`'e entegre
değil. `CHALLENGE_DETECTED` anomaly'si tanımlı ama hiçbir yerden emit
edilmiyor.

**Çözüm:** Üç parçalı entegrasyon.

**1. Detector (`IChallengeDetectorPort`):**
- Sayfa DOM'unu tarar: `<iframe src*="challenges.cloudflare.com">` (Turnstile),
  `<iframe src*="google.com/recaptcha">` (reCAPTCHA), `hcaptcha.com`, vb.
- Site-spesifik selector yok — jenerik iframe/attribute tarama.
- Bulguyu `CaptchaChallenge` payload'ı olarak döner (type, siteKey, pageUrl).

**2. Solver (`ICaptchaSolverPort`):**
- `CapSolverAdapter` mevcut — sadece port adaptörü yazılır.
- Çoklu sağlayıcı fallback zinciri (CapSolver → AntiCaptcha → 2Captcha)
  opsiyonel.
- Webhook desteği (polling yerine) opsiyonel — bazı sağlayıcılar destekler.

**3. Injector (`ITokenInjectorPort`):**
- Çözülen token DOM'a yazılır:
  - Turnstile: `input[name="cf-turnstile-response"]` + `dispatchEvent`
  - reCAPTCHA: `textarea[name="g-recaptcha-response"]` + callback tetikle
  - hCaptcha: `textarea[name="h-captcha-response"]` + `hcaptcha.execute()`
- Site-spesifik override edilebilir.

**Yeni action:** `GovernorAction.SOLVE_CHALLENGE` (mevcut
`ROTATE_SESSION_ONLY` bozulmaz, ikisi birlikte var olur).

**Yeni config:** `Config.ts`'e `captcha` alanı:
```ts
readonly captcha: {
  readonly enabled: boolean;
  readonly primaryProvider: 'capsolver' | 'anticaptcha' | 'twocaptcha';
  readonly fallbackChain: string[];
  readonly apiKeyEnvVar: string;
  readonly maxSolveTimeMs: number;
  readonly maxSolveCost: number;
  readonly detectOnNavigation: boolean;
  readonly detectOnDomMutation: boolean;
};
```

**API key güvenliği:** `SecretProvider` üzerinden şifreli saklanır
(proxy credential ile aynı model).

**Dikkat:** CAPTCHA çözümü mevcut context'te yapılır (yeni context'te
değil) — `createSessionWithFreshState`'in make-before-break modeline
**uymaz**. Ayrı bir "mini transaction" gerekir.

---

### 🔐 Hesap Havuzu ve Kimlik Yönetimi

**Sorun:** VFS "e-posta başına randevu limiti" uyguluyor. Tek hesapla
ölçeklenme imkânsız.

**Çözüm:** `AccountPoolManager` — hesap leasing, ban takibi, sağlık skoru.

**Teknik not:**
```ts
interface AccountPoolManager {
  acquire(): Promise<AccountLease>;
  markBanned(accountId: string, reason: string): void;
  markSuccess(accountId: string): void;
  getStats(): PoolStats;
}

interface AccountLease {
  accountId: string;
  email: string;
  password: string;
  boundProxyId?: string;
  otpProvider: string;
  expiresAt: number;
}
```

**Kritik:** Her hesabın cookie/localStorage state'i **izole** olmalı.
`PersistentStateEngine` şu an tek session yönetiyor; çoklu hesap için
`sessionId` bazlı state store gerekir.

**Cross-contamination riski:** Aynı proxy'den iki farklı hesap aynı anda
çıkarsa VFS ikisini de banlar → sticky session (hesap ↔ proxy eşleştirme)
zorunlu.

---

### 📱 OTP Handling

**Sorun:** VFS OTP zorunlu (SMS veya email). Otomasyon kırılıyor.

**Çözüm:** `IOTPProviderPort` — sağlayıcı bağımsız soyutlama.

**Sağlayıcı seçenekleri:**

| Yöntem | Maliyet | Otomasyon | VFS Kabul? |
|---|---|---|---|
| SMS-Activate / 5sim | ~$0.5/OTP | ✅ Tam | Genelde evet |
| Twilio | ~$0.01/OTP | ✅ Tam | Sanal numara reddedilebilir |
| Manuel (kullanıcı girer) | $0 | ❌ Yarı | Her zaman |
| Google Voice | Ücretsiz | ❌ | Hayır |

**Karar:** VFS'in OTP politikasına göre hibrit — sanal numara kabul
ederse tam otomatik, etmezse manuel fallback (kullanıcıya bildirim gider).

---

### 🎯 Slot Detection & Booking Orchestrator

**Sorun:** VFS slot'ları saniyeler içinde tükeniyor. Polling hızı ve
booking hızı kritik.

**Çözüm:** `GovernorAction.BOOK_SLOT` + adaptive polling.

**Adaptive polling mantığı:**
- Sabit interval = ban riski.
- Slot yoğun saatlerde (sabah 06:00-09:00 TR) daha sık,
  sakin saatlerde seyrek.
- Mevcut `AdaptiveGovernor`'ın `THROTTLE` + `Retry-After` altyapısı
  burada da kullanılır.

**XHR intercept:** `PlaywrightPageObserver` zaten response dinliyor —
slot API'sinin endpoint'ini yakalayıp doğrudan `fetch` ile sorgulama
daha hızlı olabilir.

**Booking race condition:** Slot bulundu → booking formu açılana kadar
geçen süre kritik. Form **önceden hazırlanmış** olmalı.

---

### 🧪 Dry-Run / Simülasyon Modu

**Sorun:** VFS'te gerçek randevu = gerçek commit. Test sırasında yanlışlıkla
rezervasyon yapılırsa ban riski + iptal maliyeti.

**Çözüm:** `DRY_RUN=true` env var → tüm commit adımları simüle edilir,
gerçek submit yapılmaz.

**Teknik not:**
- Adapter seviyesinde `shouldCommit()` guard'ı.
- Log'da `[DRY-RUN]` prefix'i.
- Form doldurma **gerçekten** yapılır (selector'lar test edilir), sadece
  submit butonuna basılmaz.

---

### 📢 Bildirim & Telemetri Köprüsü

**Sorun:** Motor çalışıyor ama sahibi sonucu bilmiyor.

**Çözüm:** `INotificationPort` — Telegram/Discord/email webhook.

**Kritik olaylar:**
- Slot bulundu → anlık bildirim
- Randevu başarılı → bildirim + özet
- Ban yendi → hesap havuzuna bildirim
- Proxy havuzu tükendi → alarm
- HTTP_429 tavan yaptı → alarm
- CAPTCHA çözülemedi → alarm

**Telemetry:** `EngineTelemetry` (mevcut interface) gerçek sayaçlarla
beslenir.

---

### 🛡️ Circuit Breaker & DOM Değişiklik Algılama

**Sorun:** VFS DOM yapısını değiştirdiğinde adaptör sonsuz döngüye girer
veya yanlış veri girer.

**Çözüm:**
1. **DOM hash check:** Her commit öncesi kritik element'lerin varlığını
   doğrula, yoksa `ADAPTER_STALE` anomaly'si emit et.
2. **Circuit breaker:** N ardışık adaptör hatasında o adaptör devre dışı,
   alarm gönder, yeni selector beklenir.

---

### 🧾 Denetim / Audit Trail

**Sorun:** Hangi hesap, hangi proxy, hangi slot, ne zaman — legal
savunma için gerekli.

**Çözüm:** Append-only log (SQLite veya JSON Lines).

**Alanlar:** `timestamp, accountId, proxyId, action, target, result, cost`.

---

## 🗺️ Güncellenmiş Yol Haritası (Mevcut 5 Faz + Yeni)

| Faz | Başlık | Durum |
|---|---|---|
| 1 | Çekirdek Altyapı (P0/P1/P2) | Devam |
| 2 | Hedef Keşif (Discovery) | Bekliyor |
| 3 | Adaptör Katmanı (`IResourceAdapter`) | Bekliyor |
| 4 | Slot Detection & Polling | Bekliyor |
| 5 | WAF/CAPTCHA + Commit Pipeline | Bekliyor |
| **6** | **TLS/JA3 İmza Yönetimi** | **Yeni** |
| **7** | **CAPTCHA Solver Entegrasyonu** | **Yeni** |
| **8** | **Form-Filling Port + Selector Yönetimi** | **Yeni** |
| **9** | **Hesap Havuzu + OTP Handling** | **Yeni** |
| **10** | **Dry-Run, Bildirim, Audit** | **Yeni** |

---

## ⚠️ Kritik Notlar

1. Bu maddeler **henüz taahhüt değil** — Faz 1 tamamlanınca ilgili başlıklar
   KARAR BİLDİRİMİ formatına dönüştürülüp `SESSION_INDEX.md`'ye taşınır.

2. **TLS imza yönetimi (Faz 6)** production'a çıkmadan **zorunlu** —
   Cloudflare/DataDome karşısında proxy tek başına yetmez.

3. **Hesap havuzu (Faz 9)** VFS'in "e-posta başına limit" politikası
   nedeniyle zorunlu — tek hesapla ölçeklenmez.

4. **Legal/compliance:** Audit trail sadece teknik değil, hukuki
   savunma için de gerekli.

5. **`ARCHITECTURE_ASSESSMENT.md`'ye dokunulmaz** — bu bölüm ayrı yaşar.

---

## 📦 CAPTCHA ADAPTER — Referans

> Faz 7'de `ICaptchaSolverPort` adaptörü yazılırken kullanılacak olan
> `CapSolverAdapter` implementasyonu ve test suite'i **ayrı dosya olarak**
> bu notun yanında tutulur (`GEMINI_NOTES_CAPTCHA_CODE.md`). Bu bölüm
> sadece o koda referans verir — kod buraya gömülmez (dosya boyutu +
> kopyalama kolaylığı için ayrı tutulur).
>
> **İçerik özeti:**
> - `CapSolverAdapter` (BaseCaptchaProviderAdapter'dan türer)
> - `ProductionCaptchaAdapterFactory`
> - `CaptchaSolverOptions` Zod şeması
> - `CAPTCHA_DEFAULTS` sabitleri
> - `InternalErrorCode` enum'u
> - Domain hataları: `ApiProviderError`, `ProviderCommunicationError`,
>   `TimeoutError`, `PollingTimeoutError`, `UserCancellationError`
> - Kapsamlı test suite (createTask retry, poll backoff, timeout,
>   cancellation, factory validation)
