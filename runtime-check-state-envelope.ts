// runtime-check-state-envelope.ts
// Amaç:    src/types/state-envelope.types.ts'teki StateEnvelope<T> sözleşmesinin
//          (CURRENT_STATE_VERSION, UnknownStateVersionError dahil) gerçekten
//          derlenen ve beklenen şekilde davranan bir kontrat olduğunu, hiçbir
//          production tüketicisi olmadan izole şekilde doğrular (Madde #12,
//          ilk slice).
// Katman:  verification (repo kökü — diğer runtime-check-*.ts dosyalarıyla
//          aynı konvansiyon; production entrypoint DEĞİL, src/ altına girmez,
//          AGENT.md Kural #8'in bir istisnası değil çünkü src/'i çoğaltmıyor).
// Risk:    Bu script yanlış "PASS" basarsa, StateEnvelope sözleşmesi ileride
//          gerçek persistence (Madde #2 deseni #10/#11'e uygulandığında)
//          yanlış varsayımlarla wiring edilir.
// Dokunma: src/types/state-envelope.types.ts, src/types/index.ts (re-export
//          zinciri kırılırsa bu script'in importu hiç derlenmez).
// AÇIK VARSAYIM: import yolu (`./src/types`) diğer runtime-check-*.ts
//          dosyalarının GERÇEK konumu/derinliği görülmeden yazıldı (Kural #1
//          notu) — Codespace'te farklıysa düzeltilmesi gerekebilir, script
//          mantığı bundan etkilenmez.

import {
  StateEnvelope,
  CURRENT_STATE_VERSION,
  UnknownStateVersionError,
} from './src/types';
import type { PreservedSessionState } from './src/types';

type TestResult = { name: string; pass: boolean; detail?: string };

const results: TestResult[] = [];

function check(name: string, fn: () => boolean): void {
  try {
    const outcome = fn();
    results.push({ name, pass: outcome === true });
  } catch (err) {
    results.push({
      name,
      pass: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

// 1) CURRENT_STATE_VERSION sayısal ve beklenen ilk değer mi?
check('CURRENT_STATE_VERSION sayısal ve 1', () => {
  return typeof CURRENT_STATE_VERSION === 'number' && CURRENT_STATE_VERSION === 1;
});

// 2) StateEnvelope<PreservedSessionState> gerçek bir PreservedSessionState ile
//    eksiksiz doldurulabiliyor mu (alan eksik/fazlaysa derleme zaten patlar —
//    bu adım hem compile-time hem runtime şeklini birlikte doğrular).
const sampleState: PreservedSessionState = {
  cookies: [
    {
      name: 'session_id',
      value: 'abc123',
      domain: '.example.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 3600,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ],
  localStorage: { theme: 'dark' },
  sessionStorage: {},
};

const envelope: StateEnvelope<PreservedSessionState> = {
  version: CURRENT_STATE_VERSION,
  capturedAt: Date.now(),
  state: sampleState,
};

check('StateEnvelope alanları eksiksiz atanabiliyor', () => {
  return (
    envelope.version === CURRENT_STATE_VERSION &&
    typeof envelope.capturedAt === 'number' &&
    envelope.state.cookies.length === 1
  );
});

// 3) JSON round-trip — ileride disk/DB'ye yazılırsa muhtemelen JSON string
//    olacak; serialize/deserialize sonrası veri bozulmamalı.
check('JSON round-trip veri kaybı yok', () => {
  const serialized = JSON.stringify(envelope);
  const parsed = JSON.parse(serialized) as StateEnvelope<PreservedSessionState>;
  return (
    parsed.version === envelope.version &&
    parsed.state.cookies[0].name === 'session_id' &&
    parsed.state.localStorage.theme === 'dark'
  );
});

// 4) UnknownStateVersionError doğru şekilde Error zincirine bağlanıyor mu?
check('UnknownStateVersionError instanceof Error', () => {
  const err = new UnknownStateVersionError(99);
  return err instanceof Error && err.name === 'UnknownStateVersionError';
});

// 5) UnknownStateVersionError mesajı hem karşılaşılan hem bilinen version'ı
//    içeriyor mu (throw edildiğinde debug edilebilir olmalı — Kural #4
//    sessiz fallback yasağının bir parçası).
check('UnknownStateVersionError mesajı bilgilendirici', () => {
  const err = new UnknownStateVersionError(99);
  return (
    err.message.includes('99') &&
    err.message.includes(String(CURRENT_STATE_VERSION)) &&
    err.encounteredVersion === 99
  );
});

const passCount = results.filter((r) => r.pass).length;
console.log(`\n[runtime-check-state-envelope] ${passCount}/${results.length} TEST GRUBU PASS\n`);
for (const r of results) {
  console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}

if (passCount !== results.length) {
  process.exitCode = 1;
}
