// SecretProvider.ts
// Amaç:    STATE_SYNC_ENCRYPTION_KEY ortam değişkeninden okunan anahtarla
//          AES-256-GCM kullanarak string verileri şifreler/deşifre eder.
// Katman:  security
// Risk:    STATE_SYNC_ENCRYPTION_KEY kaybolur, değişir veya rotasyona
//          uğrarsa, bu anahtarla şifrelenmiş TÜM proxy credential kayıtları
//          kalıcı olarak deşifre edilemez hale gelir (bkz. ProxyCredentialStore
//          fail-closed davranışı). Yanlış boyutta/formatta bir key sessizce
//          kabul edilirse şifreleme zayıflar veya çalışma zamanında beklenmedik
//          şekilde patlar — bu yüzden constructor'da fail-fast zorunludur.
// Dokunma: Bu dosyanın ürettiği payload formatı (`iv.authTag.ciphertext`,
//          hepsi base64) ProxyCredentialStore.ts tarafından birebir aynı
//          şekilde parse edilir. Format değişirse ProxyCredentialStore.ts'in
//          decrypt çağrıları da güncellenmeli, aksi halde eski kayıtlar
//          okunamaz hale gelir (migration gerekir).

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32; // AES-256 için zorunlu
const IV_LENGTH_BYTES = 12; // GCM için önerilen (NIST) IV uzunluğu

/**
 * STATE_SYNC_ENCRYPTION_KEY ortam değişkenini okur, doğrular ve
 * encrypt/decrypt fonksiyonlarını sağlar.
 *
 * Fail-fast sözleşmesi (Kararlaştırılan edge-case #1 — sessiz fallback yasak):
 *   - Env var tanımlı değilse            → constructor throw eder, motor başlamaz.
 *   - Env var geçerli base64 değilse     → constructor throw eder.
 *   - Decode edilen key 32 byte değilse  → constructor throw eder.
 * Bu sınıf ASLA varsayılan/sabit bir key'e sessizce geri düşmez.
 */
export class SecretProvider {
  private readonly key: Buffer;

  constructor(envVarValue: string | undefined = process.env.STATE_SYNC_ENCRYPTION_KEY) {
    if (!envVarValue || envVarValue.trim().length === 0) {
      throw new Error(
        '[SecretProvider] STATE_SYNC_ENCRYPTION_KEY tanımlı değil. ' +
          'Motor credential şifreleme olmadan başlatılamaz (Madde #13, fail-fast). ' +
          'Örnek üretim: `openssl rand -base64 32`'
      );
    }

    let decoded: Buffer;
    try {
      decoded = Buffer.from(envVarValue, 'base64');
    } catch {
      throw new Error('[SecretProvider] STATE_SYNC_ENCRYPTION_KEY geçerli bir base64 string değil.');
    }

    if (decoded.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `[SecretProvider] STATE_SYNC_ENCRYPTION_KEY ${KEY_LENGTH_BYTES} byte olmalı ` +
          `(base64 decode sonrası), ancak ${decoded.length} byte geldi. ` +
          'Örnek üretim: `openssl rand -base64 32`'
      );
    }

    this.key = decoded;
  }

  /**
   * Düz metni şifreler. Her çağrıda rastgele bir IV üretilir (aynı plaintext
   * her seferinde farklı ciphertext üretir — bu kasıtlıdır, IV asla sabit
   * tutulmamalı).
   * Dönen format: "<ivBase64>.<authTagBase64>.<ciphertextBase64>"
   */
  public encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
  }

  /**
   * encrypt() tarafından üretilmiş bir payload'ı deşifre eder.
   * Yanlış key, bozulmuş payload veya format uyuşmazlığında throw eder
   * (fail-closed — ProxyCredentialStore.loadAll() bu hatayı yutmaz,
   * kararlaştırılan edge-case #3 gereği tüm başlatmayı durdurur).
   */
  public decrypt(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 3) {
      throw new Error('[SecretProvider] Bozuk şifreli payload formatı (beklenen: iv.authTag.ciphertext).');
    }

    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    // Yanlış key veya bozuk veri burada throw eder (GCM auth tag doğrulaması) —
    // bilinçli olarak try/catch ile yutulmuyor, çağıran taraf (ProxyCredentialStore)
    // bunu fail-closed olarak ele alacak.
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
