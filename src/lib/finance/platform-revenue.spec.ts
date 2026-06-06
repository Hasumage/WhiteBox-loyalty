import { calculatePlatformRevenueSummary } from "./platform-revenue";

describe("platform revenue summary", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  it("charges platform commission from the full recognized subscription turnover", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 1,
          companyName: "Small coffee",
          price: 60_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
        },
      ],
      now,
    );

    expect(summary.recognizedGross).toBe(18_000);
    expect(summary.whiteBoxCommission).toBe(2_160);
    expect(summary.companyRecognizedRevenue).toBe(15_840);
  });

  it("keeps the subscription commission independent from the monthly fee threshold", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 1,
          companyName: "Annual club",
          price: 300_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
        },
      ],
      now,
    );

    expect(summary.recognizedGross).toBe(90_000);
    expect(summary.companies[0]).toMatchObject({
      commissionableRecognized: 90_000,
      whiteBoxCommission: 10_800,
      referralCommission: 0,
      companyRecognizedRevenue: 79_200,
    });
  });

  it("pays active referrers from the recognized turnover and keeps company commission stable", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 7,
          companyName: "Fitness plus coffee",
          price: 300_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
          referralPercent: 1,
          referralStatus: "ACTIVE",
          referrerUserId: 42,
        },
      ],
      now,
    );

    expect(summary.companies[0]).toMatchObject({
      commissionableRecognized: 90_000,
      whiteBoxCommission: 9_900,
      referralCommission: 900,
      companyRecognizedRevenue: 79_200,
      referralUserId: 42,
    });
    expect(summary.companiesWithReferral).toBe(1);
  });

  it("always allocates the support manager share from recognized turnover when a manager is assigned", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 8,
          companyName: "Managed partner",
          price: 300_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
          supportManagerUserId: 15,
          supportManagerPercent: 1,
        },
      ],
      now,
    );

    expect(summary.companies[0]).toMatchObject({
      commissionableRecognized: 90_000,
      whiteBoxCommission: 9_900,
      supportManagerCommission: 900,
      companyRecognizedRevenue: 79_200,
      supportManagerUserId: 15,
    });
    expect(summary.companiesWithSupportManager).toBe(1);
  });

  it("can pay both public referrer and support manager without increasing the company commission", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 10,
          companyName: "Referred and supported",
          price: 300_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
          referralPercent: 1,
          referralStatus: "ACTIVE",
          referrerUserId: 42,
          supportManagerUserId: 15,
          supportManagerPercent: 1,
        },
      ],
      now,
    );

    expect(summary.companies[0]).toMatchObject({
      whiteBoxCommission: 9_000,
      referralCommission: 900,
      supportManagerCommission: 900,
      companyRecognizedRevenue: 79_200,
    });
  });

  it("matches the WhiteBox 12 percent and manager 1 percent model for 56,000 rub turnover", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 11,
          companyName: "Manual finance check",
          price: 56_000,
          status: "EXPIRED",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-06-11T00:00:00.000Z",
          platformCommissionPercent: 12,
          supportManagerUserId: 15,
          supportManagerPercent: 1,
        },
      ],
      now,
    );

    expect(summary.recognizedGross).toBe(56_000);
    expect(summary.companies[0]).toMatchObject({
      commissionableRecognized: 56_000,
      supportManagerCommission: 560,
      whiteBoxCommission: 6_160,
      companyRecognizedRevenue: 49_280,
    });
  });

  it("disables commission during a company grace period", () => {
    const summary = calculatePlatformRevenueSummary(
      [
        {
          companyId: 9,
          companyName: "Launch partner",
          price: 300_000,
          status: "ACTIVE",
          activatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-07-01T00:00:00.000Z",
          platformCommissionPercent: 12,
          commissionFreeMonthlyTurnover: 50_000,
          commissionGraceEndsAt: "2026-07-01T00:00:00.000Z",
          referralPercent: 1,
          referralStatus: "ACTIVE",
          referrerUserId: 77,
        },
      ],
      now,
    );

    expect(summary.whiteBoxCommission).toBe(0);
    expect(summary.referralCommission).toBe(0);
    expect(summary.companyRecognizedRevenue).toBe(90_000);
  });
});
