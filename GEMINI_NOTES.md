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
