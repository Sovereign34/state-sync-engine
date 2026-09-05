# legacy/

Bu klasördeki dosyalar production'da kullanılmaz. `src/index.ts` yalnızca
`src/` altındaki implementasyonları import eder (bkz. ARCHITECTURE_ASSESSMENT.md #1).

Buraya taşınma gerekçesi: Root'taki eski nesil dosyalar `src/` sürümlerinden
mimari olarak farklılaşmıştı (örn. AdaptiveGovernor'ın cooldown/quarantine +
per-anomaly exponential backoff tasarımı, src/ sürümünde yok). Silinmek yerine
burada referans olarak tutuluyor — bkz. ARCHITECTURE_ASSESSMENT.md Madde #36.

Bu klasöre yeni kod eklenmez, yalnızca tarihsel referans amaçlıdır.
