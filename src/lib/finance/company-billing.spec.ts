import { addUtcDays, calculateCompanyBilling } from "./company-billing";

describe("company billing", () => {
  it("makes the monthly fee free once generated commission covers it", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
        recognizedSubscriptionRevenue: 50_000,
        commissionPercent: 12,
      }),
    ).toMatchObject({
      generatedCommission: 6000,
      commissionCreditAmount: 4990,
      amountDue: 0,
    });
  });

  it("applies promo discount before commission credit", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
        promoDiscountPercent: 50,
        recognizedSubscriptionRevenue: 10_000,
        commissionPercent: 12,
      }),
    ).toMatchObject({
      promoDiscountAmount: 2495,
      discountedFee: 2495,
      commissionCreditAmount: 1200,
      amountDue: 1295,
    });
  });

  it("supports a 100 percent promo without creating a negative invoice", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
        promoDiscountPercent: 100,
        recognizedSubscriptionRevenue: 0,
        commissionPercent: 12,
      }).amountDue,
    ).toBe(0);
  });

  it("creates a 30 day verification trial", () => {
    const start = new Date("2026-06-04T12:00:00.000Z");
    expect(addUtcDays(start, 30).toISOString()).toBe("2026-07-04T12:00:00.000Z");
  });
});
