jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    financeOperation: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    userSubscription: { findMany: jest.fn() },
    auditEvent: { create: jest.fn() },
    adminTask: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("@/lib/admin/require-admin-session", () => ({
  requireAdminSession: jest.fn(),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

jest.mock("@/lib/finance/yookassa-payouts", () => ({
  createYooKassaPayout: jest.fn(),
  getYooKassaPayout: jest.fn(),
  mapYooKassaPayoutStatus: jest.fn((status: string) => (status === "succeeded" ? "PAID" : status === "canceled" ? "CANCELED" : "APPROVED")),
}));

import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/admin/require-admin-session";
import { createYooKassaPayout } from "@/lib/finance/yookassa-payouts";
import { prisma } from "@/lib/prisma";
import { PATCH } from "./route";

const mockedPrisma = jest.mocked(prisma, { shallow: false });
const mockedRequireAdminSession = jest.mocked(requireAdminSession);
const mockedCreateYooKassaPayout = jest.mocked(createYooKassaPayout);

describe("admin finance approval route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRequireAdminSession.mockResolvedValue({ userId: 1, email: "owner@test.local", role: "SUPER_ADMIN" });
    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      role: "SUPER_ADMIN",
      email: "owner@test.local",
      permissions: [],
    } as never);
    (mockedPrisma.$transaction as unknown as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
  });

  it("blocks approval of a company payout not covered by recognized earnings", async () => {
    mockedPrisma.financeOperation.findUnique.mockResolvedValue({
      uuid: "payout-1",
      companyId: 7,
      type: "PAYOUT_REQUEST",
      status: "PENDING_APPROVAL",
      amount: 200,
    } as never);
    mockedPrisma.userSubscription.findMany.mockResolvedValue([
      {
        status: "EXPIRED",
        activatedAt: new Date("2026-05-01T00:00:00.000Z"),
        expiresAt: new Date("2026-05-02T00:00:00.000Z"),
        subscription: { companyId: 7, name: "One-day pass", price: 100 },
      },
    ] as never);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([
      { companyId: 7, type: "PAYOUT_REQUEST", status: "PENDING_APPROVAL", amount: 200 },
    ] as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/finance-operations/payout-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      }),
      { params: { uuid: "payout-1" } },
    );

    expect(response.status).toBe(409);
    expect(mockedPrisma.financeOperation.update).not.toHaveBeenCalled();
  });

  it("requires a manual reference or comment before marking payout paid", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/finance-operations/payout-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "PAID" }),
      }),
      { params: { uuid: "payout-1" } },
    );

    expect(response.status).toBe(400);
    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates a YooKassa payout for an approved covered company request", async () => {
    const currentOperation = {
      id: "op-1",
      uuid: "payout-1",
      companyId: 7,
      requestedById: null,
      type: "PAYOUT_REQUEST",
      status: "APPROVED",
      amount: 100,
      currency: "RUB",
      title: "Test company payout",
      details: null,
      approvedAt: new Date("2026-07-08T00:00:00.000Z"),
      providerPayoutId: null,
      providerIdempotenceKey: null,
    };
    mockedPrisma.financeOperation.findUnique.mockResolvedValue(currentOperation as never);
    mockedPrisma.userSubscription.findMany.mockResolvedValue([
      {
        status: "ACTIVE",
        activatedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        subscription: { companyId: 7, name: "Annual pass", price: 50000 },
      },
    ] as never);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([
      { companyId: 7, type: "PAYOUT_REQUEST", status: "APPROVED", amount: 100 },
    ] as never);
    mockedCreateYooKassaPayout.mockResolvedValue({
      idempotenceKey: "finance-payout:payout-1",
      destinationType: "bank_card",
      destinationLabel: "•••• 4477",
      payout: {
        id: "po_test_1",
        status: "succeeded",
        amount: { value: "100.00", currency: "RUB" },
      },
    });
    mockedPrisma.financeOperation.update.mockResolvedValue({
      ...currentOperation,
      status: "PAID",
      payoutProvider: "YOOKASSA",
      providerPayoutId: "po_test_1",
      providerPayoutStatus: "succeeded",
    } as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/finance-operations/payout-1", {
        method: "PATCH",
        body: JSON.stringify({
          status: "PAID",
          payoutMode: "YOOKASSA",
          destinationType: "bank_card",
          cardNumber: "5555555555554477",
        }),
      }),
      { params: { uuid: "payout-1" } },
    );

    expect(response.status).toBe(200);
    expect(mockedCreateYooKassaPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "100",
        currency: "RUB",
        idempotenceKey: "finance-payout:payout-1",
        destination: { type: "bank_card", cardNumber: "5555555555554477" },
      }),
    );
    expect(mockedPrisma.financeOperation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
          payoutProvider: "YOOKASSA",
          providerPayoutId: "po_test_1",
          providerPayoutStatus: "succeeded",
          payoutDestinationLabel: "•••• 4477",
        }),
      }),
    );
  });

  it("does not fail a paid YooKassa payout when audit side effects fail", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const currentOperation = {
      id: "op-2",
      uuid: "payout-2",
      companyId: 7,
      requestedById: null,
      type: "PAYOUT_REQUEST",
      status: "APPROVED",
      amount: 1500,
      currency: "RUB",
      title: "Covered company payout",
      details: null,
      approvedAt: null,
      providerPayoutId: null,
      providerIdempotenceKey: "finance-payout:payout-2",
    };
    mockedPrisma.financeOperation.findUnique.mockResolvedValue(currentOperation as never);
    mockedPrisma.userSubscription.findMany.mockResolvedValue([
      {
        status: "ACTIVE",
        activatedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-12-31T00:00:00.000Z"),
        subscription: { companyId: 7, name: "Annual pass", price: 50000 },
      },
    ] as never);
    mockedPrisma.financeOperation.findMany.mockResolvedValue([
      { companyId: 7, type: "PAYOUT_REQUEST", status: "APPROVED", amount: 1500 },
    ] as never);
    mockedCreateYooKassaPayout.mockResolvedValue({
      idempotenceKey: "finance-payout:payout-2",
      destinationType: "yoo_money",
      destinationLabel: "ЮMoney 4100…5714",
      payout: {
        id: "po_test_paid",
        status: "succeeded",
        amount: { value: "1500.00", currency: "RUB" },
      },
    });
    mockedPrisma.financeOperation.update.mockResolvedValue({
      ...currentOperation,
      status: "PAID",
      payoutProvider: "YOOKASSA",
      providerPayoutId: "po_test_paid",
      providerPayoutStatus: "succeeded",
    } as never);
    mockedPrisma.auditEvent.create.mockRejectedValueOnce(new Error("audit storage is temporarily unavailable") as never);

    const response = await PATCH(
      new NextRequest("http://localhost/api/admin/finance-operations/payout-2", {
        method: "PATCH",
        body: JSON.stringify({
          status: "PAID",
          payoutMode: "YOOKASSA",
          destinationType: "yoo_money",
          yooMoneyWallet: "41001614575714",
        }),
      }),
      { params: { uuid: "payout-2" } },
    );

    expect(response.status).toBe(200);
    expect(mockedPrisma.financeOperation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
          providerPayoutId: "po_test_paid",
          providerPayoutStatus: "succeeded",
        }),
      }),
    );
    expect(mockedPrisma.auditEvent.create).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
