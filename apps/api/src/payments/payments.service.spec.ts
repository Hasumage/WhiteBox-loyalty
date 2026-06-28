import { PaymentPurpose, PaymentProvider, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { fetch as undiciFetch } from "undici";
import { PaymentsService } from "./payments.service";

jest.mock("undici", () => ({
  fetch: jest.fn(),
  ProxyAgent: jest.fn(),
}));

const mockedTelegramFetch = jest.mocked(undiciFetch);

function paymentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    uuid: "pay-local-1",
    provider: PaymentProvider.YOOKASSA,
    purpose: PaymentPurpose.USER_SUBSCRIPTION,
    status: PaymentStatus.PENDING,
    amount: "1000.00",
    currency: "RUB",
    description: "NearLoy subscription: Coffee",
    userId: 7,
    companyId: 3,
    subscriptionId: 5,
    subscriptionBundleId: null,
    userSubscriptionId: null,
    userSubscriptionBundleId: null,
    providerPaymentId: "yk_1",
    providerStatus: "pending",
    idempotenceKey: "idem-1",
    confirmationUrl: "https://yookassa.test/pay",
    returnUrl: "https://nearloy.test/payment/success?payment=pay-local-1",
    paidAt: null,
    canceledAt: null,
    cancelReason: null,
    metadata: null,
    providerPayload: null,
    createdAt: new Date("2026-06-05T10:00:00.000Z"),
    updatedAt: new Date("2026-06-05T10:00:00.000Z"),
    ...overrides,
  };
}

function paidPaymentFixture() {
  const activatedAt = new Date("2026-06-05T10:05:00.000Z");
  const expiresAt = new Date("2026-07-05T10:05:00.000Z");
  const pending = paymentRecord();
  const succeeded = paymentRecord({
    status: PaymentStatus.SUCCEEDED,
    providerStatus: "succeeded",
    paidAt: activatedAt,
  });
  const succeededWithRelations = {
    ...succeeded,
    userSubscriptionId: 44,
    subscription: { uuid: "sub-coffee", name: "Coffee", renewalValue: 1, renewalUnit: "MONTH" },
    subscriptionBundle: null,
    userSubscription: { id: 44, status: SubscriptionStatus.ACTIVE, activatedAt, expiresAt },
    userSubscriptionBundle: null,
  };
  return { activatedAt, expiresAt, pending, succeeded, succeededWithRelations };
}

