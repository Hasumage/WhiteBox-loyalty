"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Check,
  CheckCircle2,
  Database,
  Eye,
  Headphones,
  LockKeyhole,
  MinusCircle,
  Pencil,
  PlusCircle,
  Save,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  adminGetUserPermissions,
  adminUpdateUserRole,
  adminUpdateUserPermissions,
  type AdminRole,
  type AdminPermissionScope,
  type AdminUserPermissionRow,
  type AdminUserPermissionsResponse,
} from "@/lib/api/admin-client";
import {
  ADMIN_PERMISSION_META,
  ADMIN_PERMISSION_ZONES,
  resolveEffectivePermissions,
} from "@/lib/admin/access-control";
import { cn } from "@/lib/utils";

const scopeIcons: Record<AdminPermissionScope, typeof Users> = {
  USERS: Users,
  COMPANIES: BadgeCheck,
  COMPANY_VERIFICATIONS: ShieldCheck,
  FINANCE: Banknote,
  SUPPORT: Headphones,
  AUDIT: SlidersHorizontal,
  DATABASE: Database,
  TELEGRAM: Send,
  SETTINGS: Settings,
};

type WorkspaceRole = Extract<AdminRole, "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SUPPORT">;

function isWorkspaceRole(role: AdminRole | string | null | undefined): role is WorkspaceRole {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "MANAGER" || role === "SUPPORT";
}

const roleCards: ReadonlyArray<{ role: WorkspaceRole; title: string; text: string }> = [
  {
    role: "SUPER_ADMIN",
    title: "Супер-админ",
    text: "Всегда имеет полный доступ. Его доступ нельзя урезать через таблицу прав.",
  },
  {
    role: "ADMIN",
    title: "Админ",
    text: "Операционное управление. Финансы и БД выдаются отдельно, чаще всего супер-админом.",
  },
  {
    role: "MANAGER",
    title: "Менеджер",
    text: "Компании, подписки, заявки и менеджерские процессы. Изменения уходят в предупреждающий аудит.",
  },
  {
    role: "SUPPORT",
    title: "Саппорт",
    text: "Безопасная помощь пользователям: email/uuid, статус Telegram, но без лишней приватной информации.",
  },
];

const actionMeta = [
  { field: "canView", label: "Смотреть", icon: Eye, hint: "Видит раздел и данные" },
  { field: "canEdit", label: "Изменять", icon: Pencil, hint: "Может менять данные зоны" },
  { field: "canApprove", label: "Апрув", icon: Check, hint: "Подтверждает рискованные действия" },
] as const;

type PermissionAction = (typeof actionMeta)[number]["field"];

function riskClass(risk: "safe" | "medium" | "high") {
  if (risk === "safe") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (risk === "medium") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-red-300/25 bg-red-300/10 text-red-100";
}

function riskLabel(risk: "safe" | "medium" | "high") {
  if (risk === "safe") return "низкий риск";
  if (risk === "medium") return "средний риск";
  return "высокий риск";
}

function toRows(items: ReturnType<typeof resolveEffectivePermissions>): AdminUserPermissionRow[] {
  return items.map((permission) => ({
    scope: permission.scope,
    canView: permission.canView,
    canEdit: permission.canEdit,
    canApprove: permission.canApprove,
  }));
}

function findPermission(items: AdminUserPermissionRow[] | undefined, scope: AdminPermissionScope) {
  return items?.find((permission) => permission.scope === scope);
}

function permissionButtonClass(enabled: boolean, savedEnabled: boolean, disabled: boolean) {
  if (disabled) {
    return "cursor-not-allowed border-white/10 bg-black/18 text-muted-foreground opacity-55 hover:bg-black/18 hover:text-muted-foreground";
  }

  if (enabled && savedEnabled) {
    return "border-white/35 bg-white text-black shadow-[0_0_22px_rgba(255,255,255,0.16)]";
  }

  if (enabled && !savedEnabled) {
    return "border-cyan-200/55 bg-cyan-300/15 text-cyan-50 shadow-[0_0_24px_rgba(103,232,249,0.13)] hover:bg-cyan-300/20";
  }

  if (!enabled && savedEnabled) {
    return "border-amber-300/45 bg-amber-300/10 text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.08)] hover:bg-amber-300/14";
  }

  return "border-white/10 bg-black/18 text-muted-foreground hover:bg-white/[0.07] hover:text-foreground";
}

