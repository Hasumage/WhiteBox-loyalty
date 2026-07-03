"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Plus,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Filter,
  RefreshCcw,
  Search,
  ShieldAlert,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateTask,
  adminGetTasksBoard,
  adminUpdateTask,
  type AdminTaskBoardRow,
  type AdminTaskPriority,
  type AdminTaskSource,
  type AdminTaskStatus,
  type AdminTasksBoardResponse,
} from "@/lib/api/admin-client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type KanbanColumnId = "OPEN" | "IN_PROGRESS" | "IT_IN_PROGRESS" | "RESOLVED";
type TaskMutationAction = "start" | "resolve" | "reopen" | "archive" | "assign";

const statusColumns: Array<{ id: KanbanColumnId; title: TranslationKey; hint: TranslationKey }> = [
  { id: "OPEN", title: "admin.task.statusOpen", hint: "admin.tasks.columnOpenHint" },
  { id: "IN_PROGRESS", title: "admin.task.statusInProgress", hint: "admin.tasks.columnProgressHint" },
  { id: "IT_IN_PROGRESS", title: "admin.tasks.statusItInProgress", hint: "admin.tasks.columnItHint" },
  { id: "RESOLVED", title: "admin.task.statusResolved", hint: "admin.tasks.columnResolvedHint" },
];

const priorityOrder: Record<AdminTaskPriority, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };

const sourceLabels: Record<AdminTaskSource, TranslationKey> = {
  AUDIT: "admin.tasks.sourceAudit",
  COMPANY_VERIFICATION: "admin.tasks.sourceVerification",
  FINANCE: "admin.tasks.sourceFinance",
};

const priorityLabels: Record<AdminTaskPriority, TranslationKey> = {
  NORMAL: "admin.dashboard.priorityNormal",
  HIGH: "admin.dashboard.priorityHigh",
  CRITICAL: "admin.dashboard.priorityCritical",
};

const sourceIcons = {
  AUDIT: ShieldAlert,
  COMPANY_VERIFICATION: BadgeCheck,
  FINANCE: WalletCards,
} satisfies Record<AdminTaskSource, typeof ShieldAlert>;

const departmentOptions: Array<{ value: string; label: TranslationKey }> = [
  { value: "ALL", label: "admin.tasks.allDepartments" },
  { value: "finance", label: "admin.tasks.departmentFinance" },
  { value: "operations", label: "admin.tasks.departmentOperations" },
  { value: "system", label: "admin.tasks.departmentSystem" },
  { value: "growth", label: "admin.tasks.departmentGrowth" },
];

const audienceOptions: Array<{ value: string; label: TranslationKey }> = [
  { value: "ALL", label: "admin.tasks.allMenus" },
  { value: "admin", label: "admin.tasks.menuAdmin" },
  { value: "manager", label: "admin.tasks.menuManager" },
  { value: "pr", label: "admin.tasks.menuPr" },
];

const createSourceOptions: Array<{ value: AdminTaskSource; label: TranslationKey }> = [
  { value: "AUDIT", label: "admin.tasks.sourceAudit" },
  { value: "COMPANY_VERIFICATION", label: "admin.tasks.sourceVerification" },
  { value: "FINANCE", label: "admin.tasks.sourceFinance" },
];

const alertMenuLabels: Record<AdminTaskBoardRow["audience"], TranslationKey> = {
  admin: "admin.tasks.menuAdminShort",
  manager: "admin.tasks.menuManager",
  pr: "admin.tasks.menuPrShort",
};

function priorityTone(priority: AdminTaskPriority) {
  if (priority === "CRITICAL") return "border-red-300/30 bg-red-300/10 text-red-100";
  if (priority === "HIGH") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
}

function statusTone(status: AdminTaskStatus) {
  if (status === "RESOLVED") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "IN_PROGRESS") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-white/[0.05] text-muted-foreground";
}

