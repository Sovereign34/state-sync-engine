// runtime-check-madde23.ts
// Amaç:    Madde #23'ün runtime doğrulaması. tsc --noEmit statik olarak
//          "doğru görünüyor" dedi ama AGENT.md'nin dersi gereği bu tek başına
//          yeterli değil — bu script, gerçek AdvancedProxyManager sınıfını
//          (mock değil) çalıştırıp credential izolasyonunu DEĞER seviyesinde
//          doğrular.
// Katman:  network/security (test)
// Risk:    Bu sadece bir doğrulama betiği; production kodunu etkilemez.
//          Yanlış geçerse (false positive) Madde #23 olduğundan daha kapalı
//          görünebilir — bu yüzden aşağıda hem "yok" hem "var" yönünü
//          (getAllMetrics vs getProxyMetrics) ayrı ayrı test ediyoruz.
// Dokunma: AdvancedProxyManager.ts (registerProxy/getAllMetrics/getProxyMetrics)

// AÇIK VARSAYIM: Import yolu `./src/network/AdvancedProxyManager` olarak
// varsayıldı (dosya başlığındaki "Katman: network" notuna göre). Gerçek
// klasör yapısı farklıysa (örn. src/proxy/... ) bu satırı düzeltip tekrar
// çalıştırman yeterli — script mantığının geri kalanı değişmez.
import { AdvancedProxyManager } from './src/network/AdvancedProxyManager';

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failures++;
    console.error(`❌ BAŞARISIZ: ${message}`);
  } else {
    console.log(`✅ ${message}`);
  }
}

const manager = new AdvancedProxyManager();
manager.registerProxy('proxy1.example.com:8080', 'testuser', 'testpass123');
manager.registerProxy('proxy2.example.com:8080', 'testuser2', 'testpass456');

console.log('\n--- Test 1: getAllMetrics() credential SIZDIRMAMALI (Madde #23 asıl konusu) ---');
const allMetrics = manager.getAllMetrics();

assert(allMetrics.length === 2, 'getAllMetrics() 2 proxy döndü');

for (const m of allMetrics) {
  assert(!('username' in m), `getAllMetrics()[${m.server}]: 'username' alanı objede YOK`);
  assert(!('password' in m), `getAllMetrics()[${m.server}]: 'password' alanı objede YOK`);
}

// 'in' operatörü teorik olarak yanıltabileceği için (örn. alan undefined ama
// yine de tanımlıysa) serialize edilmiş çıktıda ham credential string'inin
// hiçbir şekilde yer almadığını da ayrıca doğruluyoruz.
const serialized = JSON.stringify(allMetrics);
assert(!serialized.includes('testuser'), "Serialize edilmiş getAllMetrics() çıktısında 'testuser' string'i YOK");
assert(!serialized.includes('testpass'), "Serialize edilmiş getAllMetrics() çıktısında 'testpass' string'i YOK");

console.log('\n--- Test 2: getProxyMetrics() credential\'lı DÖNMEYE DEVAM ETMELİ (regresyon fix\'i, İÇ KULLANIM) ---');
const single = manager.getProxyMetrics('proxy1.example.com:8080');
assert(single !== undefined, 'getProxyMetrics() proxy1 için bir sonuç döndü');
assert(single?.username === 'testuser', "getProxyMetrics() 'username' alanını İÇERİYOR (motorun gerçek proxy bağlantısı için bu gerekli)");
assert(single?.password === 'testpass123', "getProxyMetrics() 'password' alanını İÇERİYOR (motorun gerçek proxy bağlantısı için bu gerekli)");

console.log('\n--- Test 3: getAllMetrics() bir KOPYA dönmeli (referans değil) ---');
const beforeMutation = manager.getProxyMetrics('proxy1.example.com:8080')?.latencyMs;
(allMetrics[0] as { latencyMs: number }).latencyMs = 999999;
const afterMutation = manager.getProxyMetrics('proxy1.example.com:8080')?.latencyMs;
assert(
  beforeMutation === afterMutation,
  "getAllMetrics() çıktısını dışarıdan mutasyona uğratmak sınıfın iç state'ini ETKİLEMİYOR (kopya doğrulandı)"
);

console.log(failures === 0 ? '\n✅ Tüm testler geçti' : `\n❌ ${failures} test başarısız oldu`);
process.exitCode = failures === 0 ? 0 : 1;
