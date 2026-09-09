// loadConfig.ts
// Amaç:    Config.ts'teki sözleşmeyi, env var'lardan (STATE_SYNC_* prefix'i,
//          STATE_SYNC_ENCRYPTION_KEY ile aynı konvansiyon — Madde #13)
//          gerçek değerlerle doldurur. Her varsayılan,
//          `src/network/AdvancedProxyManager.ts`'teki ŞU ANKİ hardcoded
//          değerle BİREBİR aynıdır — yani bu dosya henüz hiçbir yere
//          bağlanmasa bile, `loadConfig()` çağrılıp sonucu (varsayımsal
//          olarak) kullanılsaydı davranış DEĞİŞMEZDİ. Bu, Madde #27'nin
//          "config'e geçiş, sessiz bir davranış değişikliği olmamalı"
//          ilkesidir.
// Katman:  config (Madde #27)
// Risk:    Bir env var sayısal olmayan bir değerle verilirse (örn.
//          STATE_SYNC_PROXY_LEASE_DURATION_MS=abc), Kural #4 (sessiz
//          fallback yasak) gereği SESSİZCE varsayılana düşülmez — açıkça
//          throw edilir, motor hiç başlamaz. `STATE_SYNC_LOG_LEVEL`
//          tanınmayan bir değerle verilirse aynı şekilde throw eder.
// Dokunma: Bu turda `loadConfig()`'i çağıran HİÇBİR tüketici yok — bkz.
//          Config.ts başlığındaki "Dokunma" notu.

import { Config, LogLevel } from './Config';

const VALID_LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * Bir env var'ı sayısal olarak okur. Env var hiç verilmemişse `defaultValue`
 * döner (sessiz değil — bu, "belirtilmedi" durumudur, "geçersiz belirtildi"
 * durumundan farklıdır). Env var verilmiş ama sayıya çevrilemiyorsa
 * (Kural #4) throw eder.
 */
function readNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `[loadConfig] ${name} geçersiz sayısal değer: "${raw}" — motor başlatılamıyor.`
    );
  }
  return parsed;
}

function readLogLevelEnv(name: string, defaultValue: LogLevel): LogLevel {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }
  if (!VALID_LOG_LEVELS.includes(raw as LogLevel)) {
    throw new Error(
      `[loadConfig] ${name} geçersiz log seviyesi: "${raw}" — beklenen: ${VALID_LOG_LEVELS.join(
        ' | '
      )}. Motor başlatılamıyor.`
    );
  }
  return raw as LogLevel;
}

/**
 * Verilen değeri (ve tüm iç içe alanlarını, tek seviye derinlikte —
 * `Config`'in mevcut şekli en fazla 2 seviye iç içe olduğu için bu yeterli)
 * `Object.freeze()` ile runtime'da da immutable yapar. `readonly` (TS)
 * sadece derleme zamanı korur; bu, JS'e derlendikten sonra da korur.
 */
function deepFreeze<T extends object>(obj: T): Readonly<T> {
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value as unknown as object);
    }
  }
  return Object.freeze(obj);
}

export function loadConfig(): Config {
  const config: Config = {
    proxy: {
      // Kaynak: AdvancedProxyManager.ts, DEFAULT_LEASE_DURATION_MS (5 * 60 * 1000)
      leaseDurationMs: readNumberEnv('STATE_SYNC_PROXY_LEASE_DURATION_MS', 5 * 60 * 1000),
      quarantine: {
        // Kaynak: AdvancedProxyManager.ts, markFailed() HTTP_403 case'i
        http403BaseMs: readNumberEnv('STATE_SYNC_QUARANTINE_HTTP403_BASE_MS', 120000),
        http403CapMs: readNumberEnv('STATE_SYNC_QUARANTINE_HTTP403_CAP_MS', 3600000),
        // Kaynak: AdvancedProxyManager.ts, markFailed() HTTP_429 case'i
        http429BaseMs: readNumberEnv('STATE_SYNC_QUARANTINE_HTTP429_BASE_MS', 30000),
        http429CapMs: readNumberEnv('STATE_SYNC_QUARANTINE_HTTP429_CAP_MS', 600000),
        // Kaynak: AdvancedProxyManager.ts, markFailed() DNS_FAIL/TLS_FAIL/NETWORK_FAIL case'leri
        dnsFailMs: readNumberEnv('STATE_SYNC_QUARANTINE_DNS_FAIL_MS', 60000),
        tlsFailMs: readNumberEnv('STATE_SYNC_QUARANTINE_TLS_FAIL_MS', 90000),
        networkFailMs: readNumberEnv('STATE_SYNC_QUARANTINE_NETWORK_FAIL_MS', 45000),
      },
      healthScore: {
        // Kaynak: AdvancedProxyManager.ts, calculateHealthScore()
        latencyPenaltyDivisor: readNumberEnv(
          'STATE_SYNC_HEALTH_SCORE_LATENCY_PENALTY_DIVISOR',
          50
        ),
        http403Penalty: readNumberEnv('STATE_SYNC_HEALTH_SCORE_HTTP403_PENALTY', 20),
        dnsFailurePenalty: readNumberEnv('STATE_SYNC_HEALTH_SCORE_DNS_FAILURE_PENALTY', 15),
        tlsFailurePenalty: readNumberEnv('STATE_SYNC_HEALTH_SCORE_TLS_FAILURE_PENALTY', 15),
        // Kaynak: AdvancedProxyManager.ts, recordSuccess() — `latencyMs * 0.7 + latencyMs * 0.3`
        // içindeki 0.3 (yeni ölçümün ağırlığı); eski ağırlık (0.7) örtük
        // olarak `1 - emaAlpha`'dır, bkz. Config.ts.
        emaAlpha: readNumberEnv('STATE_SYNC_HEALTH_SCORE_EMA_ALPHA', 0.3),
      },
    },
    // Kaynak: Madde #15'in ertelediği takip — henüz hiçbir tüketici okumuyor.
    logLevel: readLogLevelEnv('STATE_SYNC_LOG_LEVEL', 'info'),
  };

  return deepFreeze(config);
}
