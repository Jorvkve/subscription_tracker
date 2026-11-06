import { createDecipheriv, createCipheriv, hkdfSync, randomBytes } from "node:crypto";

const INFO = "subtrack-token-v1";
const ALGORITHM = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(secret: string): Buffer {
  const keyMaterial = Buffer.from(secret, "utf8");
  // HKDF-SHA256: salt = zero bytes of hash length (32)
  const derived = hkdfSync("sha256", keyMaterial, Buffer.alloc(32), INFO, KEY_LEN);
  return Buffer.from(derived);
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns a base64 string: iv (12 bytes) + tag (16 bytes) + ciphertext.
 */
export function encryptToken(plain: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store: iv | tag | ciphertext
  const combined = Buffer.concat([iv, tag, ciphertext]);
  return combined.toString("base64");
}

/**
 * Decrypt a stored token encrypted by encryptToken.
 * Throws if the data is tampered or the secret is wrong.
 */
export function decryptToken(stored: string, secret: string): string {
  const key = deriveKey(secret);
  let combined: Buffer;
  try {
    combined = Buffer.from(stored, "base64");
  } catch {
    throw new Error("Invalid token data");
  }
  if (combined.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("Invalid token data: too short");
  }
  const iv = combined.subarray(0, IV_LEN);
  const tag = combined.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = combined.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  try {
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    throw new Error("Token decryption failed: data may be tampered or secret is wrong");
  }
}
