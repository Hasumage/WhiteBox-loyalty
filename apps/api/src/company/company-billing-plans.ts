import { CompanyBillingPlan } from "@prisma/client";

export type CompanyBillingFeatureSet = {
  hasWorkspaceAccess: boolean;
  hasAiAssistant: boolean;
  participatesInGiveaway: boolean;
  showsCompanyPageAds: boolean;
  canManageSpecialOffers: boolean;
  maxTeamMembers: number;
  maxLocations: number;
  maxLoyaltyLevels: number;
};

const GO_FEATURES: CompanyBillingFeatureSet = {
  hasWorkspaceAccess: true,
  hasAiAssistant: false,
  participatesInGiveaway: false,
  showsCompanyPageAds: true,
  canManageSpecialOffers: false,
  maxTeamMembers: 5,
  maxLocations: 2,
  maxLoyaltyLevels: 5,
};

const PRO_FEATURES: CompanyBillingFeatureSet = {
  ...GO_FEATURES,
  hasAiAssistant: true,
  participatesInGiveaway: true,
  showsCompanyPageAds: false,
  canManageSpecialOffers: true,
  maxTeamMembers: 25,
  maxLocations: 25,
  maxLoyaltyLevels: 10,
};

const MAX_FEATURES: CompanyBillingFeatureSet = {
  ...PRO_FEATURES,
  maxTeamMembers: 100,
  maxLocations: 100,
  maxLoyaltyLevels: 20,
};

export const COMPANY_BILLING_PLANS: Record<CompanyBillingPlan, CompanyBillingFeatureSet> = {
  [CompanyBillingPlan.GO]: GO_FEATURES,
  [CompanyBillingPlan.PRO]: PRO_FEATURES,
  [CompanyBillingPlan.MAX]: MAX_FEATURES,
};

export function companyBillingFeatures(plan: CompanyBillingPlan | null | undefined) {
  return COMPANY_BILLING_PLANS[plan ?? CompanyBillingPlan.GO];
}
