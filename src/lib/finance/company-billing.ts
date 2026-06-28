export type CompanyBillingCalculationInput = {
  baseFee: number;
  promoDiscountPercent?: number;
};

export type CompanyBillingCalculation = {
  baseFee: number;
  promoDiscountPercent: number;
  promoDiscountAmount: number;
  discountedFee: number;
  generatedCommission: number;
  commissionCreditAmount: number;
  amountDue: number;
};

function money(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

export function calculateCompanyBilling(input: CompanyBillingCalculationInput): CompanyBillingCalculation {
  const baseFee = money(input.baseFee);
  const promoDiscountPercent = Math.min(100, Math.max(0, input.promoDiscountPercent ?? 0));
  const promoDiscountAmount = money(baseFee * (promoDiscountPercent / 100));
  const discountedFee = money(baseFee - promoDiscountAmount);

  return {
    baseFee,
    promoDiscountPercent,
    promoDiscountAmount,
    discountedFee,
    generatedCommission: 0,
    commissionCreditAmount: 0,
    amountDue: discountedFee,
  };
}

export function calculateMonthlyAccessSplit(paidAmount: number, hasReferralManager: boolean) {
  const referralPercent = hasReferralManager ? 30 : 0;
  const referralAmount = money(paidAmount * (referralPercent / 100));
  return {
    referralPercent,
    referralAmount,
    platformAmount: money(paidAmount - referralAmount),
  };
}

export function addUtcMonths(date: Date, months = 1) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export function addUtcDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