function permissionStateMeta(enabled: boolean, savedEnabled: boolean) {
  if (enabled && savedEnabled) return { label: "Уже сохранено", Icon: CheckCircle2 };
  if (enabled && !savedEnabled) return { label: "Будет добавлено после сохранения", Icon: PlusCircle };
  if (!enabled && savedEnabled) return { label: "Будет снято после сохранения", Icon: MinusCircle };
  return null;
}

function permissionStateBadgeClass(enabled: boolean, savedEnabled: boolean) {
  if (enabled && savedEnabled) return "border-black/10 bg-black/10 text-black/70";
  if (enabled && !savedEnabled) return "border-cyan-200/30 bg-cyan-200/15 text-cyan-50";
  if (!enabled && savedEnabled) return "border-amber-200/30 bg-amber-200/15 text-amber-100";
  return "";
}

export default function UserPermissionsPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const [data, setData] = useState<AdminUserPermissionsResponse | null>(null);
  const [permissions, setPermissions] = useState<AdminUserPermissionRow[]>([]);
  const [draftRole, setDraftRole] = useState<WorkspaceRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const editableScopes = useMemo(() => new Set(data?.policy?.editableScopes ?? []), [data]);
  const assignableRoles = useMemo(() => new Set<WorkspaceRole>(data?.policy?.assignableRoles ?? []), [data]);
  const targetLocked = data?.policy?.targetLocked === true;
  const canManage = data?.policy?.canManage === true;
  const userRole = data?.user.role;
  const activeRole = draftRole ?? (isWorkspaceRole(userRole) ? userRole : null);
  const roleChanged = Boolean(data && draftRole && draftRole !== data.user.role);

  const allowedCount = useMemo(
    () => permissions.reduce((sum, permission) => sum + Number(permission.canView) + Number(permission.canEdit) + Number(permission.canApprove), 0),
    [permissions],
  );
  const highRiskApprovalItems = useMemo(
    () =>
      permissions
        .filter((permission) => permission.canApprove && ADMIN_PERMISSION_META[permission.scope].risk === "high")
        .map((permission) => ({
          scope: permission.scope,
          title: ADMIN_PERMISSION_META[permission.scope].title,
          description: ADMIN_PERMISSION_META[permission.scope].description,
        })),
    [permissions],
  );
  const highRiskApprovals = highRiskApprovalItems.length;

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setMessage("");
      const result = await adminGetUserPermissions(uuid);
      if (!active) return;
      if (result.ok) {
        setData(result.data);
        setPermissions(result.data.permissions);
        setDraftRole(isWorkspaceRole(result.data.user.role) ? result.data.user.role : null);
      } else {
        setMessage(result.message);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [uuid]);

  function isEditable(scope: AdminPermissionScope) {
    return canManage && editableScopes.has(scope) && !targetLocked;
  }

  function toggle(scope: AdminPermissionScope, field: "canView" | "canEdit" | "canApprove") {
    if (!isEditable(scope)) return;
    setPermissions((prev) =>
      prev.map((permission) => {
        if (permission.scope !== scope) return permission;
        const next = { ...permission, [field]: !permission[field] };
        if ((field === "canEdit" && next.canEdit) || (field === "canApprove" && next.canApprove)) next.canView = true;
        if (field === "canView" && !next.canView) {
          next.canEdit = false;
          next.canApprove = false;
        }
        return next;
      }),
    );
  }

  function applyRoleBaseline() {
    if (!data || targetLocked) return;
    const role = draftRole ?? data.user.role;
    setPermissions(toRows(resolveEffectivePermissions(role, [])));
    setMessage("Базовый пресет роли применен локально. Нажмите «Сохранить», чтобы записать изменения.");
  }

  function selectRole(role: WorkspaceRole) {
    if (!data || targetLocked || saving || !canManage) return;
    const isCurrentRole = role === data.user.role;
    const canAssignRole = assignableRoles.has(role);
    if (!isCurrentRole && !canAssignRole) {
      setMessage("Эту должность нельзя назначить с текущими правами.");
      return;
    }

    setDraftRole(role);
    setPermissions(toRows(resolveEffectivePermissions(role, [])));
    setMessage(`Должность ${role} выбрана локально. Нажмите «Сохранить доступы», чтобы записать изменения.`);
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setMessage("");

    const nextRole = draftRole ?? data.user.role;
    const shouldUpdateRole = isWorkspaceRole(nextRole) && nextRole !== data.user.role;
    if (shouldUpdateRole) {
      const roleResult = await adminUpdateUserRole(uuid, nextRole);
      if (!roleResult.ok) {
        setSaving(false);
        setMessage(roleResult.message);
        return;
      }

      if (nextRole === "SUPER_ADMIN") {
        const refreshed = await adminGetUserPermissions(uuid);
        setSaving(false);
        if (refreshed.ok) {
          setData(refreshed.data);
          setPermissions(refreshed.data.permissions);
          setDraftRole(isWorkspaceRole(refreshed.data.user.role) ? refreshed.data.user.role : null);
          setMessage("Роль SUPER_ADMIN сохранена. Права встроены в роль и не требуют ручной настройки.");
        } else {
          setMessage(refreshed.message);
        }
        return;
      }
    }

    const result = await adminUpdateUserPermissions(uuid, permissions);
    setSaving(false);
    if (result.ok) {
      setData(result.data);
      setPermissions(result.data.permissions);
      setDraftRole(isWorkspaceRole(result.data.user.role) ? result.data.user.role : null);
      setMessage(shouldUpdateRole ? "Должность и настройки доступа сохранены." : "Настройки доступа сохранены.");
    } else {
      setMessage(result.message);
    }
  }

  if (loading) {
    return <Card className="border-white/10 bg-white/[0.04] p-6 text-muted-foreground">Загружаю настройки доступа...</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary">
          <Link href={`/admin/users/${uuid}`}>
            <ArrowLeft className="h-4 w-4" /> Назад к пользователю
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={applyRoleBaseline} disabled={!data || targetLocked || !canManage}>
            <Sparkles className="h-4 w-4" /> Пресет роли
          </Button>
          <Button onClick={save} disabled={saving || !data || targetLocked || !canManage}>
            <Save className="h-4 w-4" /> {saving ? "Сохраняю..." : "Сохранить доступы"}
          </Button>
        </div>
      </div>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              <LockKeyhole className="h-4 w-4" /> Permission всему голова
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Настройки доступа</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Роль задает потолок безопасности, а индивидуальные права решают, что именно сотрудник может смотреть, менять и подтверждать.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Пользователь</p>
              <p className="mt-2 truncate font-semibold">{data?.user.name ?? "-"}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{data?.user.email}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Роль</p>
              <p className="mt-2 font-semibold">{activeRole ?? data?.user.role ?? "-"}</p>
              {roleChanged && <p className="mt-1 text-xs text-cyan-100">Будет изменена после сохранения</p>}
              {targetLocked && <p className="mt-1 text-xs text-cyan-100">Доступ встроен в роль</p>}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Активно</p>
              <p className="mt-2 text-2xl font-semibold">{allowedCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">переключателей доступа</p>
            </div>
          </div>
        </div>
      </section>

      {message && (
        <div className={cn("rounded-2xl border p-4 text-sm", message.toLowerCase().includes("failed") || message.includes("required") || message.includes("cannot") ? "border-red-300/25 bg-red-300/10 text-red-100" : "border-white/10 bg-white/[0.05]")}>{message}</div>
      )}

      {highRiskApprovals > 0 && (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
          <div className="flex flex-wrap items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Высокорисковые апрувы в черновике: {highRiskApprovals}
          </div>
          <p className="mt-2 max-w-4xl text-amber-100/80">
            Эти права позволяют подтверждать действия с высокой ценой ошибки. Перед сохранением проверьте конкретные зоны:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {highRiskApprovalItems.map((item) => (
              <Badge key={item.scope} variant="outline" className="border-amber-200/30 bg-black/20 text-amber-50">
                {item.title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-4">
        {roleCards.map((card) => {
          const selected = activeRole === card.role;
          const current = data?.user.role === card.role;
          const canAssignRole = assignableRoles.has(card.role);
          const disabled = !data || targetLocked || saving || !canManage || (!current && !canAssignRole);
          return (
            <Card
              key={card.role}
              className={cn(
                "overflow-hidden border-white/10 bg-card/60 transition",
                selected && "border-cyan-200/45 bg-cyan-300/10 shadow-[0_0_28px_rgba(103,232,249,0.12)]",
                disabled && "opacity-55",
              )}
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => selectRole(card.role)}
                className={cn(
                  "h-full w-full p-4 text-left transition",
                  disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-white/[0.04]",
                )}
              >
                <Badge variant="outline" className="border-white/15 bg-white/[0.04]">{card.role}</Badge>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{card.title}</h2>
                  {selected && <Badge className="bg-cyan-200 text-black">Выбрано</Badge>}
                  {!selected && canAssignRole && <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">Можно назначить</Badge>}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.text}</p>
              </button>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.45)]" />
          Уже сохранено в БД
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-cyan-200/70 bg-cyan-300/40 shadow-[0_0_14px_rgba(103,232,249,0.45)]" />
          Будет добавлено после сохранения
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full border border-amber-200/70 bg-amber-300/30 shadow-[0_0_14px_rgba(251,191,36,0.35)]" />
          Сейчас есть, но будет снято
        </div>
      </div>

      <div className="space-y-4">
        {ADMIN_PERMISSION_ZONES.map((zone) => (
          <Card key={zone.id} className="overflow-hidden border-white/10 bg-card/65">
            <CardContent className="p-0">
              <div className="border-b border-white/10 bg-white/[0.035] px-5 py-4">
                <h2 className="text-lg font-semibold">{zone.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{zone.description}</p>
              </div>

              <div className="divide-y divide-white/10">
                {zone.scopes.map((scope) => {
                  const permission = permissions.find((item) => item.scope === scope) ?? {
                    scope,
                    canView: false,
                    canEdit: false,
                    canApprove: false,
                  };
                  const meta = ADMIN_PERMISSION_META[scope];
                  const Icon = scopeIcons[scope];
                  const disabled = !isEditable(scope);
                  return (
                    <div key={scope} className="grid gap-4 p-5 xl:grid-cols-[minmax(280px,1fr)_minmax(420px,520px)] xl:items-center">
                      <div className="flex gap-3">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold">{meta.title}</h3>
                            <Badge variant="outline" className={riskClass(meta.risk)}>{riskLabel(meta.risk)}</Badge>
                            {disabled && <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">нельзя изменить</Badge>}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{meta.description}</p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {actionMeta.map(({ field, label, icon: ToggleIcon, hint }) => {
                          const enabled = permission[field];
                          const savedEnabled = findPermission(data?.permissions, scope)?.[field as PermissionAction] === true;
                          const stateMeta = permissionStateMeta(enabled, savedEnabled);
                          return (
                            <button
                              key={field}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggle(scope, field)}
                              className={cn(
                                "group rounded-2xl border px-3 py-3 text-left transition",
                                permissionButtonClass(enabled, savedEnabled, disabled),
                              )}
                            >
                              <span className="flex items-center justify-between gap-2 font-semibold">
                                <span className="flex items-center gap-2">
                                  <ToggleIcon className="h-4 w-4" /> {label}
                                </span>
                                {stateMeta && (
                                  <span
                                    className={cn(
                                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                                      permissionStateBadgeClass(enabled, savedEnabled),
                                    )}
                                    title={stateMeta.label}
                                    aria-label={stateMeta.label}
                                  >
                                    <stateMeta.Icon className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </span>
                              <span className="mt-1 block text-xs opacity-75">{hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
