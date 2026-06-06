import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";

export type YooKassaPaymentStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";

export type YooKassaPaymentObject = {
  id: string;
  status: YooKassaPaymentStatus | string;
  paid?: boolean;
  amount?: { value: string; currency: string };
  confirmation?: { type?: string; confirmation_url?: string };
  cancellation_details?: { party?: string; reason?: string };
  metadata?: Record<string, unknown>;
  created_at?: string;
  captured_at?: string;
};

type CreatePaymentInput = {
  amount: string;
  currency: string;
  description: string;
  returnUrl: string;
  idempotenceKey?: string;
  customerEmail: string;
  metadata: Record<string, string>;
};

@Injectable()
export class YooKassaService {
  private readonly apiUrl = "https://api.yookassa.ru/v3";

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>("YOOKASSA_SHOP_ID") && this.config.get<string>("YOOKASSA_SECRET_KEY"));
  }

  private authHeader() {
    const shopId = this.config.get<string>("YOOKASSA_SHOP_ID");
    const secretKey = this.config.get<string>("YOOKASSA_SECRET_KEY");
    if (!shopId || !secretKey) {
      throw new ServiceUnavailableException("YooKassa credentials are not configured.");
    }
    return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString("base64")}`;
  }

  private vatCode() {
    const raw = Number(this.config.get<string>("YOOKASSA_VAT_CODE") ?? "1");
    return Number.isFinite(raw) && raw >= 1 && raw <= 6 ? raw : 1;
  }

  private maxBankCardPaymentRub() {
    const raw = Number(this.config.get<string>("YOOKASSA_MAX_BANK_CARD_PAYMENT_RUB") ?? "349999");
    return Number.isFinite(raw) && raw > 0 ? raw : 349999;
  }

  private assertPaymentAmount(input: CreatePaymentInput) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Payment amount must be greater than 0.");
    }

    const isRub = input.currency.toUpperCase() === "RUB";
    const maxCardAmount = this.maxBankCardPaymentRub();
    if (isRub && amount > maxCardAmount) {
      throw new BadRequestException(
        `YooKassa bank card payments are limited to ${maxCardAmount.toFixed(2)} RUB. Lower the subscription price or split the payment.`,
      );
    }
  }

  async createPayment(input: CreatePaymentInput) {
    this.assertPaymentAmount(input);

    const idempotenceKey = input.idempotenceKey ?? randomUUID();
    const body = {
      amount: { value: input.amount, currency: input.currency },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: input.returnUrl,
      },
      payment_method_data: { type: "bank_card" },
      save_payment_method: false,
      description: input.description.slice(0, 128),
      metadata: input.metadata,
      receipt: {
        customer: { email: input.customerEmail },
        items: [
          {
            description: input.description.slice(0, 128),
            quantity: "1.00",
            amount: { value: input.amount, currency: input.currency },
            vat_code: this.vatCode(),
            payment_mode: "full_payment",
            payment_subject: "service",
          },
        ],
      },
    };

    const response = await fetch(`${this.apiUrl}/payments`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
        "Idempotence-Key": idempotenceKey,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as YooKassaPaymentObject & { description?: string };
    if (!response.ok) {
      throw new BadGatewayException(payload.description ?? "YooKassa payment creation failed.");
    }
    return { payment: payload, idempotenceKey };
  }

  async getPayment(providerPaymentId: string) {
    const response = await fetch(`${this.apiUrl}/payments/${encodeURIComponent(providerPaymentId)}`, {
      method: "GET",
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
    });
    const payload = (await response.json().catch(() => ({}))) as YooKassaPaymentObject & { description?: string };
    if (!response.ok) {
      throw new BadGatewayException(payload.description ?? "YooKassa payment status request failed.");
    }
    return payload;
  }
}

