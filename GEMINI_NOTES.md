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
