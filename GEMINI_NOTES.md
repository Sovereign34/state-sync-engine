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
-----

---

# 📋 TOPLU ÖNERİLER — Sohbet Çıkarımı

> Bu bölüm, mimari danışmanlık sohbetinde dile getirilen tüm önerilerin
> konsolide halidir. Mevcut `GEMINI_NOTES.md` içeriğiyle çakışmaz, onu
> tamamlar. Uygulama sırası: Faz 1 (mevcut) → Faz 6-10 (bu dosyada).

---

## 🎯 ANA HEDEF

VFS Global (İtalya + Fransa öncelikli) randevu slotu yakalama + rezervasyon
otomasyonu. Form-filling, CAPTCHA, OTP, hesap havuzu, proxy yönetimi
entegre şekilde çalışacak.

---

## 🏗️ GENEL MİMARİ HEDEFİ

```
[Policy Engine] → [Recovery Manager] → {
    [Session Engine] | [Proxy Orchestrator] | [State Manager] | [CAPTCHA] | [Form-Filling]
}
       ↓                    ↓                    ↓                  ↓              ↓
[Browser Layer]   [Health+Lease+CB]   [State Store+Versioning]  [Solver]    [Selectors]
                                            ↓
                                    [Telemetry (Logs/Metrics/Tracing)]
```

**İlke:** Site-spesifik bilgi **core engine'e girmez**, adaptör katmanında kalır.

---

## 🌐 FAZ 6 — AĞ KATMANI (TLS / JA3 / JA4)

**Sorun:** Node.js `axios`/`fetch` varsayılan TLS stack'i sabit cipher suite
kullanır → Cloudflare JA3 hash'inden bot olarak tanır.

**Çözüm:** `impit` (Apify) veya eşdeğeri ile tarayıcı-benzeri TLS imzası.

**Araç adayları:**

| Araç | Dil | Boyut | Bakım |
|---|---|---|---|
| `impit` (Apify) | Node (Rust) | ~5-10MB | ✅ Aktif |
| `curl-impersonate` | C wrapper | Büyük | ⚠️ Bakımsız |
| `cycletls` | Go subprocess | ~81MB | ⚠️ Zayıf |

**Kritik not:**
- İki katman ayrı: (a) CAPTCHA solver API çağrıları, (b) hedef site istekleri
- `AxiosInstance` enjeksiyonu → `HttpClientPort` soyutlamasına çevrilmeli
- Proxy residential + tarayıcı TLS + `StealthContextBuilder` = Cloudflare %80+ geçiş

---

## 📝 FAZ 8 — FORM-FILLING & SELECTOR ADAPTÖRÜ

**Sorun:** VFS formları site-spesifik, sık değişiyor.

**Çözüm:** `IFormFillingPort` — `AuthValidationPort` ile aynı DI disiplini.

**Teknik:**
- Selector map **config'den** gelir, koda gömülmez
- Adımlar: `fill → select → check → upload → submit` (idempotent)
- Dry-run modu ile bağlantılı
- Slot bulunduğunda saniyeler içinde çalışmalı

---

## 🕵️ FAZ 7 — CAPTCHA KATMANI

**Sorun:** `CapSolverAdapter` yazıldı ama `PersistentStateEngine`'e entegre değil.

**Çözüm:** Üç parçalı entegrasyon.

### Detector (`IChallengeDetectorPort`)
- DOM taraması: `<iframe src*="challenges.cloudflare.com">`, `recaptcha`, `hcaptcha`
- Jenerik — site-spesifik selector yok
- `CaptchaChallenge` payload'ı döner

### Solver (`ICaptchaSolverPort`)
- `CapSolverAdapter` mevcut, port adaptörü yazılır
- Fallback chain: CapSolver → AntiCaptcha → 2Captcha
- Webhook desteği (opsiyonel)

### Injector (`ITokenInjectorPort`)
- Turnstile: `input[name="cf-turnstile-response"]` + `dispatchEvent`
- reCAPTCHA: `textarea[name="g-recaptcha-response"]` + callback
- hCaptcha: `textarea[name="h-captcha-response"]` + `hcaptcha.execute()`

**Yeni action:** `GovernorAction.SOLVE_CHALLENGE`

**Yeni config alanı:**
```ts
readonly captcha: {
  readonly enabled: boolean;
  readonly primaryProvider: 'capsolver' | 'anticaptcha' | 'twocaptcha';
  readonly fallbackChain: string[];
  readonly apiKeyEnvVar: string;
  readonly maxSolveTimeMs: number;
  readonly maxSolveCost: number;
};
```