describe("PaymentsService", () => {
  const originalTelegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalTelegramProxy = process.env.TELEGRAM_PROXY_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_PROXY_URL;
  });

  afterAll(() => {
    if (originalTelegramToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalTelegramToken;

    if (originalTelegramProxy === undefined) delete process.env.TELEGRAM_PROXY_URL;
    else process.env.TELEGRAM_PROXY_URL = originalTelegramProxy;
  });

  it("builds a clean success return URL even when the configured value already contains the success path", () => {
    const originalReturnUrl = process.env.YOOKASSA_RETURN_URL;
    process.env.YOOKASSA_RETURN_URL = "https://nearloy.example/payment/success";
    const service = new PaymentsService({} as never, {} as never, {} as never);

    const returnUrl = (service as unknown as { appReturnUrl: (uuid: string) => string }).appReturnUrl("pay-uuid-1");

    expect(returnUrl).toBe("https://nearloy.example/payment/success?payment=pay-uuid-1");
    expect(returnUrl).not.toContain("/payment/success/payment/success");

    if (originalReturnUrl === undefined) delete process.env.YOOKASSA_RETURN_URL;
    else process.env.YOOKASSA_RETURN_URL = originalReturnUrl;
  });

  it("does not activate the same successful payment twice", async () => {
    const { succeededWithRelations } = paidPaymentFixture();
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(succeededWithRelations),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      telegramMessageQueue: { create: jest.fn() },
    };
    const yookassa = { getPayment: jest.fn() };
    const registeredService = { activateSubscription: jest.fn() };
    const service = new PaymentsService(prisma as never, yookassa as never, registeredService as never);

    const result = await service.getUserPayment(7, "pay-local-1");

    expect(yookassa.getPayment).not.toHaveBeenCalled();
    expect(registeredService.activateSubscription).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(result.activatedSubscription).toEqual(expect.objectContaining({ id: 44, status: SubscriptionStatus.ACTIVE }));
  });

  it("syncs a successful YooKassa payment and activates the subscription from the return page", async () => {
    const { expiresAt, pending, succeeded, succeededWithRelations } = paidPaymentFixture();
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(succeededWithRelations),
        findUnique: jest.fn((args: { where: { id?: number; providerPaymentId?: string }; include?: { user?: unknown } }) => {
          if (args.where.providerPaymentId) return Promise.resolve(pending);
          if (args.include?.user) {
            return Promise.resolve({
              ...succeeded,
              user: { telegramId: null, name: "Emma Clark" },
              subscription: { name: "Coffee" },
              subscriptionBundle: null,
              userSubscription: { expiresAt },
              userSubscriptionBundle: null,
            });
          }
          return Promise.resolve({
            ...succeeded,
            subscription: { uuid: "sub-coffee" },
            subscriptionBundle: null,
          });
        }),
        update: jest.fn().mockResolvedValue(succeeded),
      },
      telegramMessageQueue: { create: jest.fn() },
    };
    const yookassa = {
      getPayment: jest.fn().mockResolvedValue({
        id: "yk_1",
        status: "succeeded",
        amount: { value: "1000.00", currency: "RUB" },
      }),
    };
    const registeredService = { activateSubscription: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new PaymentsService(prisma as never, yookassa as never, registeredService as never);

    const result = await service.getUserPayment(7, "pay-local-1");

    expect(yookassa.getPayment).toHaveBeenCalledWith("yk_1");
    expect(registeredService.activateSubscription).toHaveBeenCalledWith(7, "sub-coffee");
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userSubscriptionId: 44 }) }));
    expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    expect(result.plan).toEqual(expect.objectContaining({ type: "subscription", uuid: "sub-coffee", name: "Coffee" }));
    expect(result.activatedSubscription).toEqual(expect.objectContaining({ id: 44, status: SubscriptionStatus.ACTIVE }));
    expect(mockedTelegramFetch).not.toHaveBeenCalled();
  });

  it("thanks the user in Telegram when a paid subscription is activated", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    mockedTelegramFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 99 } }),
      text: async () => "",
    } as never);

    const { expiresAt, pending, succeeded, succeededWithRelations } = paidPaymentFixture();
    const prisma = {
      payment: {
        findFirst: jest.fn().mockResolvedValueOnce(pending).mockResolvedValueOnce(succeededWithRelations),
        findUnique: jest.fn((args: { where: { id?: number; providerPaymentId?: string }; include?: { user?: unknown } }) => {
          if (args.where.providerPaymentId) return Promise.resolve(pending);
          if (args.include?.user) {
            return Promise.resolve({
              ...succeeded,
              uuid: "pay-local-1",
              user: { telegramId: BigInt(1348887499), name: "Emma Clark" },
              subscription: { name: "Coffee" },
              subscriptionBundle: null,
              userSubscription: { expiresAt },
              userSubscriptionBundle: null,
            });
          }
          return Promise.resolve({
            ...succeeded,
            subscription: { uuid: "sub-coffee" },
            subscriptionBundle: null,
          });
        }),
        update: jest.fn().mockResolvedValue(succeeded),
      },
      telegramMessageQueue: { create: jest.fn() },
    };
    const yookassa = {
      getPayment: jest.fn().mockResolvedValue({
        id: "yk_1",
        status: "succeeded",
        amount: { value: "1000.00", currency: "RUB" },
      }),
    };
    const registeredService = { activateSubscription: jest.fn().mockResolvedValue({ id: 44 }) };
    const service = new PaymentsService(prisma as never, yookassa as never, registeredService as never);

    await service.getUserPayment(7, "pay-local-1");

    expect(mockedTelegramFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Подписка «Coffee» успешно подключена."),
      }),
    );
    expect(prisma.telegramMessageQueue.create).not.toHaveBeenCalled();
  });
  it("reuses an existing pending company subscription payment instead of creating a duplicate", async () => {
    const invoice = {
      id: "invoice-id",
      uuid: "invoice-uuid",
      companyId: 3,
      amountDue: "4990.00",
    };
    const existingPayment = paymentRecord({
      id: 31,
      uuid: "company-pay-1",
      purpose: PaymentPurpose.COMPANY_NEARLOY_SUBSCRIPTION,
      status: PaymentStatus.PENDING,
      amount: "4990.00",
      subscriptionId: null,
      confirmationUrl: "https://yookassa.test/company-pay",
      metadata: { invoiceUuid: "invoice-uuid" },
    });
    const prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 7,
          companyId: 3,
          user: { id: 7, email: "owner@nearloy.test", name: "Owner" },
          company: { id: 3, name: "Aurora Coffee" },
        }),
      },
      companyBillingInvoice: { findFirst: jest.fn().mockResolvedValue(invoice) },
      payment: {
        findMany: jest.fn().mockResolvedValue([existingPayment]),
        create: jest.fn(),
      },
    };
    const yookassa = {
      isConfigured: jest.fn().mockReturnValue(true),
      createPayment: jest.fn(),
    };
    const service = new PaymentsService(prisma as never, yookassa as never, {} as never);

    const result = await service.createCompanyBillingCheckout(7);

    expect(result.confirmationUrl).toBe("https://yookassa.test/company-pay");
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(yookassa.createPayment).not.toHaveBeenCalled();
  });

  it("rejects company subscription checkout when the latest invoice is already paid", async () => {
    const prisma = {
      companyMember: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 7,
          companyId: 3,
          user: { id: 7, email: "owner@nearloy.test", name: "Owner" },
          company: { id: 3, name: "Aurora Coffee" },
        }),
      },
      companyBillingInvoice: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "paid-invoice", uuid: "paid-invoice-uuid", companyId: 3, status: "PAID" }),
      },
      payment: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const yookassa = {
      isConfigured: jest.fn().mockReturnValue(true),
      createPayment: jest.fn(),
    };
    const service = new PaymentsService(prisma as never, yookassa as never, {} as never);

    await expect(service.createCompanyBillingCheckout(7)).rejects.toThrow("уже оплачена");

    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(yookassa.createPayment).not.toHaveBeenCalled();
  });
});
