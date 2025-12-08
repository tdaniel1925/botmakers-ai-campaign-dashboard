import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  isEncrypted,
  generateEncryptionSecret,
} from "@/lib/encryption";

describe("Encryption Utility", () => {
  const originalEnv = process.env.ENCRYPTION_SECRET;

  beforeEach(() => {
    // Set a valid encryption secret for testing
    process.env.ENCRYPTION_SECRET = "test-encryption-secret-32-chars!!";
  });

  afterEach(() => {
    process.env.ENCRYPTION_SECRET = originalEnv;
  });

  describe("encrypt / decrypt", () => {
    it("should encrypt and decrypt a string successfully", () => {
      const plaintext = "my-secret-api-key-12345";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", () => {
      const plaintext = "same-secret-key";

      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });

    it("should handle empty string", () => {
      const plaintext = "";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle special characters", () => {
      const plaintext = "api-key-with-special-chars!@#$%^&*()_+{}|:<>?";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      const plaintext = "密钥-키-مفتاح-🔑";

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const plaintext = "a".repeat(10000);

      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw error for invalid encrypted format", () => {
      expect(() => decrypt("invalid-format")).toThrow("Invalid encrypted data format");
    });

    it("should throw error for tampered data", () => {
      const encrypted = encrypt("test-data");
      const parts = encrypted.split(":");
      parts[2] = "00" + parts[2].slice(2); // Tamper with encrypted data

      expect(() => decrypt(parts.join(":"))).toThrow();
    });
  });

  describe("encryptObject / decryptObject", () => {
    it("should encrypt and decrypt an object", () => {
      const obj = {
        apiKey: "secret-key",
        assistantId: 12345,
        enabled: true,
      };

      const encrypted = encryptObject(obj);
      const decrypted = decryptObject<typeof obj>(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it("should handle nested objects", () => {
      const obj = {
        credentials: {
          api: {
            key: "nested-key",
            secret: "nested-secret",
          },
        },
        config: {
          settings: [1, 2, 3],
        },
      };

      const encrypted = encryptObject(obj);
      const decrypted = decryptObject<typeof obj>(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it("should handle arrays", () => {
      const arr = ["key1", "key2", "key3"];

      const encrypted = encryptObject(arr);
      const decrypted = decryptObject<typeof arr>(encrypted);

      expect(decrypted).toEqual(arr);
    });
  });

  describe("isEncrypted", () => {
    it("should return true for properly encrypted strings", () => {
      const encrypted = encrypt("test-data");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for plain strings", () => {
      expect(isEncrypted("plain-text")).toBe(false);
    });

    it("should return false for strings with wrong format", () => {
      expect(isEncrypted("part1:part2")).toBe(false);
      expect(isEncrypted("a:b:c:d")).toBe(false);
    });

    it("should return false for non-hex strings in parts", () => {
      expect(isEncrypted("zzzz:yyyy:xxxx")).toBe(false);
    });

    it("should return false for non-string values", () => {
      // @ts-expect-error - testing invalid input
      expect(isEncrypted(12345)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isEncrypted(null)).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe("generateEncryptionSecret", () => {
    it("should generate a 64-character hex string", () => {
      const secret = generateEncryptionSecret();

      expect(secret.length).toBe(64);
      expect(/^[0-9a-f]+$/i.test(secret)).toBe(true);
    });

    it("should generate unique secrets", () => {
      const secrets = new Set<string>();

      for (let i = 0; i < 100; i++) {
        secrets.add(generateEncryptionSecret());
      }

      expect(secrets.size).toBe(100);
    });
  });

  describe("Error handling", () => {
    it("should throw error when ENCRYPTION_SECRET is not set", () => {
      delete process.env.ENCRYPTION_SECRET;

      expect(() => encrypt("test")).toThrow("ENCRYPTION_SECRET environment variable is required");
    });

    it("should work with 64-char hex secret (used directly)", () => {
      process.env.ENCRYPTION_SECRET = "a".repeat(64);

      const plaintext = "test-with-hex-key";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