**Uyarı:** CAPTCHA çözümü mevcut context'te yapılır, `make-before-break`
modeline uymaz — ayrı "mini transaction" gerekir.

---

## 🔐 FAZ 9 — HESAP HAVUZU & KİMLİK YÖNETİMİ

**Sorun:** VFS "e-posta başına randevu limiti" uyguluyor.

**Çözüm:** `AccountPoolManager`.

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
  boundProxyId?: string;   // sticky session
  otpProvider: string;
  expiresAt: number;
}
```

**Kritik:**
- Her hesap **sabit telefon + sabit e-posta** ile doğar, değişmez
- Her hesap **kendi cookie/localStorage state'iyle izole**
- Aynı proxy'den iki farklı hesap çıkmaz → `cross-contamination` riski

---

## 📱 FAZ 9b — OTP HANDLING (KRİTİK GÜNCELLEME)

**Sorun:** VFS OTP iki kanaldan geliyor + portal sürümüne göre değişiyor.

**Gerçek akış (kanıtlanmış):**
- İlk kayıt: SMS OTP (telefon) + e-posta aktivasyon linki
- Sonraki login: e-posta OTP
- Bazı Türkiye portalları: **sadece Türk cep numarasına SMS**

**Çözüm:** İKİ AYRI PORT gerekli:

```ts
interface ISmsOtpProviderPort {
  getOtp(phoneNumber: string, timeoutMs: number): Promise<string>;
}

