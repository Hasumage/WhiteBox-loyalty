import { randomUUID } from "node:crypto";

export type YooKassaPayoutStatus = "pending" | "succeeded" | "canceled" | string;

export type YooKassaPayoutObject = {
  id: string;
  status: YooKassaPayoutStatus;
  amount?: { value: string; currency: string };
  payout_destination?: {
    type?: string;
    card?: { first6?: string; last4?: string; card_type?: string };
    account_number?: string;
  };
  cancellation_details?: { party?: string; reason?: string };
  metadata?: Record<string, unknown>;
  created_at?: string;
  canceled_at?: string;
  description?: string;
};

export type YooKassaPayoutDestination =
  | { type: "bank_card"; cardNumber: string }
  | { type: "yoo_money"; accountNumber: string };

type CreatePayoutInput = {
  amount: string;
  currency: string;
  description: string;
  idempotenceKey?: string | null;
  destination: YooKassaPayoutDestination;
  metadata: Record<string, string>;
};

const DEFAULT_API_URL = "https://api.yookassa.ru/v3";

function readEnv(name: string) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : "";
}

function payoutApiUrl() {
  return readEnv("YOOKASSA_PAYOUT_API_URL") || DEFAULT_API_URL;
}

function payoutAgentId() {
  return readEnv("YOOKASSA_PAYOUT_AGENT_ID") || readEnv("YOOKASSA_SHOP_ID");
}

function payoutSecretKey() {
  return readEnv("YOOKASSA_PAYOUT_SECRET_KEY") || readEnv("YOOKASSA_SECRET_KEY");
}

function authHeader() {
  const agentId = payoutAgentId();
  const secretKey = payoutSecretKey();
  if (!agentId || !secretKey) {
    throw new Error("YOOKASSA_PAYOUT_NOT_CONFIGURED");
  }
  return `Basic ${Buffer.from(`${agentId}:${secretKey}`).toString("base64")}`;
}

export function getYooKassaPayoutConfigStatus() {
  const dedicatedAgent = readEnv("YOOKASSA_PAYOUT_AGENT_ID");
  const dedicatedSecret = readEnv("YOOKASSA_PAYOUT_SECRET_KEY");
  const fallbackShop = readEnv("YOOKASSA_SHOP_ID");
  const fallbackSecret = readEnv("YOOKASSA_SECRET_KEY");
  const agentId = payoutAgentId();
  const secretKey = payoutSecretKey();
  return {
    configured: Boolean(agentId && secretKey),
    apiUrl: payoutApiUrl(),
    agentId: agentId || null,
    credentialSource: dedicatedAgent || dedicatedSecret ? "payout" : fallbackShop || fallbackSecret ? "shop" : "missing",
    missing: [
      agentId ? null : "YOOKASSA_PAYOUT_AGENT_ID",
      secretKey ? null : "YOOKASSA_PAYOUT_SECRET_KEY",
    ].filter(Boolean),
  };
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCardNumber(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return `•••• ${digits.slice(-4)}`;
}

function validateDestination(destination: YooKassaPayoutDestination) {
  if (destination.type === "bank_card") {
    const digits = digitsOnly(destination.cardNumber);
    if (digits.length < 12 || digits.length > 19) {
      throw new Error("YOOKASSA_PAYOUT_CARD_INVALID");
    }
    if (process.env.NODE_ENV === "production" && readEnv("YOOKASSA_PAYOUT_ALLOW_RAW_CARD") !== "true") {
      throw new Error("YOOKASSA_PAYOUT_RAW_CARD_DISABLED");
    }
    return {
      label: maskCardNumber(digits),
      data: {
        type: "bank_card",
        card: { number: digits },
      },
    };
  }

  const accountNumber = digitsOnly(destination.accountNumber);
  if (accountNumber.length < 8) {
    throw new Error("YOOKASSA_PAYOUT_YOOMONEY_INVALID");
  }
  return {
    label: `YooMoney ${accountNumber.slice(0, 4)}...${accountNumber.slice(-4)}`,
    data: {
      type: "yoo_money",
      account_number: accountNumber,
    },
  };
}

async function parseYooKassaResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as YooKassaPayoutObject & {
    type?: string;
    code?: string;
    description?: string;
    parameter?: string;
  };
  if (!response.ok) {
    const suffix = payload.parameter ? ` (${payload.parameter})` : "";
    throw new Error(payload.description ? `YOOKASSA_PAYOUT_FAILED:${payload.description}${suffix}` : "YOOKASSA_PAYOUT_FAILED");
  }
  return payload;
}

export async function createYooKassaPayout(input: CreatePayoutInput) {
  const idempotenceKey = input.idempotenceKey || randomUUID();
  const destination = validateDestination(input.destination);
  const body = {
    amount: {
      value: Number(input.amount).toFixed(2),
      currency: input.currency,
    },
    payout_destination_data: destination.data,
    description: input.description.slice(0, 128),
    metadata: input.metadata,
  };

  const response = await fetch(`${payoutApiUrl()}/payouts`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      "Idempotence-Key": idempotenceKey,
    },
    body: JSON.stringify(body),
  });

  return {
    payout: await parseYooKassaResponse(response),
    idempotenceKey,
    destinationType: input.destination.type,
    destinationLabel: destination.label,
  };
}

export async function getYooKassaPayout(providerPayoutId: string) {
  const response = await fetch(`${payoutApiUrl()}/payouts/${encodeURIComponent(providerPayoutId)}`, {
    method: "GET",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
  });
  return parseYooKassaResponse(response);
}

export function mapYooKassaPayoutStatus(status: YooKassaPayoutStatus) {
  if (status === "succeeded") return "PAID" as const;
  if (status === "canceled") return "CANCELED" as const;
  return "APPROVED" as const;
}
