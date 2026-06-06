import { AdminService } from "./admin.service";

describe("AdminService company workspace backup coverage", () => {
  it("includes operational company tables in snapshot collection", async () => {
    const modelKeys = [
      "user",
      "category",
      "company",
      "companyReferral",
      "companyLocation",
      "subscription",
      "subscriptionBundle",
      "subscriptionBundleParticipant",
      "userSubscriptionBundle",
      "subscriptionBundleRedemption",
      "companyCategory",
      "companyLevelRule",
      "companyMember",
      "companyPurchase",
      "userFavoriteCategory",
      "userProfilePreference",
      "userCompany",
      "userSubscription",
      "subscriptionEntitlement",
      "payment",
      "subscriptionRedemption",
      "promoCode",
      "promoCodeRedemption",
      "referralCampaign",
      "referralInvite",
      "refreshToken",
      "oAuthAccount",
      "loginEvent",
      "emailChangeRequest",
      "loyaltyTransaction",
      "financeOperation",
      "auditEvent",
      "adminTask",
    ] as const;
    const prisma = Object.fromEntries(
      modelKeys.map((key) => [key, { findMany: jest.fn().mockResolvedValue([{ source: key }]) }]),
    );
    const service = new AdminService(
      prisma as never,
      { get: jest.fn() } as never,
      { setRestoreStage: jest.fn() } as never,
    );

    const tables = await (
      service as unknown as { collectBackupRows(): Promise<Record<string, Array<{ source: string }>>> }
    ).collectBackupRows();

    expect(tables.CompanyMember).toEqual([{ source: "companyMember" }]);
    expect(tables.CompanyReferral).toEqual([{ source: "companyReferral" }]);
    expect(tables.CompanyPurchase).toEqual([{ source: "companyPurchase" }]);
    expect(tables.SubscriptionEntitlement).toEqual([{ source: "subscriptionEntitlement" }]);
    expect(tables.Payment).toEqual([{ source: "payment" }]);
    expect(tables.SubscriptionRedemption).toEqual([{ source: "subscriptionRedemption" }]);
    expect(tables.UserSubscriptionBundle).toEqual([{ source: "userSubscriptionBundle" }]);
    expect(tables.SubscriptionBundleRedemption).toEqual([{ source: "subscriptionBundleRedemption" }]);
    expect(tables.FinanceOperation).toEqual([{ source: "financeOperation" }]);
    expect(tables.AdminTask).toEqual([{ source: "adminTask" }]);
  });
});
