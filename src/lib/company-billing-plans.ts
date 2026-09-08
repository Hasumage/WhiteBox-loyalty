import { CompanyBillingPlan } from "@prisma/client";

export type CompanyBillingFeatureSet = {
  canManageSpecialOffers: boolean;
};

export function companyBillingFeatures(plan: CompanyBillingPlan | null | undefined): CompanyBillingFeatureSet {
  if (plan === CompanyBillingPlan.PRO || plan === CompanyBillingPlan.MAX) {
    return { canManageSpecialOffers: true };
  }
  return { canManageSpecialOffers: false };
}