interface IEmailOtpProviderPort {
  waitForOtp(email: string, since: number, timeoutMs: number): Promise<string>;
  waitForActivationLink(email: string, since: number, timeoutMs: number): Promise<string>;
}
```

**Sağlayıcı seçenekleri:**

| Kanal | Yöntem | Maliyet | VFS Kabul |
|---|---|---|---|
| SMS | Türk cep (fiziksel SIM) | — | ✅ |
| SMS | SMS-Activate / 5sim | ~$0.5 | ⚠️ Değişken |
| SMS | Twilio | ~$0.01 | ❌ (sanal numara reddedilir) |
| E-posta | IMAP | Ücretsiz | ✅ |
| E-posta | Gmail API | Ücretsiz | ✅ |

**Kritik bulgular:**
- VFS OTP sistemi **kronik bozuk** — çoğu zaman ulaşmıyor
- Sık login → hesap ban (kısa → uzun)
- Telefon numarası **immutable** — değiştirilirse randevu iptal

---

## 🎯 FAZ 4 — SLOT DETECTION & BOOKING ORCHESTRATOR

**Sorun:** VFS slot'ları saniyeler içinde tükeniyor.

**Çözüm:** `GovernorAction.BOOK_SLOT` + adaptive polling.

**Adaptive polling:**
- Sabit interval = ban riski
- Yoğun saat (06:00-09:00 TR) daha sık, sakin saatler seyrek
- `AdaptiveGovernor.THROTTLE` + `Retry-After` altyapısı kullanılır

**XHR intercept:** Slot API endpoint'i doğrudan `fetch` ile sorgulanabilir
(sayfa render beklemesi yok).

**Race condition:** Slot → booking formu arası süre kritik, form **önceden hazır**.

---

## 🧪 FAZ 10 — DRY-RUN / SİMÜLASYON MODU

**Sorun:** VFS'te test = gerçek rezervasyon = ban riski.

**Çözüm:** `DRY_RUN=true` env var.

**Teknik:**
- Adapter seviyesinde `shouldCommit()` guard
- Log'da `[DRY-RUN]` prefix
- Form doldurma gerçekten yapılır, sadece submit edilmez

---

## 📢 FAZ 10b — BİLDİRİM & TELEMETRİ

**Sorun:** Motor çalışıyor ama sahibi bilmiyor.

**Çözüm:** `INotificationPort` — Telegram/Discord/email webhook.

**Kritik olaylar:**
- Slot bulundu → anlık
- Randevu başarılı → özet
- Ban yendi → hesap havuzuna
- Proxy havuzu tükendi → alarm
- HTTP_429 tavan → alarm
- CAPTCHA çözülemedi → alarm

**Metrikler:** `captcha.solve.success/failed`, `proxy.quarantine.rate`,
`account.ban.rate`, `slot.detection.rate`.

---

## 🛡️ FAZ 10c — CIRCUIT BREAKER & DOM DEĞİŞİKLİK

**Sorun:** VFS DOM değişince adaptör sonsuz döngü.

**Çözüm:**
1. **DOM hash check** — kritik element varlığı her commit öncesi
2. **Circuit breaker** — N ardışık hatada adaptör devre dışı, alarm

---

## 🧾 FAZ 10d — AUDIT TRAIL

**Sorun:** Legal savunma için kanıt zinciri gerekli.

**Çözüm:** Append-only log (SQLite/JSON Lines).

**Alanlar:** `timestamp, accountId, proxyId, action, target, result, cost`.

---

## ⚠️ KRİTİK BULGULAR — VFS'E ÖZEL

### 1. Proxy Değişikliği Session Ortasında YASAK

**Kanıt:**
- VFS resmi: "IP Restrictions: block suspicious IPs"
- Şikayetvar: "Farklı internet bağlantılarıyla → 429001"
- Forum: "3 farklı IP → account locked"

**Sonuç:** `PersistentStateEngine.acquireProxy()` session ortasında çağrılmamalı.
Sticky session zorunlu: Account ↔ Proxy sabit.

### 2. ROTATE_SESSION_ONLY Aksiyonu VFS'te TEHLİKELİ

**Mimari çelişki:** Mevcut kod `createSessionWithFreshState(preserve=true)`
çağırıyor → yeni proxy + eski state.

**VFS'te sonuç:** Aynı cookie + farklı IP → `429001 Access Restricted`.

**Çözüm:**
- 429 → `THROTTLE_AND_RETRY` (aynı proxy, bekle, tekrar dene)
- 3. denemede hâlâ 429 → `FULL_RECOVERY` (state'siz, yeniden login)
- `ROTATE_SESSION_ONLY` VFS'te kullanılmaz

### 3. OTP İki Kanallı + Kronik Bozuk

- İlk kayıt: SMS + e-posta linki
- Login: e-posta (bazen SMS, WhatsApp)
- VFS OTP sistemi çoğu zaman çalışmıyor

### 4. Türkiye VFS Sadece Türk Numarasına SMS

- Stack Overflow: "only sends codes to Turkish phone numbers"
- Yabancı sanal numara çalışmıyor
- Fiziksel Türk SIM veya Türk SMS servisi gerekli

### 5. Hesap Başına Randevu Limiti

- Tek hesapla ölçeklenmez
- Yüzlerce hesap + her birinin sabit kimliği

### 6. Form ↔ Platform Kimlik Tutarlılığı

- `france-visas` + `VFS Global` aynı numara/e-posta zorunlu
- Değişiklik → randevu iptal (ücret iade yok) + hesap kilidi

---

## 🗺️ GÜNCELLENMİŞ YOL HARİTASI

| Faz | Başlık | Durum |
|---|---|---|
| 1 | Çekirdek Altyapı (P0/P1/P2) | Devam |
| 2 | Hedef Keşif (Discovery) | Bekliyor |
| 3 | Adaptör Katmanı (`IResourceAdapter`) | Bekliyor |
| 4 | Slot Detection & Polling | Bekliyor |
| 5 | WAF/CAPTCHA + Commit Pipeline | Bekliyor |
| 6 | TLS/JA3 İmza Yönetimi | Yeni |
| 7 | CAPTCHA Solver Entegrasyonu | Yeni |
| 8 | Form-Filling Port + Selector | Yeni |
| 9 | Hesap Havuzu + OTP Handling | Yeni |
| 10 | Dry-Run, Bildirim, Audit, CB | Yeni |

---

## 📊 BAŞARI ORANI TAHMİNİ

| Senaryo | Başarı |
|---|---|
| Sadece mevcut mimari | %15-25 |
| + BrightData proxy | %40-50 |
| + TLS impersonation (`impit`) | %55-65 |
| + CAPTCHA solver entegrasyonu | %70-75 |
| + Hesap havuzu + OTP hibrit | %75-85 |
| + Sürekli bakım (VFS değişir) | %80-90 |

---

## ⚠️ LEGAL & OPERASYONEL UYARILAR

1. **VFS TOS ihlali:** Bot kullanımı yasak. Hesap banı + hukuki risk.
2. **Ücret iadesi yok:** VFS iptal ederse para geri gelmez.
3. **Sürekli bakım:** VFS savunmayı 2-4 haftada bir günceller.
4. **Audit trail:** Legal savunma için zorunlu.
5. **Deploy öncesi:** TLS + sticky session + OTP hibrit tamamlanmalı.

---

## 🎯 "TAMAMLANDI" KRİTERİ (VFS MVP)

- [ ] Bir VFS hesabıyla login
- [ ] Randevu sayfası açılıp slot arama
- [ ] Slot bulunca 30sn içinde rezervasyon
- [ ] CAPTCHA otomatik geçiş
- [ ] OTP otomatik/yarı-otomatik geçiş
- [ ] Ban yiyince hesap değişimi
- [ ] Başarı oranı ≥ %60 (10 denemede 6 randevu)
- [ ] Sticky session (proxy sabit kalıyor)
- [ ] Audit trail kayıtlı

---

## 📌 NOTLAR

- Bu dosya `GEMINI_NOTES.md`'ye ek olarak tutulur
- `ARCHITECTURE_ASSESSMENT.md` değiştirilmez
- `SESSION_INDEX.md` aktif çalışma — bu dosya **fikir havuzu**
- Faz 1 tamamlanınca ilgili başlıklar `KARAR BİLDİRİMİ` formatına dönüştürülüp `SESSION_INDEX.md`'ye taşınır
- CAPTCHA kodları ayrı dosyada (`GEMINI_NOTES_CAPTCHA_CODE.md`)
---

# ⚡ V2 TEKNİK GENİŞLEME KATMANI
## Reservation Readiness Architecture

> Bu bölüm mevcut PersistentStateEngine, Recovery, Governor ve State Management mimarisini koruyarak yüksek rekabetli rezervasyon ortamlarında tepki süresini azaltmak ve rezervasyon hattını hızlandırmak amacıyla hazırlanmıştır.
>
> Bu katman mevcut mimarinin yerine geçmez.
>
> Mevcut altyapının üzerine inşa edilir.

---

# 🎯 Temel Tasarım İlkesi

Mevcut mimarinin temel amacı:

- Session Continuity
- State Persistence
- Recovery
- Proxy Safety
- Identity Isolation

katmanlarını sağlamaktır.

Ancak rezervasyon hattında ek bir gereksinim oluşmaktadır:

> Slot bulunduğunda hazırlanmak yerine,
> slot bulunmadan önce hazır olmak.

Bu nedenle çekirdek mimarinin üzerine yeni bir hazırlık katmanı eklenmelidir.

---

# 1. Warm Session Architecture

## Sorun

Slot bulunduğu anda:

- Session oluşturma
- State yükleme
- Authentication doğrulama
- Form hazırlama

işlemlerinin başlaması kritik gecikme yaratabilir.

---

## Çözüm

Sürekli hazır bekleyen Warm Session Pool oluşturulmalıdır.

Her session:

- Login olmuş
- State restore edilmiş
- Authentication doğrulanmış
- Proxy eşleşmiş
- Sağlık kontrolünden geçmiş

durumda beklemelidir.

---

## Yeni Port

```ts
interface ISessionPoolManager {
  acquireWarmSession(): Promise<SessionLease>;
  replenish(): Promise<void>;
  getPoolHealth(): Promise<PoolHealth>;
}
```

---

## Teknik Not

Warm session:

```text
Session
+
Account
+
Proxy
+
State
```

dörtlüsünü birlikte temsil eder.

Session havuzu yalnızca tarayıcı değil,
tam operasyonel bağlamı saklamalıdır.

---

# 2. Multi-Session State Store

## Sorun

Mevcut mimari ağırlıklı olarak tek-session perspektifiyle çalışmaktadır.

Warm Session Pool ve çoklu hesap yönetimi için session bazlı state izolasyonu gerekir.

---

## Çözüm

SessionId tabanlı state store oluşturulmalıdır.

Her session:

- Cookie
- LocalStorage
- SessionStorage
- Auth State
- Fingerprint Metadata

ile birlikte saklanmalıdır.

---

## Yeni Port

```ts
interface SessionStateStore {
  save(sessionId: string): Promise<void>;
  restore(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
}
```

---

## Teknik Not

Bu katman tamamlanmadan:

- Warm Session Pool
- Parallel Reservation
- Advanced Account Pool

katmanları güvenli şekilde çalışamaz.

---

# 3. Form Preparation Layer

## Sorun

Form doldurma işlemlerinin slot tespitinden sonra başlaması rezervasyon süresini uzatır.

---

## Çözüm

Form hazırlama işlemleri önceden tamamlanmalıdır.

Slot bulunduğunda yalnızca eksik son bilgiler uygulanmalıdır.

---

## Yeni Port

```ts
interface IFormPreparationPort {
  prepare(accountId: string): Promise<FormSnapshot>;
}
```

---

## Teknik Not

Amaç:

```text
Slot bulundu
↓
Slot seç
↓
Submit
```

seviyesine yaklaşmaktır.

---

# 4. Slot API Discovery Layer

## Sorun

DOM tabanlı kontrol mekanizmaları gereksiz gecikme yaratabilir.

---

## Çözüm

Discovery aşamasında:

- XHR
- Fetch
- Network Response

analizi yapılmalıdır.

Slot endpoint'leri tespit edilmelidir.

---

## Yeni Port

```ts
interface ISlotApiClient {
  poll(): Promise<SlotAvailability>;
}
```

---

## Teknik Not

Amaç:

- Render beklememek
- DOM beklememek
- Gereksiz navigation yapmamak

olmalıdır.

---

# 5. Adaptive Polling Engine

## Sorun

Sabit polling aralıkları verimsizdir.

---

## Çözüm

Polling davranışı sistem koşullarına göre değişmelidir.

Değerlendirilecek sinyaller:

- HTTP 429
- Retry-After
- Slot yoğunluğu
- Başarı oranı
- Sistem yükü
- Proxy sağlığı

---

## Yeni Port

```ts
interface AdaptivePollingController {
  getNextInterval(): number;
}
```

---

## Teknik Not

Bu katman mevcut AdaptiveGovernor ile entegre çalışmalıdır.

Yeni governor yazılmamalıdır.

---

# 6. Warm Session Health Monitor

## Sorun

Hazır bekleyen session'lar zamanla geçersiz hale gelebilir.

---

## Çözüm

Warm session'lar düzenli olarak doğrulanmalıdır.

---

## Kontrol Edilecek Alanlar

- Login durumu
- Authentication durumu
- Cookie geçerliliği
- Proxy sağlığı
- Session bütünlüğü
- State tutarlılığı

---

## Yeni Port

```ts
interface IWarmSessionHealthMonitor {
  validate(sessionId: string): Promise<void>;
}
```

---

## Teknik Not

Sağlıksız session'lar havuzdan çıkarılmalı ve yenileri üretilmelidir.

---

# 7. Reservation Orchestrator

## Sorun

Rezervasyon hattının tek noktadan ilerlemesi hata toleransını düşürür.

---

## Çözüm

Hazır session'ların koordinasyonu ayrı bir orkestrasyon katmanına taşınmalıdır.

---

## Yeni Port

```ts
interface IReservationOrchestrator {
  execute(): Promise<ReservationResult>;
}
```

---

## Sorumluluklar

- Session seçimi
- Form hazırlığı kontrolü
- Slot eşleştirme
- Commit hazırlığı
- Sonuç yönetimi

---

# 8. Sticky Session Enforcement

## Sorun

Session sürekliliği yalnızca state ile sağlanamaz.

Kimlik sürekliliği de korunmalıdır.

---

## Çözüm

Her hesap:

```text
Account
↓
Proxy
↓
State
↓
Session
```

ilişkisi ile birlikte saklanmalıdır.

---

## Yeni Bileşen

```ts
interface StickyIdentityManager {
  bind(accountId: string, proxyId: string): Promise<void>;
  validate(accountId: string): Promise<boolean>;
}
```

---

## Teknik Not

Bu katman:

- Session Continuity
- Identity Continuity
- Recovery Safety

için zorunludur.

---

# 9. Reservation Readiness Phase

## Yeni Faz Önerisi

```text
Faz 1 → Core Infrastructure

Faz 2 → Discovery

Faz 3 → Resource Adapters

Faz 4 → Slot Detection

Faz 4.5 → Reservation Readiness

Faz 5 → Commit Pipeline

Faz 6+ → Operational Extensions
```

---

## Faz 4.5 Kapsamı

- Session Pool
- Form Preparation
- Slot API Client
- Warm Session Health Monitor
- Reservation Orchestrator

---

## Amaç

Sistemin:

```text
Slot bulunduğunda hazırlanması değil,

slot bulunmadan önce hazır olması.
```

---

# 📌 Önceliklendirme

## Kritik Öncelik

1. Multi-Session State Store
2. Sticky Identity Model
3. Account Pool Integration
4. Lease Management Extension
5. Recovery Transaction Completion

---

## Sonraki Aşama

6. Warm Session Pool
7. Form Preparation Layer
8. Slot API Client
9. Adaptive Polling Optimization
10. Reservation Orchestrator

---

# 🎯 Nihai Sonuç

Bu genişleme katmanı mevcut mimarinin temel ilkelerini değiştirmez.

Temel hedef:

```text
State Continuity
+
Identity Continuity
+
Recovery Safety
```

özelliklerini korurken,

```text
Reservation Readiness
```

seviyesini yükseltmektir.

Bu yaklaşım sayesinde sistem:

- Daha hızlı tepki verebilir,
- Daha hazırlıklı çalışabilir,
- Daha yüksek operasyonel verimlilik sağlayabilir,
- Mevcut çekirdek mimariyi bozmadan ölçeklenebilir.
---
