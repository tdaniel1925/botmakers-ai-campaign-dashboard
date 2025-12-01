import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment or generate a derived key
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET;

  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is required for API key encryption");
  }

  // If the secret is exactly 32 bytes (64 hex chars), use it directly
  if (secret.length === 64 && /^[0-9a-fA-F]+$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }

  // Otherwise, derive a key from the secret using PBKDF2 with a fixed salt
  // The salt is fixed so we can decrypt data encrypted with the same secret
  const fixedSalt = crypto.createHash("sha256").update("botmakers-api-keys-salt").digest();
  return crypto.pbkdf2Sync(secret, fixedSalt, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Encrypt sensitive data (like API keys)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all in hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Encrypt an object (converts to JSON, then encrypts)
 */
export function encryptObject<T>(obj: T): string {
  const json = JSON.stringify(obj);
  return encrypt(json);
}

/**
 * Decrypt to an object
 */
export function decryptObject<T>(encryptedData: string): T {
  const json = decrypt(encryptedData);
  return JSON.parse(json) as T;
}

/**
 * Check if a string is encrypted (has our format)
 */
export function isEncrypted(data: string): boolean {
  if (typeof data !== "string") return false;
  const parts = data.split(":");
  if (parts.length !== 3) return false;

  // Check if parts look like hex strings of expected lengths
  const [iv, authTag, encrypted] = parts;
  return (
    iv.length === IV_LENGTH * 2 &&
    authTag.length === AUTH_TAG_LENGTH * 2 &&
    encrypted.length > 0 &&
    /^[0-9a-fA-F]+$/.test(iv) &&
    /^[0-9a-fA-F]+$/.test(authTag) &&
    /^[0-9a-fA-F]+$/.test(encrypted)
  );
}

/**
 * Generate a secure encryption secret (for initial setup)
 */
export function generateEncryptionSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
