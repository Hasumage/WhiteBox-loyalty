import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

export const PR_PAYOUT_BANKS = [
  { code: "sber", name: "Сбербанк" },
  { code: "tbank", name: "Т-Банк" },
  { code: "vtb", name: "ВТБ" },
  { code: "alfabank", name: "Альфа-Банк" },
  { code: "gazprombank", name: "Газпромбанк" },
] as const;

type PrPayoutBankCode = (typeof PR_PAYOUT_BANKS)[number]["code"];

export type PrPayoutRequisitesInput = {
  bankCode?: unknown;
  phone?: unknown;
  cardNumber?: unknown;
};

export type PrPayoutRequisitesPublic = {
  bankCode: string | null;
  bankName: string | null;
  phone: string | null;
  cardLast4: string | null;
  cardMasked: string | null;
  updatedAt: string | null;
  configured: boolean;
};

export function prPayoutBankName(code: string | null | undefined) {
  return PR_PAYOUT_BANKS.find((bank) => bank.code === code)?.name ?? null;
}

function normalizePhone(value: unknown) {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("8")) return `7${digits.slice(1)}`;
  return digits;
}

function normalizeCard(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 19) : "";
}

export function maskPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return value;
  return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} *** ** ${digits.slice(-2)}`;
}

export function maskCard(last4: string | null | undefined) {
  return last4 ? `•••• ${last4}` : null;
}

function payoutSecret() {
  const secret =
    process.env.PR_PAYOUT_STORAGE_SECRET ||
    process.env.PASSPORT_STORAGE_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("PR payout storage secret is not configured.");
  }

  return scryptSync(secret, "nearloy-pr-payout-requisites", 32);
}

export function encryptPrPayoutCard(cardNumber: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", payoutSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(cardNumber, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    last4: cardNumber.slice(-4),
  };
}

export function normalizePrPayoutRequisitesInput(input: PrPayoutRequisitesInput) {
  const bankCode = typeof input.bankCode === "string" ? input.bankCode.trim() : "";
  const bank = PR_PAYOUT_BANKS.find((item) => item.code === bankCode);
  if (!bank) throw new Error("Выберите банк из списка.");

  const phone = normalizePhone(input.phone);
  if (phone && (phone.length < 10 || phone.length > 15)) {
    throw new Error("Проверьте номер телефона для выплаты.");
  }

  const cardNumber = normalizeCard(input.cardNumber);
  if (cardNumber && (cardNumber.length < 12 || cardNumber.length > 19)) {
    throw new Error("Проверьте номер карты для выплаты.");
  }

  if (!phone && !cardNumber) {
    throw new Error("Добавьте телефон или карту для выплаты.");
  }

  return {
    bankCode: bank.code as PrPayoutBankCode,
    bankName: bank.name,
    phone: phone || null,
    cardNumber: cardNumber || null,
  };
}

export function serializePrPayoutRequisites(user: {
  prPayoutBankCode?: string | null;
  prPayoutBankName?: string | null;
  prPayoutPhone?: string | null;
  prPayoutCardLast4?: string | null;
  prPayoutRequisitesUpdatedAt?: Date | string | null;
}): PrPayoutRequisitesPublic {
  const bankName = user.prPayoutBankName ?? prPayoutBankName(user.prPayoutBankCode);
  const phone = maskPhone(user.prPayoutPhone);
  const cardMasked = maskCard(user.prPayoutCardLast4);

  return {
    bankCode: user.prPayoutBankCode ?? null,
    bankName,
    phone,
    cardLast4: user.prPayoutCardLast4 ?? null,
    cardMasked,
    updatedAt: user.prPayoutRequisitesUpdatedAt
      ? new Date(user.prPayoutRequisitesUpdatedAt).toISOString()
      : null,
    configured: Boolean(bankName && (phone || cardMasked)),
  };
}

export function hasPrPayoutDestination(user: {
  prPayoutBankName?: string | null;
  prPayoutPhone?: string | null;
  prPayoutCardLast4?: string | null;
}) {
  return Boolean(user.prPayoutBankName && (user.prPayoutPhone || user.prPayoutCardLast4));
}
