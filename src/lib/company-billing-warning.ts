import type { CompanyBillingData } from "@/lib/api/company-client";

const DAY_MS = 24 * 60 * 60 * 1000;
const WARNING_DAYS = 3;

const TEXT = {
  today: "\u0441\u0435\u0433\u043e\u0434\u043d\u044f",
  dayOne: "\u0434\u0435\u043d\u044c",
  dayFew: "\u0434\u043d\u044f",
  dayMany: "\u0434\u043d\u0435\u0439",
  expiredTitle: "\u0410\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0430\u044f \u043f\u043b\u0430\u0442\u0430 \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u0430",
  expiredDescription:
    "\u041f\u0440\u043e\u0434\u043b\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f, \u0447\u0442\u043e\u0431\u044b \u043a\u043e\u043c\u0430\u043d\u0434\u0430 \u043c\u043e\u0433\u043b\u0430 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c \u0440\u0430\u0431\u043e\u0442\u0443 \u0431\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0439.",
  expiredShort: "\u041d\u0443\u0436\u043d\u043e \u043f\u0440\u043e\u0434\u043b\u0438\u0442\u044c \u0434\u043e\u0441\u0442\u0443\u043f",
  trialPeriod: "\u0422\u0435\u0441\u0442\u043e\u0432\u044b\u0439 \u043f\u0435\u0440\u0438\u043e\u0434",
  billingPeriod: "\u0410\u0431\u043e\u043d\u0435\u043d\u0442\u0441\u043a\u0430\u044f \u043f\u043b\u0430\u0442\u0430",
  ends: "\u0437\u0430\u043a\u043e\u043d\u0447\u0438\u0442\u0441\u044f",
  warningDescription:
    "\u041e\u043f\u043b\u0430\u0442\u0438\u0442\u0435 \u0437\u0430\u0440\u0430\u043d\u0435\u0435, \u0447\u0442\u043e\u0431\u044b \u043a\u0430\u0441\u0441\u0430, \u043a\u043e\u043c\u0430\u043d\u0434\u0430 \u0438 \u043a\u043b\u0438\u0435\u043d\u0442\u0441\u043a\u0438\u0439 \u0441\u0435\u0440\u0432\u0438\u0441 \u0440\u0430\u0431\u043e\u0442\u0430\u043b\u0438 \u0431\u0435\u0437 \u043f\u0430\u0443\u0437\u044b.",
  accessUntil: "\u0414\u043e\u0441\u0442\u0443\u043f \u0434\u043e",
  cta: "\u041f\u0440\u043e\u0434\u043b\u0438\u0442\u044c",
};

export type CompanyBillingWarning = {
  tone: "warning" | "danger";
  title: string;
  description: string;
  shortLabel: string;
  cta: string;
  daysLeft: number | null;
};

function formatDays(days: number) {
  if (days <= 0) return TEXT.today;
  const lastDigit = days % 10;
  const lastTwo = days % 100;
  if (lastDigit === 1 && lastTwo !== 11) return `${days} ${TEXT.dayOne}`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${days} ${TEXT.dayFew}`;
  return `${days} ${TEXT.dayMany}`;
}

export function getCompanyBillingWarning(billing?: CompanyBillingData | null): CompanyBillingWarning | null {
  const account = billing?.account;
  if (!account) return null;

  const targetDate = account.status === "TRIAL" ? account.trialEndsAt : account.currentPeriodEndsAt;
  const timeLeft = targetDate ? new Date(targetDate).getTime() - Date.now() : Number.NaN;
  const daysLeft = Number.isFinite(timeLeft) ? Math.ceil(timeLeft / DAY_MS) : null;
  const isExpired = account.status === "PAST_DUE" || account.status === "SUSPENDED" || (daysLeft !== null && daysLeft < 0);

  if (isExpired) {
    return {
      tone: "danger",
      title: TEXT.expiredTitle,
      description: TEXT.expiredDescription,
      shortLabel: TEXT.expiredShort,
      cta: TEXT.cta,
      daysLeft,
    };
  }

  if (daysLeft !== null && daysLeft <= WARNING_DAYS) {
    const periodLabel = account.status === "TRIAL" ? TEXT.trialPeriod : TEXT.billingPeriod;
    return {
      tone: "warning",
      title: `${periodLabel} ${TEXT.ends} ${formatDays(daysLeft)}`,
      description: TEXT.warningDescription,
      shortLabel: `${TEXT.accessUntil} ${formatDays(daysLeft)}`,
      cta: TEXT.cta,
      daysLeft,
    };
  }

  return null;
}
