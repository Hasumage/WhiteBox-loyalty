import { calculateCompanyFinancialSnapshot, evaluatePayoutCoverage } from "./company-finance";

describe("company finance snapshot", () => {
  const now = new Date("2026-05-26T12:00:00.000Z");
  const startedAt = new Date("2026-05-25T00:00:00.000Z");

  it("retains expired earnings and separates recognized from future income", () => {
    const snapshot = calculateCompanyFinancialSnapshot(
      7,
      [
        {
          companyId: 7,
          name: "Coffee 10 days",
          price: 1000,
          status: "ACTIVE",
          activatedAt: startedAt,
          expiresAt: new Date("2026-06-04T00:00:00.000Z"),
        },
        {
          companyId: 7,
          name: "Completed pass",
          price: 500,
          status: "EXPIRED",
          activatedAt: new Date("2026-05-01T00:00:00.000Z"),
          expiresAt: new Date("2026-05-11T00:00:00.000Z"),
        },
      ],
      [],
      now,
    );

    expect(snapshot.recognizedRevenue).toBe(600);
    expect(snapshot.potentialRevenue).toBe(900);
    expect(snapshot.activeSubscriptions).toBe(1);
  });

  it("subtracts paid and reserved requests and evaluates the current request fairly", () => {
    const operation = { companyId: 7, type: "PAYOUT_REQUEST", status: "PENDING_APPROVAL", amount: 60 };
    const snapshot = calculateCompanyFinancialSnapshot(
      7,
      [
        {
          companyId: 7,
          name: "Daily earnings",
          price: 1000,
          status: "ACTIVE",
          activatedAt: startedAt,
          expiresAt: new Date("2026-06-04T00:00:00.000Z"),
        },
      ],
      [operation, { companyId: 7, type: "PAYOUT_REQUEST", status: "PAID", amount: 20 }],
      now,
    );

    expect(snapshot.availableForPayout).toBe(20);
    expect(evaluatePayoutCoverage(snapshot, operation)).toMatchObject({
      availableBeforeThisRequest: 80,
      requestCovered: true,
    });
  });
});
