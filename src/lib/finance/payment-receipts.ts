type JsonRecord = Record<string, unknown>;

const receiptKeyPattern = /(receipt|check|fiscal|ofd|касс|чек)/i;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function findReceiptUrl(value: unknown, parentKey = "", depth = 0): string | null {
  if (depth > 6) return null;
  if (typeof value === "string") {
    return receiptKeyPattern.test(parentKey) && isHttpUrl(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReceiptUrl(item, parentKey, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  for (const [key, item] of Object.entries(value)) {
    const found = findReceiptUrl(item, key, depth + 1);
    if (found) return found;
  }
  return null;
}

export function getPaymentReceiptUrl(payment: { metadata?: unknown; providerPayload?: unknown }) {
  return findReceiptUrl(payment.metadata) ?? findReceiptUrl(payment.providerPayload);
}
