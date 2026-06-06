export const ADMIN_PERMISSION_SCOPES = [
  "USERS",
  "COMPANIES",
  "COMPANY_VERIFICATIONS",
  "PR",
  "FINANCE",
  "SUPPORT",
  "AUDIT",
  "DATABASE",
  "TELEGRAM",
  "SETTINGS",
] as const;

export type AdminWorkspaceRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SUPPORT";
export type AdminPermissionScope = (typeof ADMIN_PERMISSION_SCOPES)[number];
export type AdminPermissionAction = "canView" | "canEdit" | "canApprove";

export const ADMIN_WORKSPACE_ROLES: readonly AdminWorkspaceRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPPORT",
];

export type AdminPermissionLike = {
  scope: AdminPermissionScope | string;
  canView?: boolean;
  canEdit?: boolean;
  canApprove?: boolean;
};

export type EffectiveAdminPermission = {
  scope: AdminPermissionScope;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
  source: "role" | "explicit" | "locked";
};

export const ADMIN_PERMISSION_ZONES = [
  {
    id: "people",
    title: "Люди и поддержка",
    description: "Пользователи, безопасная помощь клиентам и базовая работа саппорта.",
    scopes: ["USERS", "SUPPORT"],
  },
  {
    id: "partners",
    title: "Партнеры и компании",
    description: "Профили компаний, подписки, заявки на верификацию и паспортная проверка.",
    scopes: ["COMPANIES", "COMPANY_VERIFICATIONS"],
  },
  {
    id: "money",
    title: "Финансы",
    description: "Заявки на выплаты, возвраты, ручные корректировки и финансовые апрувы.",
    scopes: ["FINANCE"],
  },
  {
    id: "growth",
    title: "PR и рефералы",
    description: "Привлечение компаний, закрепление реферала и видимость реферальной комиссии.",
    scopes: ["PR"],
  },
  {
    id: "tech",
    title: "Тех и разработка",
    description: "Карта БД, backup/restore, аудит разработчиков и технические расследования.",
    scopes: ["DATABASE", "AUDIT"],
  },
  {
    id: "system",
    title: "Система",
    description: "Telegram-уведомления, маршрутизация и настройка доступов.",
    scopes: ["TELEGRAM", "SETTINGS"],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  scopes: readonly AdminPermissionScope[];
}>;

export const ADMIN_PERMISSION_META: Record<
  AdminPermissionScope,
  {
    title: string;
    shortTitle: string;
    description: string;
    risk: "safe" | "medium" | "high";
  }
> = {
  USERS: {
    title: "Пользователи",
    shortTitle: "Users",
    description: "Просмотр профилей, uuid/email, безопасные действия с аккаунтами и сессиями.",
    risk: "high",
  },
  COMPANIES: {
    title: "Компании",
    shortTitle: "Companies",
    description: "Профили компаний, категории, локации, подписки и клиентские записи компании.",
    risk: "medium",
  },
  COMPANY_VERIFICATIONS: {
    title: "Верификация компаний",
    shortTitle: "Verification",
    description: "Юридические данные, паспортные фото и решение по доступу Company.",
    risk: "high",
  },
  PR: {
    title: "PR и рефералы",
    shortTitle: "PR",
    description: "Привлечение компаний, закрепление одного реферала, просмотр дохода и контроль PR-выплат.",
    risk: "medium",
  },
  FINANCE: {
    title: "Финансовые операции",
    shortTitle: "Finance",
    description: "Выплаты, возвраты, финансовые заявки и подтверждение платежных действий.",
    risk: "high",
  },
  SUPPORT: {
    title: "Саппорт",
    shortTitle: "Support",
    description: "Рабочая зона поддержки без лишних персональных и финансовых данных.",
    risk: "safe",
  },
  AUDIT: {
    title: "Аудит",
    shortTitle: "Audit",
    description: "Критичные действия, менеджерские предупреждения и технический след.",
    risk: "medium",
  },
  DATABASE: {
    title: "База данных",
    shortTitle: "Database",
    description: "Карта БД, снимки базы, скачивание backup и restore.",
    risk: "high",
  },
  TELEGRAM: {
    title: "Telegram",
    shortTitle: "Telegram",
    description: "Подключение админов к боту и маршрутизация уведомлений.",
    risk: "medium",
  },
  SETTINGS: {
    title: "Настройки доступа",
    shortTitle: "Settings",
    description: "Изменение индивидуальных прав и операционных настроек админки.",
    risk: "high",
  },
};

export function isAdminPermissionScope(scope: string): scope is AdminPermissionScope {
  return (ADMIN_PERMISSION_SCOPES as readonly string[]).includes(scope);
}

function permission(scope: AdminPermissionScope, canView = false, canEdit = false, canApprove = false): EffectiveAdminPermission {
  return { scope, canView, canEdit, canApprove, source: "role" };
}

export function defaultPermissionForRole(role: string, scope: AdminPermissionScope): EffectiveAdminPermission {
  if (role === "SUPER_ADMIN") {
    return { ...permission(scope, true, true, true), source: "locked" };
  }

  if (role === "ADMIN") {
    if (scope === "FINANCE" || scope === "DATABASE") return permission(scope);
    return permission(scope, true, true, scope !== "TELEGRAM");
  }

  if (role === "MANAGER") {
    if (scope === "USERS") return permission(scope, true, false, false);
    if (scope === "COMPANIES") return permission(scope, true, true, false);
    if (scope === "COMPANY_VERIFICATIONS") return permission(scope, true, true, true);
    if (scope === "PR") return permission(scope, false, false, false);
    if (scope === "SUPPORT") return permission(scope, true, true, false);
    if (scope === "AUDIT" || scope === "TELEGRAM") return permission(scope, true, false, false);
    return permission(scope);
  }

  if (role === "SUPPORT") {
    if (scope === "USERS") return permission(scope, true, false, false);
    if (scope === "SUPPORT") return permission(scope, true, true, false);
    return permission(scope);
  }

  return permission(scope);
}

export function clampPermissionToRole(role: string, input: AdminPermissionLike): EffectiveAdminPermission {
  const rawScope = String(input.scope);
  const scope: AdminPermissionScope = isAdminPermissionScope(rawScope) ? rawScope : "USERS";
  if (role === "SUPER_ADMIN") {
    return { scope, canView: true, canEdit: true, canApprove: true, source: "locked" };
  }

  const next = {
    scope,
    canView: input.canView === true,
    canEdit: input.canEdit === true,
    canApprove: input.canApprove === true,
    source: "explicit" as const,
  };

  if (next.canEdit || next.canApprove) next.canView = true;

  if (role === "ADMIN") {
    return next;
  }

  if (role === "MANAGER") {
    if (scope === "FINANCE" || scope === "SETTINGS") return { ...next, canView: false, canEdit: false, canApprove: false };
    if (scope === "DATABASE") return { ...next, canEdit: false, canApprove: false };
    return next;
  }

  if (role === "SUPPORT") {
    if (scope === "FINANCE" || scope === "SETTINGS" || scope === "COMPANY_VERIFICATIONS" || scope === "PR") {
      return { ...next, canView: false, canEdit: false, canApprove: false };
    }
    if (scope === "DATABASE" || scope === "AUDIT" || scope === "TELEGRAM") {
      return { ...next, canEdit: false, canApprove: false };
    }
    return { ...next, canApprove: false };
  }

  return { ...next, canView: false, canEdit: false, canApprove: false };
}

export function resolveEffectivePermission(
  role: string,
  explicitPermission: AdminPermissionLike | null | undefined,
  scope: AdminPermissionScope,
): EffectiveAdminPermission {
  if (role === "SUPER_ADMIN") return defaultPermissionForRole(role, scope);
  if (!explicitPermission) return defaultPermissionForRole(role, scope);
  return clampPermissionToRole(role, { ...explicitPermission, scope });
}

export function resolveEffectivePermissions(role: string, explicitPermissions: AdminPermissionLike[] = []) {
  const explicit = new Map(
    explicitPermissions
      .filter((permission) => isAdminPermissionScope(String(permission.scope)))
      .map((permission) => [permission.scope as AdminPermissionScope, permission]),
  );
  return ADMIN_PERMISSION_SCOPES.map((scope) => resolveEffectivePermission(role, explicit.get(scope), scope));
}

export function canManageAccess(actorRole: string, actorSettings: Pick<EffectiveAdminPermission, "canEdit">) {
  return actorRole === "SUPER_ADMIN" || (actorRole === "ADMIN" && actorSettings.canEdit);
}

export function canConfigureTargetRole(actorRole: string, actorSettings: Pick<EffectiveAdminPermission, "canEdit">, targetRole: string) {
  if (targetRole === "SUPER_ADMIN") return false;
  if (actorRole === "SUPER_ADMIN") return ["ADMIN", "MANAGER", "SUPPORT"].includes(targetRole);
  if (actorRole === "ADMIN" && actorSettings.canEdit) return ["MANAGER", "SUPPORT"].includes(targetRole);
  return false;
}

export function canConfigureScope(
  actorRole: string,
  actorSettings: Pick<EffectiveAdminPermission, "canEdit">,
  targetRole: string,
  scope: AdminPermissionScope,
) {
  if (!canConfigureTargetRole(actorRole, actorSettings, targetRole)) return false;
  if (actorRole === "SUPER_ADMIN") return true;
  if (scope === "FINANCE" || scope === "SETTINGS") return false;
  return true;
}

export function canAssignWorkspaceRole(
  actorRole: string,
  actorSettings: Pick<EffectiveAdminPermission, "canEdit">,
  nextRole: AdminWorkspaceRole,
) {
  if (!canManageAccess(actorRole, actorSettings)) return false;
  if (actorRole === "SUPER_ADMIN") return true;
  if (actorRole === "ADMIN" && actorSettings.canEdit) {
    return nextRole === "MANAGER" || nextRole === "SUPPORT";
  }
  return false;
}
