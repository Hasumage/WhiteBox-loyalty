import { addUtcDays, calculateCompanyBilling, calculateMonthlyAccessSplit } from "./company-billing";

describe("company billing", () => {
  it("keeps monthly access billing separate from subscription commission", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
      }),
    ).toMatchObject({
      generatedCommission: 0,
      commissionCreditAmount: 0,
      amountDue: 4990,
    });
  });

  it("applies promo discount to the monthly access fee", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
        promoDiscountPercent: 50,
      }),
    ).toMatchObject({
      promoDiscountAmount: 2495,
      discountedFee: 2495,
      commissionCreditAmount: 0,
      amountDue: 2495,
    });
  });

  it("supports a 100 percent promo without creating a negative invoice", () => {
    expect(
      calculateCompanyBilling({
        baseFee: 4990,
        promoDiscountPercent: 100,
      }).amountDue,
    ).toBe(0);
  });

  it("splits paid monthly access 70/30 when a PR manager is attached", () => {
    expect(calculateMonthlyAccessSplit(4990, true)).toEqual({
      referralPercent: 30,
      referralAmount: 1497,
      platformAmount: 3493,
    });
  });

  it("keeps all monthly access revenue in NearLoy when there is no PR manager", () => {
    expect(calculateMonthlyAccessSplit(4990, false)).toEqual({
      referralPercent: 0,
      referralAmount: 0,
      platformAmount: 4990,
    });
  });

  it("creates a 30 day verification trial", () => {
    const start = new Date("2026-06-04T12:00:00.000Z");
    expect(addUtcDays(start, 30).toISOString()).toBe("2026-07-04T12:00:00.000Z");
  });
});
