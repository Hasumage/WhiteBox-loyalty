import type { AdminPermissionAction, AdminPermissionScope } from "@/lib/admin/access-control";

export type AdminAiChatRole = "user" | "assistant";

export type AdminAiChatMessage = {
  role: AdminAiChatRole;
  content: string;
};

export type AdminAiPendingAction =
  | {
      type: "EXTEND_COMPANY_BILLING";
      title: string;
      description: string;
      payload: {
        ownerUserUuid: string;
        companyName: string;
        months: number;
        comment?: string;
        notificationText?: string;
        notifyTelegram: boolean;
      };
    }
  | {
      type: "CREATE_ADMIN_TASK";
      title: string;
      description: string;
      payload: {
        title: string;
        description?: string;
        priority: "NORMAL" | "HIGH" | "CRITICAL";
        source: "AUDIT" | "COMPANY_VERIFICATION" | "FINANCE";
      };
    };

export type AdminAiTable = {
  title: string;
  summary?: string;
  columns: Array<{
    key: string;
    label: string;
    align?: "left" | "right";
  }>;
  rows: Array<Record<string, string | number | null>>;
  totalRows?: number;
};

export type AdminAiAssistResult = {
  reply: string;
  intent: string;
  data?: Record<string, unknown>;
  table?: AdminAiTable;
  pendingAction?: AdminAiPendingAction | null;
  suggestions?: string[];
};

export type AdminAiPermissionView = {
  scope: AdminPermissionScope;
  canView: boolean;
  canEdit: boolean;
  canApprove: boolean;
};

export type AdminAiActor = {
  id: number;
  uuid: string;
  role: string;
  email: string;
  name: string;
  permissions: AdminAiPermissionView[];
  can: (scope: AdminPermissionScope, action?: AdminPermissionAction) => boolean;
};

export type AdminAiModuleContext = {
  actor: AdminAiActor;
  message: string;
  history: AdminAiChatMessage[];
};

export type AdminAiModule = {
  id: string;
  description: string;
  handle: (context: AdminAiModuleContext) => Promise<AdminAiAssistResult | null>;
};
