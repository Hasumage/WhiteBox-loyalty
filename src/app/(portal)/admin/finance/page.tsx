"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  ChevronDown,
  CheckCircle2,
  CircleAlert,
  CircleCheckBig,
  ClipboardCheck,
  CreditCard,
  Info,
  Megaphone,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  adminListFinanceOperations,
  adminUpdateFinanceOperation,
  type AdminFinanceOperation,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

type StatusFilter = "ACTIONABLE" | "ALL" | AdminFinanceOperation["status"];
type TargetFilter = "ALL" | NonNullable<AdminFinanceOperation["payoutTarget"]>;
type ManualDraft = { method: string; reference: string; comment: string };
type YooKassaDraft = { destinationType: "bank_card" | "yoo_money"; cardNumber: string; yooMoneyWallet: string };

const ROW_TITLE_LIMIT = 48;
const ROW_COMPANY_LIMIT = 28;
const INSPECTOR_TITLE_LIMIT = 64;
const INSPECTOR_COMPANY_LIMIT = 36;

const defaultManualDraft: ManualDraft = { method: "Банковский перевод", reference: "", comment: "" };
const defaultYooKassaDraft: YooKassaDraft = { destinationType: "bank_card", cardNumber: "", yooMoneyWallet: "" };

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "ACTIONABLE", label: "К работе" },
  { value: "ALL", label: "Все" },
  { value: "PENDING_APPROVAL", label: "Апрув" },
  { value: "APPROVED", label: "Выплатить" },
  { value: "PAID", label: "Закрыты" },
  { value: "REJECTED", label: "Отклонены" },
  { value: "CANCELED", label: "Отменены" },
];

const targetFilters: Array<{ value: TargetFilter; label: string }> = [
  { value: "ALL", label: "Все" },
  { value: "COMPANY", label: "Компании" },
  { value: "PR_AGENT", label: "PR" },
  { value: "UNLINKED", label: "Без источника" },
];

const statusTone: Record<AdminFinanceOperation["status"], string> = {
  DRAFT: "border-white/15 bg-white/5 text-white",
  PENDING_APPROVAL: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  APPROVED: "border-cyan-300/25 bg-cyan-300/10 text-cyan-100",
  REJECTED: "border-red-300/25 bg-red-300/10 text-red-100",
  PAID: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  CANCELED: "border-white/15 bg-white/5 text-muted-foreground",
};

const statusOrder: Record<AdminFinanceOperation["status"], number> = {
  PENDING_APPROVAL: 0,
  APPROVED: 1,
  DRAFT: 2,
  REJECTED: 3,
  CANCELED: 4,
  PAID: 5,
};

