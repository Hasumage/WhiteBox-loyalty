import type { FinanceOperationStatus } from "@prisma/client";
import { COMPANY_REFERRAL_PAYOUT_TITLE } from "@/lib/company-referrals/company-referrals";
import { maskCard, maskPhone, prPayoutBankName } from "@/lib/pr-payout/requisites";

export type PayoutTarget = "COMPANY" | "PR_AGENT" | "UNLINKED";

export type PayoutChecklist = {
  target: PayoutTarget;
  targetLabel: string;
  settlementMode: "MANUAL_OR_YOOKASSA";
  providerLabel: string;
  nextAction: string;
  canApprove: boolean;
  canMarkPaid: boolean;
  requiresManualReference: boolean;
  warnings: string[];
  requisites: {
    bankCode?: string | null;
    bankName: string | null;
    bik: string | null;
    accountMasked: string | null;
    correspondentAccountMasked: string | null;
    cardLast4: string | null;
    cardMasked?: string | null;
    phone?: string | null;
  } | null;
};

type PayoutItem = {
  type: string;
  status: FinanceOperationStatus | string;
  title: string;
  companyId: number | null;
  requestedById: number | null;
  company?: {
    name: string;
    payoutBankName?: string | null;
    payoutBik?: string | null;
    payoutAccount?: string | null;
    payoutCorrespondentAccount?: string | null;
    payoutCardLast4?: string | null;
  } | null;
  requestedBy?: {
    name: string;
    email: string;
    prPayoutBankName?: string | null;
    prPayoutBankCode?: string | null;
    prPayoutPhone?: string | null;
    prPayoutCardLast4?: string | null;
  } | null;
};

type Coverage = { requestCovered: boolean | null } | null | undefined;

export function isReferralPayout(item: Pick<PayoutItem, "companyId" | "requestedById" | "title" | "type">) {
  return (
    item.type === "PAYOUT_REQUEST" &&
    !item.companyId &&
    Boolean(item.requestedById) &&
    item.title.startsWith(COMPANY_REFERRAL_PAYOUT_TITLE)
  );
}

export function resolvePayoutTarget(item: Pick<PayoutItem, "companyId" | "requestedById" | "title" | "type">): PayoutTarget {
  if (item.companyId) return "COMPANY";
  if (isReferralPayout(item)) return "PR_AGENT";
  return "UNLINKED";
}

function maskTail(value: string | null | undefined, visible = 4) {
  if (!value) return null;
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= visible) return compact;
  return `${"•".repeat(Math.min(8, compact.length - visible))}${compact.slice(-visible)}`;
}

function hasCompanyRequisites(item: PayoutItem) {
  return Boolean(
    item.company?.payoutBankName ||
      item.company?.payoutBik ||
      item.company?.payoutAccount ||
      item.company?.payoutCorrespondentAccount ||
      item.company?.payoutCardLast4,
  );
}

function hasPrRequisites(item: PayoutItem) {
  return Boolean(item.requestedBy?.prPayoutBankName && (item.requestedBy.prPayoutPhone || item.requestedBy.prPayoutCardLast4));
}

export function buildPayoutChecklist(
  item: PayoutItem,
  companyCoverage?: Coverage,
  referralCoverage?: Coverage,
): PayoutChecklist {
  const target = resolvePayoutTarget(item);
  const warnings: string[] = [];
  const covered = target === "COMPANY" ? companyCoverage?.requestCovered : target === "PR_AGENT" ? referralCoverage?.requestCovered : false;

  if (target === "COMPANY" && !hasCompanyRequisites(item)) {
    warnings.push("У компании не заполнены реквизиты. Для ручной выплаты реквизиты обязательны.");
  }
  if (target === "PR_AGENT" && !hasPrRequisites(item)) {
    warnings.push("У PR-менеджера не заполнены реквизиты для выплаты.");
  }
  if (target === "UNLINKED") {
    warnings.push("Заявка не привязана к балансу компании или PR-агента.");
  }
  if (covered === false) {
    warnings.push("Заявка не покрыта доступным заработанным балансом.");
  }

  const canMoveMoney = target !== "UNLINKED" && covered !== false;
  const targetLabel =
    target === "COMPANY"
      ? item.company?.name ?? "Компания"
      : target === "PR_AGENT"
        ? item.requestedBy?.name ?? item.requestedBy?.email ?? "PR-агент"
        : "Непривязанная операция";

  return {
    target,
    targetLabel,
    settlementMode: "MANUAL_OR_YOOKASSA",
    providerLabel: "YooKassa payouts или ручное закрытие",
    nextAction:
      item.status === "PENDING_APPROVAL"
        ? "Проверьте покрытие и источник выплаты, затем одобрите заявку."
        : item.status === "APPROVED"
          ? "Отправьте выплату через тестовый шлюз YooKassa или закройте вручную после фактического перевода."
          : "Операция завершена или не требует выплаты.",
    canApprove: canMoveMoney && item.status === "PENDING_APPROVAL",
    canMarkPaid: canMoveMoney && (item.status === "APPROVED" || item.status === "PENDING_APPROVAL"),
    requiresManualReference: true,
    warnings,
    requisites:
      target === "COMPANY"
        ? {
            bankCode: null,
            bankName: item.company?.payoutBankName ?? null,
            bik: item.company?.payoutBik ?? null,
            accountMasked: maskTail(item.company?.payoutAccount),
            correspondentAccountMasked: maskTail(item.company?.payoutCorrespondentAccount),
            cardLast4: item.company?.payoutCardLast4 ?? null,
            cardMasked: maskCard(item.company?.payoutCardLast4),
            phone: null,
          }
        : target === "PR_AGENT"
          ? {
              bankCode: item.requestedBy?.prPayoutBankCode ?? null,
              bankName: item.requestedBy?.prPayoutBankName ?? prPayoutBankName(item.requestedBy?.prPayoutBankCode),
              bik: null,
              accountMasked: null,
              correspondentAccountMasked: null,
              cardLast4: item.requestedBy?.prPayoutCardLast4 ?? null,
              cardMasked: maskCard(item.requestedBy?.prPayoutCardLast4),
              phone: maskPhone(item.requestedBy?.prPayoutPhone),
            }
          : null,
  };
}

export function appendFinanceDecisionNote(
  details: string | null,
  note: {
    status: FinanceOperationStatus;
    actorEmail: string;
    decidedAt: Date;
    manualMethod?: string | null;
    manualReference?: string | null;
    manualComment?: string | null;
  },
) {
  const lines = [
    `[Finance decision ${note.decidedAt.toISOString()}]`,
    `Status: ${note.status}`,
    `Actor: ${note.actorEmail}`,
  ];
  if (note.manualMethod) lines.push(`Method: ${note.manualMethod}`);
  if (note.manualReference) lines.push(`Reference: ${note.manualReference}`);
  if (note.manualComment) lines.push(`Comment: ${note.manualComment}`);
  return [details?.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
}
