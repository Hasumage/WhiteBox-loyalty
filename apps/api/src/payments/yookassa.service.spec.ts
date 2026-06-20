import { BadGatewayException, BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { YooKassaService } from "./yookassa.service";

function serviceWith(env: Record<string, string | undefined>) {
  const config = { get: jest.fn((key: string) => env[key]) } as unknown as ConfigService;
  return new YooKassaService(config);
}

describe("YooKassaService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("requires credentials before calling YooKassa", async () => {
    const service = serviceWith({});

    await expect(
      service.createPayment({
        amount: "100.00",
        currency: "RUB",
        description: "NearLoy subscription",
        returnUrl: "https://nearloy.test/return",
        customerEmail: "client@nearloy.test",
        metadata: { nearloyPaymentUuid: "pay_1" },
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("creates a redirect payment with idempotence key, receipt and metadata", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "2f0f-pay",
        status: "pending",
        confirmation: { type: "redirect", confirmation_url: "https://yookassa.test/pay" },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = serviceWith({
      YOOKASSA_SHOP_ID: "shop_123",
      YOOKASSA_SECRET_KEY: "secret_456",
      YOOKASSA_VAT_CODE: "1",
    });

    const result = await service.createPayment({
      amount: "499.00",
      currency: "RUB",
      description: "NearLoy subscription checkout",
      returnUrl: "https://nearloy.test/payment/success?payment=abc",
      idempotenceKey: "idem-1",
      customerEmail: "client@nearloy.test",
      metadata: { nearloyPaymentUuid: "abc", planUuid: "sub_1" },
    });

    expect(result.idempotenceKey).toBe("idem-1");
    expect(fetchMock).toHaveBeenCalledWith("https://api.yookassa.ru/v3/payments", expect.objectContaining({ method: "POST" }));

    const [, request] = fetchMock.mock.calls[0];
    expect(request.headers.Authorization).toBe(`Basic ${Buffer.from("shop_123:secret_456").toString("base64")}`);
    expect(request.headers["Idempotence-Key"]).toBe("idem-1");

    const body = JSON.parse(request.body);
    expect(body.capture).toBe(true);
    expect(body.payment_method_data).toEqual({ type: "bank_card" });
    expect(body.save_payment_method).toBe(false);
    expect(body.confirmation).toEqual({ type: "redirect", return_url: "https://nearloy.test/payment/success?payment=abc" });
    expect(body.metadata.nearloyPaymentUuid).toBe("abc");
    expect(body.receipt.customer.email).toBe("client@nearloy.test");
    expect(body.receipt.items[0]).toEqual(expect.objectContaining({ vat_code: 1, payment_mode: "full_payment", payment_subject: "service" }));
  });


  it("rejects bank card payments above the configured limit before calling YooKassa", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = serviceWith({
      YOOKASSA_SHOP_ID: "shop_123",
      YOOKASSA_SECRET_KEY: "secret_456",
      YOOKASSA_MAX_BANK_CARD_PAYMENT_RUB: "349999",
    });

    await expect(
      service.createPayment({
        amount: "990000.00",
        currency: "RUB",
        description: "NearLoy subscription",
        returnUrl: "https://nearloy.test/return",
        customerEmail: "client@nearloy.test",
        metadata: { nearloyPaymentUuid: "pay_1" },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps YooKassa provider errors to BadGateway without exposing secrets", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ description: "Invalid shop credentials" }),
    }) as unknown as typeof fetch;

    const service = serviceWith({ YOOKASSA_SHOP_ID: "shop_123", YOOKASSA_SECRET_KEY: "super-secret" });

    await expect(
      service.createPayment({
        amount: "100.00",
        currency: "RUB",
        description: "NearLoy subscription",
        returnUrl: "https://nearloy.test/return",
        customerEmail: "client@nearloy.test",
        metadata: { nearloyPaymentUuid: "pay_1" },
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

