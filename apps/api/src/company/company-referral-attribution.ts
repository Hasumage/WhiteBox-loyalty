import { AccountStatus, Prisma, UserRole } from "@prisma/client";

const SYSTEM_COMPANY_REFERRAL_SOURCE = "SYSTEM_SUPER_ADMIN";
const PROMO_COMPANY_REFERRAL_SOURCE = "PROMO_CODE";
const COMPANY_NEARLOY_REFERRAL_PERCENT = 30;

type PromoOwner = {
  id: number;
  role?: UserRole | string | null;
  accountStatus?: AccountStatus | string | null;
};

function isCompanyReferralCommissionable(referral?: {
  status?: string | null;
  source?: string | null;
  referrer?: { role?: UserRole | string | null } | null;
} | null) {
  if (!referral || referral.status !== "ACTIVE") return false;
  if (referral.source === SYSTEM_COMPANY_REFERRAL_SOURCE) return false;
  if (referral.referrer?.role === UserRole.SUPER_ADMIN) return false;
  return true;
}

export async function reassignCompanyReferralFromBillingPromo(params: {
  tx: Prisma.TransactionClient;
  companyId: number;
  promoCode?: string | null;
  promoCodeId?: string | null;
  promoOwner?: PromoOwner | null;
}) {
  let promoCode = params.promoCode ?? null;
  let promoOwner = params.promoOwner ?? null;

  if ((!promoCode || !promoOwner) && params.promoCodeId) {
    const promo = await params.tx.companyBillingPromoCode.findUnique({
      where: { id: params.promoCodeId },
      select: {
        code: true,
        createdBy: { select: { id: true, role: true, accountStatus: true } },
      },
    });
    promoCode = promo?.code ?? promoCode;
    promoOwner = promo?.createdBy ?? promoOwner;
  }

  if (!promoCode || !promoOwner || promoOwner.accountStatus !== AccountStatus.ACTIVE || promoOwner.role !== UserRole.MANAGER) {
    return { changed: false, reason: "PROMO_OWNER_IS_NOT_PR_MANAGER" };
  }

  const current = await params.tx.companyReferral.findUnique({
    where: { companyId: params.companyId },
    include: { referrer: { select: { id: true, role: true } } },
  });

  if (current && current.referrerUserId !== promoOwner.id && isCompanyReferralCommissionable(current)) {
    return { changed: false, reason: "COMPANY_ALREADY_HAS_PR_MANAGER" };
  }

  const data = {
    referrerUserId: promoOwner.id,
    status: "ACTIVE" as const,
    pipelineStatus: "CONNECTED" as const,
    source: PROMO_COMPANY_REFERRAL_SOURCE,
    referralPercent: new Prisma.Decimal(COMPANY_NEARLOY_REFERRAL_PERCENT),
    endedAt: null,
    notes: `Promo code ${promoCode} used for NearLoy billing.`,
  };

  if (current) {
    await params.tx.companyReferral.update({
      where: { companyId: params.companyId },
      data,
    });
    return { changed: true, reason: "REFERRAL_REASSIGNED_TO_PROMO_OWNER" };
  }

  await params.tx.companyReferral.create({
    data: {
      companyId: params.companyId,
      ...data,
    },
  });
  return { changed: true, reason: "PROMO_REFERRAL_CREATED" };
}
