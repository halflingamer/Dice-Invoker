import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SeedCipher = Readonly<{
  encrypt(seed: string): string;
  decrypt(ciphertext: string): string;
}>;

export function createSeedCipher(secret: Buffer): SeedCipher {
  if (secret.length !== 32) throw new Error("seed secret must contain exactly 32 bytes");

  return {
    encrypt(seed) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", secret, iv);
      const encrypted = Buffer.concat([cipher.update(seed, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
    },
    decrypt(ciphertext) {
      const [ivText, tagText, encryptedText] = ciphertext.split(".");
      if (!ivText || !tagText || !encryptedText) throw new Error("invalid seed ciphertext");
      const decipher = createDecipheriv("aes-256-gcm", secret, Buffer.from(ivText, "base64url"));
      decipher.setAuthTag(Buffer.from(tagText, "base64url"));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedText, "base64url")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}