function money(value: string | number, currency: string, locale: string) {
  return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function shortText(value: string | null | undefined, maxLength: number) {
  const text = value?.trim() || "—";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString(locale);
}

function templateKey(value: string) {
  return value.replace(/\s+[—–-]\s+/g, " — ").replace(/\s+/g, " ").trim();
}

const financeTemplateTranslations: Record<string, { ru: string; en: string }> = {
  "TEST PAYOUT — company pending approval": {
    ru: "Тестовая выплата компании — ждёт апрува",
    en: "Test company payout — pending approval",
  },
  "TEST PAYOUT — company ready for manual close": {
    ru: "Тестовая выплата компании — готова к ручному закрытию",
    en: "Test company payout — ready for manual close",
  },
  "TEST PAYOUT — company manually paid": {
    ru: "Тестовая выплата компании — закрыта вручную",
    en: "Test company payout — manually paid",
  },
  "TEST PAYOUT — company rejected": {
    ru: "Тестовая выплата компании — отклонена",
    en: "Test company payout — rejected",
  },
  "Company referral payout request: TEST PAYOUT — PR agent pending approval": {
    ru: "Тестовая PR-выплата агенту — ждёт апрува",
    en: "Test PR agent payout — pending approval",
  },
  "TEST PAYOUT — legacy unlinked payout": {
    ru: "Тестовая выплата — без источника",
    en: "Test payout — unlinked source",
  },
};

function financeText(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const translated = financeTemplateTranslations[templateKey(value)];
  if (translated) return locale.startsWith("ru") ? translated.ru : translated.en;
  if (!locale.startsWith("ru")) return value;
  return value
    .replaceAll("TEST PAYOUT", "Тестовая выплата")
    .replaceAll("Company referral payout request:", "PR-выплата:")
    .replaceAll("company pending approval", "компания ждёт апрува")
    .replaceAll("company ready for manual close", "компания готова к ручному закрытию")
    .replaceAll("company manually paid", "компания закрыта вручную")
    .replaceAll("company rejected", "компания отклонена")
    .replaceAll("PR agent pending approval", "PR-агент ждёт апрува")
    .replaceAll("legacy unlinked payout", "без источника");
}

function statusLabel(status: AdminFinanceOperation["status"]) {
  const labels: Record<AdminFinanceOperation["status"], string> = {
    DRAFT: "Черновик",
    PENDING_APPROVAL: "Апрув",
    APPROVED: "Выплатить",
    REJECTED: "Отклонено",
    PAID: "Выплачено",
    CANCELED: "Отменено",
  };
  return labels[status];
}

function providerStatusLabel(status: string | null) {
  if (!status) return "—";
  const labels: Record<string, string> = {
    pending: "ожидает",
    succeeded: "успешно",
    canceled: "отменено",
  };
  return labels[status] ?? status;
}

function TargetGlyph({ target, className }: { target?: AdminFinanceOperation["payoutTarget"]; className?: string }) {
  if (target === "COMPANY") return <Building2 className={className} />;
  if (target === "PR_AGENT") return <Megaphone className={className} />;
  return <CircleAlert className={className} />;
}

function targetLabel(item: AdminFinanceOperation) {
  if (item.payoutChecklist?.targetLabel) return item.payoutChecklist.targetLabel;
  if (item.company) return item.company.name;
  if (item.payoutTarget === "PR_AGENT") return item.requestedBy?.name ?? item.requestedBy?.email ?? "PR-агент";
  return "Без источника";
}

function coverageLabel(item: AdminFinanceOperation) {
  const covered = item.companySnapshot?.requestCovered ?? item.referralSnapshot?.requestCovered ?? null;
  if (covered === true) return "Покрыто";
  if (covered === false) return "Не покрыто";
  return "Сверить";
}

function rowPriority(item: AdminFinanceOperation) {
  const warningWeight = item.payoutChecklist?.warnings.length ? -1 : 0;
  return statusOrder[item.status] * 10 + warningWeight;
}

export default function AdminFinancePage() {
  const { locale } = useI18n("ru");
  const [items, setItems] = useState<AdminFinanceOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIONABLE");
  const [targetFilter, setTargetFilter] = useState<TargetFilter>("ALL");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [manualDrafts, setManualDrafts] = useState<Record<string, ManualDraft>>({});
  const [yooKassaDrafts, setYooKassaDrafts] = useState<Record<string, YooKassaDraft>>({});

  const stats = useMemo(() => {
    const pending = items.filter((item) => item.status === "PENDING_APPROVAL");
    const approved = items.filter((item) => item.status === "APPROVED");
    const warnings = items.filter((item) => (item.payoutChecklist?.warnings.length ?? 0) > 0);
    const providerPending = items.filter((item) => item.providerPayoutStatus === "pending");
    return {
      pendingCount: pending.length,
      pendingTotal: pending.reduce((sum, item) => sum + Number(item.amount), 0),
      approvedCount: approved.length,
      approvedTotal: approved.reduce((sum, item) => sum + Number(item.amount), 0),
      providerPendingCount: providerPending.length,
      warningCount: warnings.length,
    };
  }, [items]);

  const filteredItems = useMemo(
    () =>
      [...items]
        .filter((item) => {
          const actionable = item.status === "PENDING_APPROVAL" || item.status === "APPROVED";
          const statusMatches =
            statusFilter === "ACTIONABLE" ? actionable : statusFilter === "ALL" || item.status === statusFilter;
          const targetMatches = targetFilter === "ALL" || item.payoutTarget === targetFilter;
          return statusMatches && targetMatches;
        })
        .sort((left, right) => rowPriority(left) - rowPriority(right) || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [items, statusFilter, targetFilter],
  );

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.uuid === selectedUuid) ?? filteredItems[0] ?? null,
    [filteredItems, selectedUuid],
  );

  async function load() {
    setLoading(true);
    const result = await adminListFinanceOperations();
    if (result.ok) {
      setItems(result.data.items);
      setMessage("");
    } else {
      setMessage(result.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedUuid && filteredItems[0]) {
      setSelectedUuid(filteredItems[0].uuid);
      return;
    }
    if (selectedUuid && filteredItems.length > 0 && !filteredItems.some((item) => item.uuid === selectedUuid)) {
      setSelectedUuid(filteredItems[0].uuid);
    }
  }, [filteredItems, selectedUuid]);

  function updateManualDraft(uuid: string, patch: Partial<ManualDraft>) {
    setManualDrafts((current) => ({
      ...current,
      [uuid]: { ...(current[uuid] ?? defaultManualDraft), ...patch },
    }));
  }

  function updateYooKassaDraft(uuid: string, patch: Partial<YooKassaDraft>) {
    setYooKassaDrafts((current) => ({
      ...current,
      [uuid]: { ...(current[uuid] ?? defaultYooKassaDraft), ...patch },
    }));
  }

  async function setStatus(uuid: string, status: AdminFinanceOperation["status"]) {
    setMessage("");
    const result = await adminUpdateFinanceOperation(uuid, status);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  async function closeManually(item: AdminFinanceOperation) {
    const draft = manualDrafts[item.uuid] ?? defaultManualDraft;
    if (!draft.reference.trim() && !draft.comment.trim()) {
      setMessage("Для ручного закрытия укажите референс перевода или короткий комментарий.");
      return;
    }
    setMessage("");
    const result = await adminUpdateFinanceOperation(item.uuid, {
      status: "PAID",
      payoutMode: "MANUAL",
      manualMethod: draft.method,
      manualReference: draft.reference,
      manualComment: draft.comment,
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  async function sendYooKassaPayout(item: AdminFinanceOperation) {
    const draft = yooKassaDrafts[item.uuid] ?? defaultYooKassaDraft;
    if (draft.destinationType === "bank_card" && !draft.cardNumber.trim()) {
      setMessage("Введите номер тестовой карты для YooKassa.");
      return;
    }
    if (draft.destinationType === "yoo_money" && !draft.yooMoneyWallet.trim()) {
      setMessage("Введите номер кошелька ЮMoney.");
      return;
    }
    setMessage("");
    const result = await adminUpdateFinanceOperation(item.uuid, {
      status: "PAID",
      payoutMode: "YOOKASSA",
      destinationType: draft.destinationType,
      cardNumber: draft.destinationType === "bank_card" ? draft.cardNumber : undefined,
      yooMoneyWallet: draft.destinationType === "yoo_money" ? draft.yooMoneyWallet : undefined,
    });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  async function syncYooKassaPayout(item: AdminFinanceOperation) {
    setMessage("");
    const result = await adminUpdateFinanceOperation(item.uuid, { providerAction: "SYNC" });
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-white/10 bg-card/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Banknote className="h-5 w-5 text-cyan-100" />
              Финансовые операции
            </h1>
            <StatusPill label="Апрув" value={`${stats.pendingCount} · ${money(stats.pendingTotal, "RUB", locale)}`} tone="amber" />
            <StatusPill label="К выплате" value={`${stats.approvedCount} · ${money(stats.approvedTotal, "RUB", locale)}`} tone="cyan" />
            <StatusPill label="YooKassa" value={`${stats.providerPendingCount} ждут`} tone="purple" />
            <StatusPill label="Риски" value={String(stats.warningCount)} tone="red" />
          </div>
          <Button size="sm" variant="secondary" onClick={() => load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" /> Обновить
          </Button>
        </div>
      </section>

      {message && <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] p-3 text-sm text-amber-50">{message}</div>}

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-card/70">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex flex-wrap gap-1.5">
              {statusFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={statusFilter === filter.value ? "secondary" : "ghost"}
                  className="h-8 rounded-full px-3"
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {targetFilters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={targetFilter === filter.value ? "secondary" : "ghost"}
                  className="h-8 rounded-full px-3"
                  onClick={() => setTargetFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="finance-scroll overflow-x-hidden">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[35%]" />
                <col className="w-[25%]" />
                <col className="w-[14%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
              </colgroup>
              <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Что сделать</th>
                  <th className="px-3 py-2 font-medium">Источник</th>
                  <th className="px-3 py-2 font-medium">Сумма</th>
                  <th className="px-3 py-2 font-medium">Провайдер</th>
                  <th className="px-3 py-2 font-medium">Создано</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Загружаю выплаты…
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Выплат по этим условиям нет.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <FinanceRow
                      key={item.uuid}
                      item={item}
                      locale={locale}
                      selected={selectedItem?.uuid === item.uuid}
                      onSelect={() => setSelectedUuid(item.uuid)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="finance-scroll min-w-0 rounded-2xl border border-cyan-300/15 bg-card/80 xl:sticky xl:top-3 xl:max-h-[calc(100vh-1.5rem)] xl:overflow-y-auto">
          {selectedItem ? (
            <OperationInspector
              item={selectedItem}
              locale={locale}
              manualDraft={manualDrafts[selectedItem.uuid] ?? defaultManualDraft}
              yooKassaDraft={yooKassaDrafts[selectedItem.uuid] ?? defaultYooKassaDraft}
              onManualDraftChange={(patch) => updateManualDraft(selectedItem.uuid, patch)}
              onYooKassaDraftChange={(patch) => updateYooKassaDraft(selectedItem.uuid, patch)}
              onApprove={() => setStatus(selectedItem.uuid, "APPROVED")}
              onReject={() => setStatus(selectedItem.uuid, "REJECTED")}
              onCancel={() => setStatus(selectedItem.uuid, "CANCELED")}
              onManualClose={() => closeManually(selectedItem)}
              onYooKassaPayout={() => sendYooKassaPayout(selectedItem)}
              onYooKassaSync={() => syncYooKassaPayout(selectedItem)}
            />
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Выберите операцию слева.</div>
          )}
        </aside>
      </section>

      <style jsx global>{`
        .finance-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(103, 232, 249, 0.4) rgba(255, 255, 255, 0.04);
        }

        .finance-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .finance-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 999px;
        }

        .finance-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(103, 232, 249, 0.62), rgba(168, 85, 247, 0.42));
          border: 2px solid rgba(5, 8, 12, 0.92);
          border-radius: 999px;
        }

        .finance-scroll::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "amber" | "cyan" | "red" | "purple" | "muted";
}) {
  const toneClass = {
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-50",
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-50",
    red: "border-red-300/20 bg-red-300/10 text-red-50",
    purple: "border-violet-300/20 bg-violet-300/10 text-violet-50",
    muted: "border-white/10 bg-white/[0.04] text-muted-foreground",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClass}`}>
      <span className="uppercase tracking-[0.18em] opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function FinanceRow({
  item,
  locale,
  selected,
  onSelect,
}: {
  item: AdminFinanceOperation;
  locale: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const warnings = item.payoutChecklist?.warnings.length ?? 0;
  const blocked = item.companySnapshot?.requestCovered === false || item.referralSnapshot?.requestCovered === false || item.payoutTarget === "UNLINKED";
  const title = financeText(item.title, locale);
  const target = targetLabel(item);

  return (
    <tr
      className={`cursor-pointer border-b border-white/8 transition hover:bg-white/[0.04] ${
        selected ? "bg-cyan-300/[0.07] ring-1 ring-inset ring-cyan-300/20" : ""
      }`}
      onClick={onSelect}
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Badge className={`border ${statusTone[item.status]}`}>{statusLabel(item.status)}</Badge>
          {warnings > 0 && (
            <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">
              <AlertTriangle className="mr-1 h-3 w-3" /> {warnings}
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate font-medium" title={title}>
          {shortText(title, ROW_TITLE_LIMIT)}
        </p>
      </td>
      <td className="px-3 py-2.5">
        <p className="flex min-w-0 items-center gap-1.5 truncate" title={target}>
          <TargetGlyph target={item.payoutTarget} className="h-4 w-4 shrink-0 text-cyan-100" />
          <span className="truncate">{shortText(target, ROW_COMPANY_LIMIT)}</span>
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground" title={item.requestedBy?.email ?? undefined}>
          {shortText(item.requestedBy?.email ?? "система", 32)}
        </p>
      </td>
      <td className="px-3 py-2.5 font-semibold">{money(item.amount, item.currency, locale)}</td>
      <td className="px-3 py-2.5">
        {item.providerPayoutId ? (
          <div className="space-y-1">
            <Badge className="border-violet-300/25 bg-violet-300/10 text-violet-100">YooKassa · {providerStatusLabel(item.providerPayoutStatus)}</Badge>
            <p className="max-w-[150px] truncate text-xs text-muted-foreground">{item.providerPayoutId}</p>
          </div>
        ) : (
          <span className={blocked ? "text-red-100" : "text-emerald-100"}>{coverageLabel(item)}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString(locale)}</td>
    </tr>
  );
}

function OperationInspector({
  item,
  locale,
  manualDraft,
  yooKassaDraft,
  onManualDraftChange,
  onYooKassaDraftChange,
  onApprove,
  onReject,
  onCancel,
  onManualClose,
  onYooKassaPayout,
  onYooKassaSync,
}: {
  item: AdminFinanceOperation;
  locale: string;
  manualDraft: ManualDraft;
  yooKassaDraft: YooKassaDraft;
  onManualDraftChange: (patch: Partial<ManualDraft>) => void;
  onYooKassaDraftChange: (patch: Partial<YooKassaDraft>) => void;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  onManualClose: () => void;
  onYooKassaPayout: () => void;
  onYooKassaSync: () => void;
}) {
  const canApprove = item.payoutChecklist?.canApprove ?? item.payoutTarget !== "UNLINKED";
  const canMarkPaid = item.payoutChecklist?.canMarkPaid ?? item.payoutTarget !== "UNLINKED";
  const title = financeText(item.title, locale);
  const target = targetLabel(item);

  return (
    <div className="space-y-3 p-4">
      <header className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`border ${statusTone[item.status]}`}>{statusLabel(item.status)}</Badge>
              <Badge variant="outline" className="gap-1">
                <TargetGlyph target={item.payoutTarget} className="h-3.5 w-3.5" />
                {item.payoutTarget ?? "SOURCE"}
              </Badge>
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold leading-tight" title={target}>
              {shortText(target, INSPECTOR_COMPANY_LIMIT)}
            </h2>
            <p className="mt-1 truncate text-sm text-muted-foreground" title={title}>
              {shortText(title, INSPECTOR_TITLE_LIMIT)}
            </p>
          </div>
          <p className="shrink-0 text-right text-xl font-semibold">{money(item.amount, item.currency, locale)}</p>
        </div>
        <p className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-sm text-muted-foreground">
          {financeText(item.payoutChecklist?.nextAction ?? "Проверьте операцию перед решением.", locale)}
        </p>
      </header>

      <CompactCoverage item={item} locale={locale} />
      <CompactChecklist item={item} locale={locale} />

      <PayoutInfoDetails item={item} locale={locale} />

      <div className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-3">
        <p className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-4 w-4 text-cyan-100" /> Решение
        </p>
        <div className="flex flex-wrap gap-2">
          {item.status === "PENDING_APPROVAL" && (
            <>
              <Button size="sm" variant="secondary" disabled={!canApprove} onClick={onApprove}>
                <CircleCheckBig className="mr-2 h-4 w-4" /> Одобрить
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject}>
                <XCircle className="mr-2 h-4 w-4" /> Отклонить
              </Button>
            </>
          )}
          {item.status === "APPROVED" && (
            <Button size="sm" variant="outline" onClick={onCancel}>
              Отменить
            </Button>
          )}
          {item.status !== "PENDING_APPROVAL" && item.status !== "APPROVED" && (
            <p className="text-sm text-muted-foreground">Активных действий нет.</p>
          )}
        </div>
      </div>

      {(item.status === "APPROVED" || item.providerPayoutId) && (
        <YooKassaPanel
          item={item}
          draft={yooKassaDraft}
          canMarkPaid={canMarkPaid}
          onDraftChange={onYooKassaDraftChange}
          onPayout={onYooKassaPayout}
          onSync={onYooKassaSync}
        />
      )}

      {item.status === "APPROVED" && (
        <ManualClosePanel
          draft={manualDraft}
          canMarkPaid={canMarkPaid}
          onDraftChange={onManualDraftChange}
          onManualClose={onManualClose}
        />
      )}
    </div>
  );
}

function PayoutInfoDetails({ item, locale }: { item: AdminFinanceOperation; locale: string }) {
  const title = financeText(item.title, locale);
  const details = financeText(item.details, locale);
  const target = targetLabel(item);
  const company = item.company;
  const requisites = item.payoutChecklist?.requisites;
  const isPrPayout = item.payoutChecklist?.target === "PR_AGENT";
  const requestedBy = item.requestedBy ? `${item.requestedBy.name} · ${item.requestedBy.email}` : "система";
  const approvedBy = item.approvedBy ? `${item.approvedBy.name} · ${item.approvedBy.email}` : "—";

  return (
    <details className="group rounded-xl border border-white/10 bg-black/15 p-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-muted-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Info className="h-4 w-4 text-cyan-100" />
          Выплата и компания
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>

      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Выплата</p>
          <div className="space-y-1.5 text-xs">
            <MiniLine label="Название" value={title} />
            <MiniLine label="UUID" value={item.uuid} />
            <MiniLine label="Тип" value={item.type} />
            <MiniLine label="Статус" value={statusLabel(item.status)} />
            <MiniLine label="Создана" value={formatDateTime(item.createdAt, locale)} />
            <MiniLine label="Запрошена" value={formatDateTime(item.requestedAt, locale)} />
            <MiniLine label="Одобрена" value={formatDateTime(item.approvedAt, locale)} />
            <MiniLine label="Закрыта" value={formatDateTime(item.processedAt, locale)} />
            <MiniLine label="Создал" value={requestedBy} />
            <MiniLine label="Апрув" value={approvedBy} />
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Компания / источник</p>
          <div className="space-y-1.5 text-xs">
            <MiniLine label="Источник" value={target} />
            {isPrPayout ? (
              <>
                <MiniLine label="PR-менеджер" value={requestedBy} />
                <MiniLine label="Банк" value={requisites?.bankName ?? "—"} />
                <MiniLine label="Телефон" value={requisites?.phone ?? "—"} />
                <MiniLine label="Карта" value={requisites?.cardMasked ?? "—"} />
              </>
            ) : (
              <>
                <MiniLine label="Компания" value={company?.name ?? "—"} />
                <MiniLine label="Slug" value={company?.slug ?? "—"} />
                <MiniLine label="Банк" value={company?.payoutBankName ?? "—"} />
                <MiniLine label="БИК" value={company?.payoutBik ?? "—"} />
                <MiniLine label="Счёт" value={requisites?.accountMasked ?? "—"} />
                <MiniLine label="Корр. счёт" value={requisites?.correspondentAccountMasked ?? "—"} />
              </>
            )}
          </div>
        </div>

        {item.details && (
          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">История</p>
            <p className="whitespace-pre-line text-muted-foreground">{details}</p>
          </div>
        )}
      </div>
    </details>
  );
}

function YooKassaPanel({
  item,
  draft,
  canMarkPaid,
  onDraftChange,
  onPayout,
  onSync,
}: {
  item: AdminFinanceOperation;
  draft: YooKassaDraft;
  canMarkPaid: boolean;
  onDraftChange: (patch: Partial<YooKassaDraft>) => void;
  onPayout: () => void;
  onSync: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-violet-300/20 bg-violet-300/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4 text-violet-100" /> YooKassa payout
        </p>
        {item.providerPayoutId ? (
          <Badge className="border-violet-300/25 bg-violet-300/10 text-violet-100">{providerStatusLabel(item.providerPayoutStatus)}</Badge>
        ) : (
          <Badge variant="outline">тестовый шлюз</Badge>
        )}
      </div>

      {item.providerPayoutId ? (
        <div className="space-y-2 text-sm">
          <MiniLine label="ID выплаты" value={item.providerPayoutId} />
          <MiniLine label="Куда" value={item.payoutDestinationLabel ?? "—"} />
          <MiniLine label="Синхронизировано" value={item.payoutProviderSyncedAt ? new Date(item.payoutProviderSyncedAt).toLocaleString("ru-RU") : "—"} />
          <Button size="sm" variant="secondary" className="w-full" onClick={onSync}>
            <RotateCw className="mr-2 h-4 w-4" /> Проверить статус YooKassa
          </Button>
        </div>
      ) : (
        <>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted-foreground">Куда отправляем</span>
            <select
              className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-200/40"
              value={draft.destinationType}
              onChange={(event) => onDraftChange({ destinationType: event.target.value as YooKassaDraft["destinationType"] })}
            >
              <option value="bank_card">Тестовая карта</option>
              <option value="yoo_money">Кошелёк ЮMoney</option>
            </select>
          </label>
          {draft.destinationType === "bank_card" ? (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Номер тестовой карты</span>
              <input
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-200/40"
                value={draft.cardNumber}
                inputMode="numeric"
                maxLength={23}
                placeholder="5555555555554477"
                onChange={(event) => onDraftChange({ cardNumber: event.target.value })}
              />
            </label>
          ) : (
            <label className="block space-y-1.5 text-sm">
              <span className="text-muted-foreground">Кошелёк ЮMoney</span>
              <input
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-violet-200/40"
                value={draft.yooMoneyWallet}
                inputMode="numeric"
                maxLength={32}
                placeholder="41001..."
                onChange={(event) => onDraftChange({ yooMoneyWallet: event.target.value })}
              />
            </label>
          )}
          <p className="text-xs leading-5 text-muted-foreground">
            Полный номер карты не сохраняем: в БД уходит только ID выплаты, статус провайдера и маска направления.
          </p>
          <Button className="w-full" disabled={!canMarkPaid} onClick={onPayout}>
            <Send className="mr-2 h-4 w-4" /> Отправить через YooKassa
          </Button>
        </>
      )}
    </div>
  );
}

function ManualClosePanel({
  draft,
  canMarkPaid,
  onDraftChange,
  onManualClose,
}: {
  draft: ManualDraft;
  canMarkPaid: boolean;
  onDraftChange: (patch: Partial<ManualDraft>) => void;
  onManualClose: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3">
      <p className="flex items-center gap-2 font-semibold">
        <ClipboardCheck className="h-4 w-4 text-cyan-100" /> Закрыть вручную
      </p>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">Способ</span>
        <input
          className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-cyan-200/40"
          value={draft.method}
          maxLength={80}
          onChange={(event) => onDraftChange({ method: event.target.value })}
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">Референс / номер платёжки</span>
        <input
          className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 outline-none focus:border-cyan-200/40"
          value={draft.reference}
          maxLength={120}
          placeholder="SBP-2026-07-08-001"
          onChange={(event) => onDraftChange({ reference: event.target.value })}
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="text-muted-foreground">Комментарий</span>
        <textarea
          className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none focus:border-cyan-200/40"
          value={draft.comment}
          maxLength={1000}
          placeholder="Что сверили и где подтверждение."
          onChange={(event) => onDraftChange({ comment: event.target.value })}
        />
      </label>
      <Button className="w-full" disabled={!canMarkPaid} onClick={onManualClose}>
        <CheckCircle2 className="mr-2 h-4 w-4" /> Подтвердить ручную выплату
      </Button>
    </div>
  );
}

function CompactCoverage({ item, locale }: { item: AdminFinanceOperation; locale: string }) {
  if (item.companySnapshot) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Доступно" value={money(item.companySnapshot.availableBeforeThisRequest, item.currency, locale)} />
        <MiniMetric label="Заявка" value={money(item.amount, item.currency, locale)} />
        <MiniMetric label="Резерв" value={money(item.companySnapshot.reservedPayouts, item.currency, locale)} />
        <MiniMetric label="Подписок" value={String(item.companySnapshot.activeSubscriptions)} />
      </div>
    );
  }
  if (item.referralSnapshot) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Доступно PR" value={money(item.referralSnapshot.availableBeforeThisRequest, item.currency, locale)} />
        <MiniMetric label="Заявка" value={money(item.amount, item.currency, locale)} />
        <MiniMetric label="Резерв" value={money(item.referralSnapshot.reserved, item.currency, locale)} />
        <MiniMetric label="Компаний" value={`${item.referralSnapshot.activeCompanies}/${item.referralSnapshot.companies}`} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-red-300/15 bg-red-300/[0.04] p-3 text-sm text-muted-foreground">
      Источник выплаты не найден.
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}

function CompactChecklist({ item, locale }: { item: AdminFinanceOperation; locale: string }) {
  const requisites = item.payoutChecklist?.requisites;
  const warnings = item.payoutChecklist?.warnings ?? [];
  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-black/15 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-cyan-100" /> Чеклист
        </p>
        {warnings.length > 0 ? (
          <Badge className="border-amber-300/25 bg-amber-300/10 text-amber-100">{warnings.length} риск</Badge>
        ) : (
          <Badge className="border-emerald-300/25 bg-emerald-300/10 text-emerald-100">Ок</Badge>
        )}
      </div>
      {requisites && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Requisite label="Банк" value={requisites.bankName} />
          <Requisite label="БИК" value={requisites.bik} />
          <Requisite label="Телефон" value={requisites.phone ?? null} />
          <Requisite label="Счёт" value={requisites.accountMasked} />
          <Requisite label="Карта" value={requisites.cardMasked ?? (requisites.cardLast4 ? `•••• ${requisites.cardLast4}` : null)} />
        </div>
      )}
      {warnings.length > 0 && (
        <div className="space-y-1.5">
          {warnings.map((warning) => (
            <p key={warning} className="rounded-lg border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-2 text-xs text-amber-50">
              {financeText(warning, locale)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function Requisite({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="max-w-[220px] truncate text-right font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}
