jest.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    customerLookupCode: {
      updateMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createTelegramCustomerLookupCode, isTelegramLookupCodeRequest } from "./customer-lookup-code";

const mockedPrisma = prisma as unknown as {
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
  customerLookupCode: { updateMany: jest.Mock };
};

describe("Telegram customer lookup codes", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("recognizes natural code requests without matching unrelated text", () => {
    expect(isTelegramLookupCodeRequest("код")).toBe(true);
    expect(isTelegramLookupCodeRequest("дай код")).toBe(true);
    expect(isTelegramLookupCodeRequest("покажи QR код пожалуйста")).toBe(true);
    expect(isTelegramLookupCodeRequest("code")).toBe(true);
    expect(isTelegramLookupCodeRequest("send my code please")).toBe(true);

    expect(isTelegramLookupCodeRequest("промокод")).toBe(false);
    expect(isTelegramLookupCodeRequest("кодовое слово")).toBe(false);
    expect(isTelegramLookupCodeRequest(undefined)).toBe(false);
  });

  it("returns an existing active code instead of creating a duplicate within 15 minutes", async () => {
    const expiresAt = new Date("2026-08-01T12:14:00.000Z");
    mockedPrisma.$queryRaw.mockResolvedValue([{ code: "23826", expiresAt }]);

    await expect(createTelegramCustomerLookupCode(24)).resolves.toEqual({ code: "23826", expiresAt });

    expect(mockedPrisma.customerLookupCode.updateMany).not.toHaveBeenCalled();
    expect(mockedPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("creates a new five digit code for 15 minutes when no active code exists", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([]);
    mockedPrisma.customerLookupCode.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.$executeRaw.mockResolvedValue(1);

    const result = await createTelegramCustomerLookupCode(24);

    expect(result.code).toMatch(/^\d{5}$/);
    expect(result.expiresAt).toEqual(new Date("2026-08-01T12:15:00.000Z"));
    expect(mockedPrisma.customerLookupCode.updateMany).toHaveBeenCalledWith({
      where: { userId: 24, usedAt: null, expiresAt: { gt: new Date("2026-08-01T12:00:00.000Z") } },
      data: { usedAt: new Date("2026-08-01T12:00:00.000Z") },
    });
    expect(mockedPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("retries code generation when a unique hash collision happens", async () => {
    mockedPrisma.$queryRaw.mockResolvedValue([]);
    mockedPrisma.customerLookupCode.updateMany.mockResolvedValue({ count: 0 });
    mockedPrisma.$executeRaw
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce(1);

    const result = await createTelegramCustomerLookupCode(24);

    expect(result.code).toMatch(/^\d{5}$/);
    expect(mockedPrisma.$executeRaw).toHaveBeenCalledTimes(2);
  });
});
