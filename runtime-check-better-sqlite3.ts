// runtime-check-better-sqlite3.ts
// Amaç:    better-sqlite3 native binding'inin bu ortamda gerçekten yüklenip
//          çalıştığını doğrulayan izole smoke-test (Madde #37).
// Katman:  governance (repo kökü — production kodu DEĞİL, src/ dışında kasıtlı)
// Risk:    Bu script yanlış "başarılı" dönerse, better-sqlite3 CI/deploy
//          ortamında sessizce kırılabilir ve bu ancak production'da fark edilir.
// Dokunma: Bu dosya hiçbir interface sözleşmesine (IResourceAdapter vb.) bağlı
//          değil — production koduna import edilmemeli, sadece manuel/CI
//          smoke-test amaçlı çalıştırılır.
//
// Çalıştırma: npx ts-node runtime-check-better-sqlite3.ts
// (package.json'da "scripts" alanı henüz yok — Madde #37'nin ayrı bir
//  bloker'ı, bu dosyaya kasıtlı olarak dahil edilmedi.)

import Database from 'better-sqlite3';

interface CheckResult {
  step: string;
  ok: boolean;
  detail?: string;
}

function structuredLog(level: 'info' | 'error', event: string, data: Record<string, unknown>): void {
  // Kural #4: düz console.log/warn/error yasak — structured JSON log zorunlu.
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  });
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function runSmokeTest(): CheckResult[] {
  const results: CheckResult[] = [];
  let db: Database.Database | undefined;

  try {
    db = new Database(':memory:');
    results.push({ step: 'open_in_memory_db', ok: true });
  } catch (err) {
    results.push({
      step: 'open_in_memory_db',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    return results;
  }

  try {
    db.exec('CREATE TABLE smoke_test (id INTEGER PRIMARY KEY, label TEXT NOT NULL)');
    results.push({ step: 'create_table', ok: true });
  } catch (err) {
    results.push({
      step: 'create_table',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    db.close();
    return results;
  }

  try {
    const insert = db.prepare('INSERT INTO smoke_test (label) VALUES (?)');
    insert.run('native-binding-check');
    results.push({ step: 'insert_row', ok: true });
  } catch (err) {
    results.push({
      step: 'insert_row',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
    db.close();
    return results;
  }

  try {
    const row = db
      .prepare('SELECT id, label FROM smoke_test WHERE label = ?')
      .get('native-binding-check') as { id: number; label: string } | undefined;

    if (row && row.label === 'native-binding-check') {
      results.push({ step: 'select_row', ok: true, detail: `id=${row.id}` });
    } else {
      results.push({ step: 'select_row', ok: false, detail: 'row not found or mismatched' });
    }
  } catch (err) {
    results.push({
      step: 'select_row',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    db.close();
    results.push({ step: 'close_db', ok: true });
  } catch (err) {
    results.push({
      step: 'close_db',
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return results;
}

function main(): void {
  structuredLog('info', 'runtime_check_started', { target: 'better-sqlite3' });

  const results = runSmokeTest();
  const allOk = results.every((r) => r.ok);

  for (const r of results) {
    structuredLog(r.ok ? 'info' : 'error', 'runtime_check_step', {
      step: r.step,
      ok: r.ok,
      detail: r.detail ?? null,
    });
  }

  structuredLog(allOk ? 'info' : 'error', 'runtime_check_finished', {
    target: 'better-sqlite3',
    allOk,
    stepCount: results.length,
  });

  // Madde #25 turunda çıkan ders: catch bloğu loglamak exit code'u belirlemez.
  // process.exitCode açıkça set edilmezse Node varsayılan 0 ile çıkabilir.
  process.exitCode = allOk ? 0 : 1;
}

main();
