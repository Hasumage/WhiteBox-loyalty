import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

export type EncryptedPaymentMethod = {
  encrypted: Buffer;
  iv: string;
  tag: string;
};

function encryptionKey() {
  const secret =
    process.env.PAYMENT_METHOD_ENCRYPTION_KEY ||
    process.env.FIELD_ENCRYPTION_KEY ||
    process.env.PASSPORT_STORAGE_SECRET ||
    process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("PAYMENT_METHOD_ENCRYPTION_KEY or JWT_SECRET is required for payment method encryption.");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptPaymentMethodId(value: string): EncryptedPaymentMethod {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptPaymentMethodId(input: { encrypted: Buffer | Uint8Array; iv: string; tag: string }) {
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(input.encrypted)), decipher.final()]).toString("utf8");
}