function formatDate(value: string, locale: "en" | "ru") {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function taskMatches(task: AdminTaskBoardRow, query: string) {
  if (!query.trim()) return true;
  const haystack = `${task.title} ${task.description ?? ""} ${task.sourceKey} ${task.assignedTo?.name ?? ""}`.toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function criticalKindKey(task: AdminTaskBoardRow): TranslationKey {
  const haystack = `${task.title} ${task.description ?? ""} ${task.sourceKey}`.toLowerCase();
  if (task.source === "FINANCE") return "admin.tasks.kindFinancePayout";
  if (haystack.includes("payment") || haystack.includes("yookassa") || haystack.includes("\u043e\u043f\u043b\u0430\u0442")) return "admin.tasks.kindPaymentError";
  if (haystack.includes("daily") || haystack.includes("report") || haystack.includes("\u043e\u0442\u0447\u0435\u0442") || haystack.includes("\u043e\u0442\u0447\u0451\u0442")) return "admin.tasks.kindReportFailed";
  if (task.source === "COMPANY_VERIFICATION") return "admin.tasks.kindVerification";
  return "admin.tasks.kindSystem";
}

function displayTitle(task: AdminTaskBoardRow, t: (key: TranslationKey) => string) {
  if (task.title === "Finance operation status changed") return t("admin.tasks.templateFinanceStatusChanged");
  return task.title;
}

function displayDescription(task: AdminTaskBoardRow, t: (key: TranslationKey) => string) {
  const description = task.description ?? "";
  const financeStatus = description.match(/^Status changed to ([A-Z_]+)\. Amount: (.+)$/);
  if (financeStatus) return `${t("admin.tasks.statusChangedTo")} ${financeStatus[1]}. ${t("admin.tasks.amount")}: ${financeStatus[2]}`;
  return description || t("admin.common.noDetails");
}

function taskBelongsToColumn(task: AdminTaskBoardRow, columnId: KanbanColumnId) {
  if (columnId === "IT_IN_PROGRESS") return task.status === "IN_PROGRESS" && task.source === "AUDIT";
  if (columnId === "IN_PROGRESS") return task.status === "IN_PROGRESS" && task.source !== "AUDIT";
  return task.status === columnId;
}

function TaskCard({
  task,
  busy,
  locale,
  t,
  assignees,
  onAction,
}: {
  task: AdminTaskBoardRow;
  busy: boolean;
  locale: "en" | "ru";
  t: (key: TranslationKey) => string;
  assignees: AdminTasksBoardResponse["assignees"];
  onAction: (uuid: string, action: TaskMutationAction, assignedToId?: number | null) => void;
}) {
  const Icon = sourceIcons[task.source];
  const title = displayTitle(task, t);
  const description = displayDescription(task, t);
  const active = task.status === "OPEN" || task.status === "IN_PROGRESS";
  const [selectedAssignee, setSelectedAssignee] = useState(task.assignedToId ? String(task.assignedToId) : "NONE");
  const statusTitle = task.status === "IN_PROGRESS" && task.source === "AUDIT" ? "admin.tasks.statusItInProgress" : statusColumns.find((column) => column.id === task.status)?.title;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-left shadow-[0_12px_36px_rgba(0,0,0,0.16)] transition hover:border-cyan-200/25 hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-cyan-200/30"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-100">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-5">{title}</h3>
                <Badge variant="outline" className={cn("shrink-0 px-2 py-0 text-[10px]", priorityTone(task.priority))}>{t(priorityLabels[task.priority])}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>
              <div className="mt-2 flex items-center gap-2 overflow-hidden text-[11px] text-muted-foreground">
                <span className="shrink-0">{t(sourceLabels[task.source])}</span>
                <span className="shrink-0">{"\u00b7"}</span>
                <span className="truncate">{t(criticalKindKey(task))}</span>
                <span className="shrink-0">{"\u00b7"}</span>
                <span className="max-w-[6rem] truncate">{task.assignedTo?.name ?? t("admin.task.unassigned")}</span>
              </div>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityTone(task.priority)}>{t(priorityLabels[task.priority])}</Badge>
            <Badge variant="outline" className={statusTone(task.status)}>{t(statusTitle ?? "admin.task.statusOpen")}</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">{t(sourceLabels[task.source])}</Badge>
          </div>
          <DialogTitle className="text-2xl leading-tight">{title}</DialogTitle>
          <DialogDescription className="whitespace-pre-line leading-6">{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow label={t("admin.tasks.kind")} value={t(criticalKindKey(task))} />
          <InfoRow label={t("admin.task.assignee")} value={task.assignedTo?.name ?? t("admin.task.unassigned")} />
          <InfoRow label={t("admin.task.createdAt")} value={formatDate(task.createdAt, locale)} />
          <InfoRow label="Source key" value={task.sourceKey} />
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("admin.tasks.assignNew")}
            <select
              value={selectedAssignee}
              onChange={(event) => setSelectedAssignee(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-200/40"
            >
              <option value="NONE">{t("admin.task.unassigned")}</option>
              {assignees.map((item) => (
                <option key={item.id} value={item.id}>{item.name || item.email}</option>
              ))}
            </select>
          </label>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => onAction(task.uuid, "assign", selectedAssignee === "NONE" ? null : Number(selectedAssignee))}
          >
            {t("admin.tasks.assign")}
          </Button>
        </div>

        <DialogFooter>
          {task.targetUrl ? (
            <Button asChild className="bg-white text-black hover:bg-white/90">
              <Link href={task.targetUrl}>{t("admin.task.openSource")}</Link>
            </Button>
          ) : null}
          {task.status === "OPEN" ? (
            <Button variant="outline" disabled={busy} onClick={() => onAction(task.uuid, "start")}>{t("admin.task.start")}</Button>
          ) : null}
          {task.status === "IN_PROGRESS" && task.source === "AUDIT" ? (
            <Button variant="outline" disabled={busy} onClick={() => onAction(task.uuid, "resolve")}>{t("admin.task.resolve")}</Button>
          ) : null}
          {task.status !== "DISMISSED" ? (
            <Button variant="outline" disabled={busy} onClick={() => onAction(task.uuid, "archive")}>{t("admin.tasks.archiveAction")}</Button>
          ) : null}
          {!active ? (
            <Button variant="outline" disabled={busy} onClick={() => onAction(task.uuid, "reopen")}>{t("admin.task.reopen")}</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}

function initialStatusForColumn(columnId: KanbanColumnId): Exclude<AdminTaskStatus, "DISMISSED"> {
  if (columnId === "IT_IN_PROGRESS") return "IN_PROGRESS";
  return columnId;
}

function defaultSourceForColumn(columnId: KanbanColumnId): AdminTaskSource {
  if (columnId === "IN_PROGRESS") return "COMPANY_VERIFICATION";
  return "AUDIT";
}

function CreateTaskDialog({
  columnId,
  assignees,
  busy,
  t,
  onCreate,
}: {
  columnId: KanbanColumnId;
  assignees: AdminTasksBoardResponse["assignees"];
  busy: boolean;
  t: (key: TranslationKey) => string;
  onCreate: (input: {
    title: string;
    description: string;
    priority: AdminTaskPriority;
    status: Exclude<AdminTaskStatus, "DISMISSED">;
    source: AdminTaskSource;
    assignedToId: number | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<AdminTaskPriority>("NORMAL");
  const [source, setSource] = useState<AdminTaskSource>(defaultSourceForColumn(columnId));
  const [assignedTo, setAssignedTo] = useState("NONE");
  const fixedItSource = columnId === "IT_IN_PROGRESS";
  const sourceOptions = columnId === "IN_PROGRESS" ? createSourceOptions.filter((item) => item.value !== "AUDIT") : createSourceOptions;

  function submit() {
    onCreate({
      title,
      description,
      priority,
      status: initialStatusForColumn(columnId),
      source: fixedItSource ? "AUDIT" : source,
      assignedToId: assignedTo === "NONE" ? null : Number(assignedTo),
    });
    setOpen(false);
    setTitle("");
    setDescription("");
    setPriority("NORMAL");
    setSource(defaultSourceForColumn(columnId));
    setAssignedTo("NONE");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" disabled={busy} title={t("admin.tasks.create")}>
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("admin.tasks.createTitle")}</DialogTitle>
          <DialogDescription>{t("admin.tasks.createDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder={t("admin.tasks.titlePlaceholder")} />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={8000} rows={8} placeholder={t("admin.tasks.descriptionPlaceholder")} />
          <div className="grid gap-3 sm:grid-cols-3">
            <FormSelect label={t("admin.tasks.priority")} value={priority} onChange={(value) => setPriority(value as AdminTaskPriority)} options={[{ value: "NORMAL", label: t("admin.dashboard.priorityNormal") }, { value: "HIGH", label: t("admin.dashboard.priorityHigh") }, { value: "CRITICAL", label: t("admin.dashboard.priorityCritical") }]} />
            <FormSelect label={t("admin.systemHealth.source")} value={fixedItSource ? "AUDIT" : source} onChange={(value) => setSource(value as AdminTaskSource)} disabled={fixedItSource} options={sourceOptions.map((item) => ({ value: item.value, label: t(item.label) }))} />
            <FormSelect label={t("admin.task.assignee")} value={assignedTo} onChange={setAssignedTo} options={[{ value: "NONE", label: t("admin.task.unassigned") }, ...assignees.map((item) => ({ value: String(item.id), label: item.name || item.email }))]} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy || title.trim().length < 3} onClick={submit}>{t("admin.tasks.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-200/40 disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function AdminTasksPage() {
  const { locale, t } = useI18n("ru");
  const [board, setBoard] = useState<AdminTasksBoardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("ALL");
  const [audience, setAudience] = useState("ALL");
  const [assignee, setAssignee] = useState("ALL");
  const [priority, setPriority] = useState<AdminTaskPriority | "ALL">("ALL");
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetTasksBoard();
    if (result.ok) setBoard(result.data);
    else setError(result.message);
    setLoading(false);
  }

  async function updateTask(uuid: string, action: TaskMutationAction, assignedToId?: number | null) {
    setBusyTask(uuid);
    const result = await adminUpdateTask(uuid, action, assignedToId);
    if (!result.ok) setError(result.message);
    await load();
    setBusyTask(null);
  }

  async function createTask(input: Parameters<typeof adminCreateTask>[0]) {
    setCreatingTask(true);
    const result = await adminCreateTask(input);
    if (!result.ok) setError(result.message);
    await load();
    setCreatingTask(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const visibleTasks = useMemo(() => {
    return (board?.tasks ?? [])
      .filter((task) => department === "ALL" || task.department === department)
      .filter((task) => audience === "ALL" || task.audience === audience)
      .filter((task) => priority === "ALL" || task.priority === priority)
      .filter((task) => assignee === "ALL" || (assignee === "NONE" ? !task.assignedToId : task.assignedToId === Number(assignee)))
      .filter((task) => taskMatches(task, query))
      .sort((left, right) => priorityOrder[left.priority] - priorityOrder[right.priority] || new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  }, [assignee, audience, board?.tasks, department, priority, query]);

  const filteredTasks = visibleTasks.filter((task) => task.status !== "DISMISSED");
  const archivedTasks = visibleTasks.filter((task) => task.status === "DISMISSED");
  const criticalTasks = filteredTasks.filter((task) => task.priority === "CRITICAL" && task.status !== "RESOLVED");

  return (
    <main className="space-y-4">
      <section className="sticky top-0 z-20 -mx-1 rounded-b-[1.75rem] border-b border-white/10 bg-background/92 px-1 pb-3 pt-2 backdrop-blur-xl">
        <div className="rounded-[1.5rem] border border-white/10 bg-card/80 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
                <ClipboardList className="h-3.5 w-3.5" /> KANBAN
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight">{t("admin.tasks.title")}</h1>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">{t("admin.common.total")}: {filteredTasks.length}</span>
              <span className="rounded-full border border-red-300/25 bg-red-300/10 px-3 py-1 text-xs text-red-100">{t("admin.dashboard.priorityCritical")}: {criticalTasks.length}</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">{t("admin.tasks.archiveTitle")}: {archivedTasks.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(board?.alertMenus ?? []).map((menu) => (
                <button
                  key={menu.id}
                  type="button"
                  onClick={() => setAudience(audience === menu.id ? "ALL" : menu.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition",
                    audience === menu.id
                      ? "border-cyan-200/35 bg-cyan-300/12 text-cyan-100"
                      : "border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]",
                  )}
                >
                  {t(alertMenuLabels[menu.id])}: {menu.count}
                </button>
              ))}
              {board?.generatedAt ? <p className="text-xs text-muted-foreground">{formatDate(board.generatedAt, locale)}</p> : null}
              <Button size="sm" variant="secondary" disabled={loading} onClick={() => void load()}>
                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} /> {t("admin.dashboard.refresh")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div> : null}

      <section className="rounded-[1.5rem] border border-white/10 bg-card/70 p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(16rem,1fr)_repeat(4,minmax(10rem,13rem))] xl:items-end">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("admin.tasks.searchPlaceholder")} className="pl-10" />
          </div>
          <FilterSelect label={t("admin.tasks.department")} value={department} onChange={setDepartment} options={departmentOptions.map((item) => ({ value: item.value, label: t(item.label) }))} />
          <FilterSelect label={t("admin.tasks.alertMenu")} value={audience} onChange={setAudience} options={audienceOptions.map((item) => ({ value: item.value, label: t(item.label) }))} />
          <FilterSelect label={t("admin.tasks.priority")} value={priority} onChange={(value) => setPriority(value as AdminTaskPriority | "ALL")} options={[{ value: "ALL", label: t("admin.common.all") }, { value: "CRITICAL", label: t("admin.dashboard.priorityCritical") }, { value: "HIGH", label: t("admin.dashboard.priorityHigh") }, { value: "NORMAL", label: t("admin.dashboard.priorityNormal") }]} />
          <FilterSelect
            label={t("admin.task.assignee")}
            value={assignee}
            onChange={setAssignee}
            options={[
              { value: "ALL", label: t("admin.common.all") },
              { value: "NONE", label: t("admin.task.unassigned") },
              ...(board?.assignees.map((item) => ({ value: String(item.id), label: item.name || item.email })) ?? []),
            ]}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[repeat(4,minmax(17rem,1fr))]">
        {statusColumns.map((column) => {
          const columnTasks = filteredTasks.filter((task) => taskBelongsToColumn(task, column.id));
          return (
            <div key={column.id} className="min-h-[32rem] rounded-[1.5rem] border border-white/10 bg-card/55 p-3">
              <div className="mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
                    {column.id === "OPEN" ? <BellRing className="h-5 w-5 shrink-0 text-amber-100" /> : column.id === "IN_PROGRESS" ? <UsersRound className="h-5 w-5 shrink-0 text-cyan-100" /> : column.id === "IT_IN_PROGRESS" ? <ShieldAlert className="h-5 w-5 shrink-0 text-red-100" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-100" />}
                    <span className="truncate">{t(column.title)}</span>
                  </h2>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">{columnTasks.length}</Badge>
                    <CreateTaskDialog columnId={column.id} assignees={board?.assignees ?? []} busy={creatingTask} t={t} onCreate={(input) => void createTask(input)} />
                  </div>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{t(column.hint)}</p>
              </div>
              <div className="space-y-2">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">{t("admin.common.loading")}</div>
                ) : columnTasks.length ? (
                  columnTasks.map((task) => <TaskCard key={task.uuid} task={task} busy={busyTask === task.uuid} locale={locale} t={t} assignees={board?.assignees ?? []} onAction={(uuid, action, assignedToId) => void updateTask(uuid, action, assignedToId)} />)
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">{t("admin.tasks.emptyColumn")}</div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[1.5rem] border border-white/10 bg-card/55 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Archive className="h-5 w-5 text-muted-foreground" />
              {t("admin.tasks.archiveTitle")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">{t("admin.tasks.archiveHint")}</p>
          </div>
          <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">{archivedTasks.length}</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">{t("admin.common.loading")}</div>
          ) : archivedTasks.length ? (
            archivedTasks.map((task) => <TaskCard key={task.uuid} task={task} busy={busyTask === task.uuid} locale={locale} t={t} assignees={board?.assignees ?? []} onAction={(uuid, action, assignedToId) => void updateTask(uuid, action, assignedToId)} />)
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">{t("admin.tasks.archiveEmpty")}</div>
          )}
        </div>
      </section>
    </main>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      <span className="mb-1.5 flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> {label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-cyan-200/40"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
