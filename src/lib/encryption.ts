// src/lib/encryption.ts
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
// 32 bytes = 64 hex chars
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

/**
 * Encrypts plaintext → “iv:ciphertext:authTag” (all hex-encoded)
 */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12); // GCM standard 12-byte nonce
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Decrypts “iv:ciphertext:authTag” → plaintext
 */
export function decrypt(payload: string): string {
  const [ivHex, dataHex, tagHex] = payload.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const ciphertext = Buffer.from(dataHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
