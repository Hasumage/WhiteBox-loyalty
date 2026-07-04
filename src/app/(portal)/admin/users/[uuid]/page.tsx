"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarClock,
  KeyRound,
  Mail,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserCircle2,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDeleteUser,
  adminAssignUserCompany,
  adminForceLogoutUser,
  adminGrantProfileStatus,
  adminListCompanyProfiles,
  adminListProfileStatuses,
  adminReactivateUser,
  adminRequestEmailChange,
  adminSendEmail,
  adminUpdateUser,
  type AdminCompanyProfileOption,
  type AdminProfileStatus,
  type AdminRole,
  type AdminUserDetail,
} from "@/lib/api/admin-client";
import { getStoredUser } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { ProfileStatusBadge, ProfileStatusIcon, profileStatusRarityClass } from "@/components/profile-status/profile-status-view";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  toDateTimeLocal,
  toIsoOrNull,
  UserPageState,
  UserPageHeader,
  useAdminUserProfile,
} from "./_components/user-detail";

type Role = AdminRole;
type AccountStatus = AdminUserDetail["accountStatus"];
type CompanyAssignmentMode = "" | "CREATE_NEW" | "ATTACH_EXISTING";
type CompanyMemberRole = "OWNER" | "MANAGER" | "CASHIER";
const ADMIN_WORKSPACE_ROLES = new Set<Role>(["SUPER_ADMIN", "ADMIN", "MANAGER", "SUPPORT"]);

type FormState = {
  name: string;
  role: Role;
  accountStatus: AccountStatus;
  emailVerifiedAt: string;
  createdAt: string;
};

function InfoTile({ icon: Icon, label, value }: { icon: typeof UserCircle2; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-4 w-4 text-cyan-100" /> {label}
      </div>
      <p className="mt-2 break-all text-sm font-semibold sm:text-base">{value}</p>
    </div>
  );
}

function SectionLink({ href, icon: Icon, title, description, count }: { href: string; icon: typeof WalletCards; title: string; description: string; count: number }) {
  return (
    <Link href={href} className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-200/30 hover:bg-cyan-300/10">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-2xl border border-white/10 bg-background/70 p-2.5 text-cyan-100">
          <Icon className="h-5 w-5" />
        </span>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

export default function AdminUserProfilePage() {
  const router = useRouter();
  const { locale, t } = useI18n("ru");
  const { userUuid, user, loading, error, setError, setUser, loadProfile } = useAdminUserProfile();

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [requestingEmailChange, setRequestingEmailChange] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [forcingLogout, setForcingLogout] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [companyTransferToUserUuid, setCompanyTransferToUserUuid] = useState("");
  const [confirmCompanyDeletion, setConfirmCompanyDeletion] = useState(false);
  const [companyAssignmentMode, setCompanyAssignmentMode] = useState<CompanyAssignmentMode>("");
  const [companyAssignmentQuery, setCompanyAssignmentQuery] = useState("");
  const [companyAssignmentCompanyId, setCompanyAssignmentCompanyId] = useState("");
  const [companyAssignmentMemberRole, setCompanyAssignmentMemberRole] = useState<CompanyMemberRole>("MANAGER");
  const [companyAssignmentDeactivatePrevious, setCompanyAssignmentDeactivatePrevious] = useState(true);
  const [companyProfiles, setCompanyProfiles] = useState<AdminCompanyProfileOption[]>([]);
  const [loadingCompanyProfiles, setLoadingCompanyProfiles] = useState(false);
  const [assigningCompany, setAssigningCompany] = useState(false);
  const [profileStatuses, setProfileStatuses] = useState<AdminProfileStatus[]>([]);
  const [grantStatusId, setGrantStatusId] = useState("");
  const [grantingStatus, setGrantingStatus] = useState(false);

  useEffect(() => {
    setCurrentRole(getStoredUser()?.role ?? null);
  }, []);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name,
      role: user.role,
      accountStatus: user.accountStatus,
      emailVerifiedAt: toDateTimeLocal(user.emailVerifiedAt),
      createdAt: toDateTimeLocal(user.createdAt),
    });
    setCompanyTransferToUserUuid("");
    setConfirmCompanyDeletion(false);
    setCompanyAssignmentMode("");
    setCompanyAssignmentCompanyId("");
    setCompanyAssignmentMemberRole("MANAGER");
    setCompanyAssignmentDeactivatePrevious(true);
  }, [user]);

  useEffect(() => {
    if (!user?.uuid) return;
    let ignore = false;
    void (async () => {
      const response = await adminListProfileStatuses(user.uuid);
      if (!ignore && response.ok) {
        setProfileStatuses(response.data.statuses);
        setGrantStatusId(response.data.statuses.find((status) => !status.unlocked)?.id ?? "");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [user?.uuid]);

  useEffect(() => {
    if (!user?.uuid) return;
    let ignore = false;
    void (async () => {
      setLoadingCompanyProfiles(true);
      const profiles = await adminListCompanyProfiles("");
      if (!ignore) {
        setCompanyProfiles(profiles);
        setLoadingCompanyProfiles(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [user?.uuid]);

  async function loadCompanyProfiles(search = companyAssignmentQuery) {
    setLoadingCompanyProfiles(true);
    const profiles = await adminListCompanyProfiles(search);
    setCompanyProfiles(profiles);
    setLoadingCompanyProfiles(false);
  }

  const snapshot = useMemo(() => {
    if (!user) return null;
    return {
      relations: user.favoriteCategories.length + user.companyLinks.length,
      activity: user.subscriptions.length + user.loyaltyTransactions.length,
      security: user.loginEvents.length + user.criticalActions.length + user.refreshTokens.length,
    };
  }, [user]);
  const companyOwnership = user?.companyOwnership ?? null;
  const companyTransferCandidates = companyOwnership?.activeMembers.filter((member) => member.accountStatus === "ACTIVE") ?? [];
  const roleLeavesOwnedCompany =
    Boolean(user && form && user.role === "COMPANY" && form.role !== "COMPANY" && companyOwnership);
  const needsCompanyTransfer = roleLeavesOwnedCompany && companyTransferCandidates.length > 0;
  const needsCompanyDeletionConfirm = roleLeavesOwnedCompany && companyTransferCandidates.length === 0;
  const roleChangeBlocked =
    (needsCompanyTransfer && !companyTransferToUserUuid) ||
    (needsCompanyDeletionConfirm && !confirmCompanyDeletion);
  const entersCompanyRole = Boolean(user && form && user.role !== "COMPANY" && form.role === "COMPANY");
  const selectedCompanyProfile = companyProfiles.find((company) => String(company.id) === companyAssignmentCompanyId) ?? null;
  const companyAssignmentBlocked =
    entersCompanyRole &&
    (companyAssignmentMode === "" ||
      (companyAssignmentMode === "ATTACH_EXISTING" && !companyAssignmentCompanyId));
  const saveBlocked = roleChangeBlocked || companyAssignmentBlocked;
  const canRunCompanyAssignment =
    Boolean(userUuid) &&
    companyAssignmentMode !== "" &&
    (companyAssignmentMode === "CREATE_NEW" || Boolean(companyAssignmentCompanyId));

  async function onSave() {
    if (!form || !userUuid) return;
    if (companyAssignmentBlocked) {
      setError(
        companyAssignmentMode === "ATTACH_EXISTING"
          ? "Выберите компанию, к которой нужно привязать пользователя."
          : "Выберите: создать новую компанию или привязать пользователя к существующей.",
      );
      return;
    }
    if (roleChangeBlocked) {
      setError(
        needsCompanyTransfer
          ? "Выберите сотрудника, которому перейдёт компания после смены роли."
          : "Подтвердите деактивацию и удаление компании перед сменой роли.",
      );
      return;
    }
    setSaving(true);
    setNotice(null);
    const response = await adminUpdateUser(userUuid, {
      name: form.name,
      role: form.role,
      accountStatus: form.accountStatus,
      emailVerifiedAt: toIsoOrNull(form.emailVerifiedAt),
      createdAt: toIsoOrNull(form.createdAt),
      companyTransferToUserUuid: needsCompanyTransfer ? companyTransferToUserUuid : undefined,
      confirmCompanyDeletion: needsCompanyDeletionConfirm ? true : undefined,
      companyAssignmentMode: entersCompanyRole && companyAssignmentMode ? companyAssignmentMode : undefined,
      companyAssignmentCompanyId:
        entersCompanyRole && companyAssignmentMode === "ATTACH_EXISTING"
          ? Number(companyAssignmentCompanyId)
          : undefined,
      companyAssignmentMemberRole:
        entersCompanyRole && companyAssignmentMode === "ATTACH_EXISTING"
          ? companyAssignmentMemberRole
          : undefined,
      companyAssignmentDeactivatePrevious: entersCompanyRole ? companyAssignmentDeactivatePrevious : undefined,
    });
    setSaving(false);
    if (!response.ok) {
      setError(typeof response.message === "string" ? response.message : t("admin.userDetail.updateFailed"));
      return;
    }
    setError(null);
    setNotice(t("admin.userDetail.updated"));
    setUser(response.data);
  }

  async function onAssignCompany() {
    if (!userUuid || !canRunCompanyAssignment || !companyAssignmentMode) return;
    setAssigningCompany(true);
    setNotice(null);
    const response = await adminAssignUserCompany(userUuid, {
      mode: companyAssignmentMode,
      companyId: companyAssignmentMode === "ATTACH_EXISTING" ? Number(companyAssignmentCompanyId) : undefined,
      memberRole: companyAssignmentMode === "ATTACH_EXISTING" ? companyAssignmentMemberRole : undefined,
      deactivatePreviousMemberships: companyAssignmentDeactivatePrevious,
    });
    setAssigningCompany(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setError(null);
    setNotice(
      companyAssignmentMode === "CREATE_NEW"
        ? "Компания создана, пользователь назначен владельцем."
        : `Пользователь привязан к компании «${selectedCompanyProfile?.name ?? "выбранной"}».`,
    );
    setUser(response.data);
    setForm((previous) => (previous ? { ...previous, role: "COMPANY" } : previous));
  }

  async function onReactivate() {
    if (!userUuid) return;
    const response = await adminReactivateUser(userUuid);
    if (!response.ok) {
      setError(String(response.message));
      return;
    }
    setError(null);
    setNotice(t("admin.userDetail.reactivated"));
    await loadProfile();
  }

  async function onRequestEmailChange() {
    if (!userUuid || !newEmail.trim()) return;
    setRequestingEmailChange(true);
    setNotice(null);
    const response = await adminRequestEmailChange(userUuid, newEmail.trim());
    setRequestingEmailChange(false);
    if (!response.ok) {
      setError(typeof response.message === "string" ? response.message : t("admin.userDetail.emailFailed"));
      return;
    }
    setError(null);
    setNotice(
      response.data.previewUrl
        ? `${t("admin.userDetail.emailSent")}: ${response.data.previewUrl}`
        : `${t("admin.userDetail.emailSentTo")} ${response.data.sentTo}.`,
    );
    setNewEmail("");
  }

  async function onSendEmail() {
    if (!userUuid || !emailSubject.trim() || !emailMessage.trim()) return;
    setSendingEmail(true);
    setNotice(null);
    const response = await adminSendEmail({
      targetType: "USER",
      targetUuid: userUuid,
      subject: emailSubject.trim(),
      message: emailMessage.trim(),
    });
    setSendingEmail(false);
    if (!response.ok) {
      setError(typeof response.message === "string" ? response.message : "Не удалось отправить письмо");
      return;
    }
    setError(null);
    setNotice(`Письмо отправлено на ${response.data.sentTo}.`);
    setEmailSubject("");
    setEmailMessage("");
  }

  async function onDelete() {
    if (!userUuid) return;
    const check = window.prompt(t("admin.userDetail.deletePrompt"));
    if (check !== "DELETE") return;
    setDeleting(true);
    const response = await adminDeleteUser(userUuid);
    setDeleting(false);
    if (!response.ok) {
      setError(typeof response.message === "string" ? response.message : t("admin.userDetail.deleteFailed"));
      return;
    }
    router.push("/admin/users");
  }

  async function onForceLogout() {
    if (!userUuid) return;
    setForcingLogout(true);
    const response = await adminForceLogoutUser(userUuid);
    setForcingLogout(false);
    if (!response.ok) {
      setError(typeof response.message === "string" ? response.message : t("admin.userDetail.forceLogoutFailed"));
      return;
    }
    setError(null);
    setNotice(`${t("admin.userDetail.revokedSessions")}: ${response.data.revokedSessions}.`);
    await loadProfile();
  }

  async function onGrantProfileStatus() {
    if (!userUuid || !grantStatusId) return;
    setGrantingStatus(true);
    setNotice(null);
    const response = await adminGrantProfileStatus(userUuid, grantStatusId);
    setGrantingStatus(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    setError(null);
    setNotice(`Статус «${response.data.status.title}» открыт пользователю.`);
    const fresh = await adminListProfileStatuses(userUuid);
    if (fresh.ok) {
      setProfileStatuses(fresh.data.statuses);
      setGrantStatusId(fresh.data.statuses.find((status) => !status.unlocked)?.id ?? "");
    }
  }

  const state = <UserPageState loading={loading} error={error && !user ? error : null} />;
  if (loading || !user || !form || !snapshot) return state;

  const isSuperAdmin = currentRole === "SUPER_ADMIN";
  const targetIsAdminWorkspace = ADMIN_WORKSPACE_ROLES.has(user.role);
  const statusLocked = targetIsAdminWorkspace && !isSuperAdmin;
  const headerActions = (
    <>
      <Button onClick={onSave} disabled={saving || saveBlocked}>
        <Save className="h-4 w-4" /> {t("admin.common.save")}
      </Button>
      <Button variant="secondary" onClick={() => void onForceLogout()} disabled={forcingLogout}>
        <ShieldCheck className="h-4 w-4" /> {t("admin.userDetail.forceLogout")}
      </Button>
      <Button variant="outline" onClick={() => void loadProfile()}>
        <RefreshCcw className="h-4 w-4" /> {t("admin.common.reset")}
      </Button>
      <Button variant="destructive" onClick={onDelete} disabled={deleting}>
        <Trash2 className="h-4 w-4" /> {t("admin.userDetail.deleteUser")}
      </Button>
    </>
  );

  return (
    <div className="space-y-5 pb-8">
      <UserPageHeader user={user} active="overview" actions={headerActions} />

      {(error || notice) && (
        <Card className="glass border-white/10">
          <CardContent className="py-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="break-all text-sm text-emerald-300">{notice}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCircle2 className="h-5 w-5 text-cyan-100" /> {t("admin.userDetail.accountCard")}
            </CardTitle>
            <CardDescription>{t("admin.userDetail.accountCardDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-1">
                <p className="text-xs text-muted-foreground">{t("admin.userDetail.displayName")}</p>
                <Input value={form.name} onChange={(e) => setForm((p) => (p ? { ...p, name: e.target.value } : p))} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.users.role")}</p>
                <SelectField value={form.role} onChange={(e) => setForm((p) => (p ? { ...p, role: e.target.value as Role } : p))}>
                  <option value="CLIENT">CLIENT</option>
                  <option value="COMPANY">COMPANY</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="SUPPORT">SUPPORT</option>
                </SelectField>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.users.status")}</p>
                <SelectField
                  value={form.accountStatus}
                  disabled={statusLocked}
                  onChange={(e) => setForm((p) => (p ? { ...p, accountStatus: e.target.value as AccountStatus } : p))}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="FROZEN_PENDING_DELETION">FROZEN_PENDING_DELETION</option>
                  <option value="BLOCKED">BLOCKED</option>
                </SelectField>
                {statusLocked && (
                  <p className="text-xs leading-5 text-amber-200/80">
                    {t("admin.userDetail.adminStatusLocked")}
                  </p>
                )}
              </div>
            </div>

            {roleLeavesOwnedCompany && companyOwnership && (
              <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-50">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 rounded-xl border border-amber-200/20 bg-amber-200/10 p-2 text-amber-100">
                    <AlertTriangle className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <p className="font-semibold">
                        Смена роли владельца компании
                      </p>
                      <p className="mt-1 text-amber-100/80">
                        {needsCompanyTransfer
                          ? `Если изменить роль, компания «${companyOwnership.name}» перейдёт другому сотруднику. Выберите нового владельца.`
                          : `Для компании «${companyOwnership.name}» не найден новый владелец.`}
                      </p>
                    </div>

                    {needsCompanyTransfer ? (
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                        <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-amber-100/70">
                          <Building2 className="h-4 w-4" /> Новый владелец
                        </span>
                        <SelectField
                          value={companyTransferToUserUuid}
                          onChange={(event) => setCompanyTransferToUserUuid(event.target.value)}
                          className="border-amber-200/20 bg-black/30"
                        >
                          <option value="">Выберите сотрудника</option>
                          {companyTransferCandidates.map((member) => (
                            <option key={member.uuid} value={member.uuid}>
                              {member.name} · {member.email} · {member.role}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                    ) : (
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-300/20 bg-red-500/10 p-3 text-red-50">
                        <input
                          type="checkbox"
                          checked={confirmCompanyDeletion}
                          onChange={(event) => setConfirmCompanyDeletion(event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-red-200/40 accent-red-400"
                        />
                        <span>
                          Подтверждаю: после смены роли компания будет деактивирована и удалена.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <InfoTile icon={Mail} label={t("admin.userDetail.emailReadonly")} value={user.email} />
              <InfoTile icon={KeyRound} label={t("admin.userDetail.telegramReadonly")} value={user.telegramId ?? t("admin.userDetail.notLinked")} />
              <InfoTile icon={CalendarClock} label={t("admin.userDetail.emailVerifiedAt")} value={formatDateTime(user.emailVerifiedAt, locale)} />
              <InfoTile icon={CalendarClock} label={t("admin.userDetail.createdAt")} value={formatDateTime(user.createdAt, locale)} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.userDetail.emailVerifiedAtEdit")}</p>
                <Input type="datetime-local" value={form.emailVerifiedAt} onChange={(e) => setForm((p) => (p ? { ...p, emailVerifiedAt: e.target.value } : p))} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t("admin.userDetail.createdAtEdit")}</p>
                <Input type="datetime-local" value={form.createdAt} onChange={(e) => setForm((p) => (p ? { ...p, createdAt: e.target.value } : p))} />
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.04] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <UserPlus className="h-5 w-5 text-cyan-100" /> Компания сотрудника
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Создайте новую компанию для пользователя или привяжите его сотрудником к существующей.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
                  {user.companyMemberships.filter((membership) => membership.isActive).length} активных связей
                </Badge>
              </div>

              {user.companyMemberships.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {user.companyMemberships.slice(0, 3).map((membership) => (
                    <div key={membership.uuid} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{membership.company.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {membership.company.slug} · {membership.role}
                          {membership.company.isOwnedByUser ? " · владелец" : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className={membership.isActive ? "border-emerald-200/30 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.04] text-muted-foreground"}>
                        {membership.isActive ? "Активна" : "Отключена"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCompanyAssignmentMode("CREATE_NEW")}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm transition",
                    companyAssignmentMode === "CREATE_NEW"
                      ? "border-cyan-200/45 bg-cyan-300/12 text-cyan-50"
                      : "border-white/10 bg-black/18 text-muted-foreground hover:bg-white/[0.05]",
                  )}
                >
                  <span className="font-semibold text-foreground">Создать новую компанию</span>
                  <span className="mt-1 block text-xs">Пользователь станет владельцем нового профиля.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompanyAssignmentMode("ATTACH_EXISTING")}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm transition",
                    companyAssignmentMode === "ATTACH_EXISTING"
                      ? "border-cyan-200/45 bg-cyan-300/12 text-cyan-50"
                      : "border-white/10 bg-black/18 text-muted-foreground hover:bg-white/[0.05]",
                  )}
                >
                  <span className="font-semibold text-foreground">Привязать к текущей</span>
                  <span className="mt-1 block text-xs">Для нового сотрудника или перепривязки между компаниями.</span>
                </button>
              </div>

              {companyAssignmentMode === "ATTACH_EXISTING" && (
                <div className="mt-4 space-y-3">
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadCompanyProfiles(companyAssignmentQuery);
                    }}
                  >
                    <Input
                      value={companyAssignmentQuery}
                      onChange={(event) => setCompanyAssignmentQuery(event.target.value)}
                      placeholder="Поиск компании по названию, slug, владельцу"
                    />
                    <Button type="submit" variant="secondary" disabled={loadingCompanyProfiles}>
                      <Search className="h-4 w-4" /> Найти
                    </Button>
                  </form>

                  <div className="grid gap-3 md:grid-cols-[1.5fr_0.8fr]">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Компания</p>
                      <SelectField
                        value={companyAssignmentCompanyId}
                        onChange={(event) => setCompanyAssignmentCompanyId(event.target.value)}
                      >
                        <option value="">Выберите компанию</option>
                        {companyProfiles.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name} · {company.slug} · {company.owner?.email ?? "без владельца"}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Роль в компании</p>
                      <SelectField
                        value={companyAssignmentMemberRole}
                        onChange={(event) => setCompanyAssignmentMemberRole(event.target.value as CompanyMemberRole)}
                      >
                        <option value="MANAGER">MANAGER</option>
                        <option value="CASHIER">CASHIER</option>
                        <option value="OWNER">OWNER</option>
                      </SelectField>
                    </div>
                  </div>

                  {selectedCompanyProfile && (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{selectedCompanyProfile.name}</span>
                      <span> · владелец: {selectedCompanyProfile.owner?.email ?? "не назначен"}</span>
                      <span> · сотрудников: {selectedCompanyProfile._count.members}</span>
                    </div>
                  )}

                  {companyAssignmentMemberRole === "OWNER" && (
                    <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                      Роль OWNER передаст владение выбранной компанией этому пользователю. Текущий владелец будет понижен до MANAGER.
                    </p>
                  )}
                </div>
              )}

              {companyAssignmentMode === "CREATE_NEW" && (
                <p className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-muted-foreground">
                  Будет создан новый профиль компании с названием по имени пользователя. Его можно будет переименовать в настройках компании.
                </p>
              )}

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={companyAssignmentDeactivatePrevious}
                    onChange={(event) => setCompanyAssignmentDeactivatePrevious(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-cyan-200/30 accent-cyan-300"
                  />
                  <span>Отключить другие активные привязки сотрудника</span>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void onAssignCompany()}
                  disabled={!canRunCompanyAssignment || assigningCompany}
                >
                  <Building2 className="h-4 w-4" /> {assigningCompany ? "Сохраняю..." : "Применить привязку"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="glass overflow-hidden border-cyan-200/20 bg-cyan-300/[0.04]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-cyan-100" /> Статусы профиля
              </CardTitle>
              <CardDescription>Открывайте пользователю коллекционные статусы и смотрите, что уже доступно.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {profileStatuses.some((status) => status.selected) ? (
                profileStatuses.filter((status) => status.selected).map((status) => (
                  <ProfileStatusBadge key={status.id} rarity={status.rarity} icon={status.icon} title={status.title} />
                ))
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-muted-foreground">Пользователь ещё не выбрал активный статус.</p>
              )}

              <div className="grid gap-2">
                {profileStatuses.filter((status) => status.unlocked).slice(0, 5).map((status) => {
                  const meta = profileStatusRarityClass(status.rarity);
                  return (
                    <div key={status.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", meta.ring, meta.surface, meta.text)}>
                        <ProfileStatusIcon icon={status.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{status.title}</p>
                        <p className="text-xs text-muted-foreground">{status.source ?? "открыт"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <SelectField value={grantStatusId} onChange={(event) => setGrantStatusId(event.target.value)}>
                  <option value="">Выберите статус для выдачи</option>
                  {profileStatuses.filter((status) => !status.unlocked).map((status) => (
                    <option key={status.id} value={status.id}>{status.title} · {status.rarity}</option>
                  ))}
                </SelectField>
                <Button onClick={() => void onGrantProfileStatus()} disabled={!grantStatusId || grantingStatus}>
                  <Sparkles className="h-4 w-4" /> {grantingStatus ? "Выдаю..." : "Открыть"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <SectionLink href={`/admin/users/${user.uuid}/relations`} icon={WalletCards} title={t("admin.userDetail.relations")} description={t("admin.userDetail.relationsHint")} count={snapshot.relations} />
          <SectionLink href={`/admin/users/${user.uuid}/activity`} icon={Sparkles} title={t("admin.userDetail.activity")} description={t("admin.userDetail.activityHint")} count={snapshot.activity} />
          <SectionLink href={`/admin/users/${user.uuid}/security`} icon={ShieldCheck} title={t("admin.userDetail.security")} description={t("admin.userDetail.securityHint")} count={snapshot.security} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="glass border-cyan-300/20 bg-cyan-400/5">
          <CardHeader className="pt-3 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-cyan-100" /> Написать пользователю
            </CardTitle>
            <CardDescription>Отправьте письмо на текущий email пользователя. Сообщение сохранится в истории email.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <Input
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              placeholder="Тема письма"
              maxLength={160}
            />
            <Textarea
              value={emailMessage}
              onChange={(event) => setEmailMessage(event.target.value)}
              placeholder="Текст письма"
              rows={5}
              maxLength={4000}
            />
            <Button onClick={() => void onSendEmail()} disabled={sendingEmail || !emailSubject.trim() || !emailMessage.trim()}>
              <Mail className="h-4 w-4" /> {sendingEmail ? "Отправляем..." : "Отправить письмо"}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-cyan-300/20 bg-cyan-400/5">
          <CardHeader className="pt-3 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-5 w-5 text-cyan-100" /> {t("admin.userDetail.resetEmail")}
            </CardTitle>
            <CardDescription>{t("admin.userDetail.resetEmailDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={t("admin.userDetail.newEmail")} />
              <Button onClick={onRequestEmailChange} disabled={requestingEmailChange || !newEmail.trim()}>
                <Mail className="h-4 w-4" /> {t("admin.userDetail.sendRecovery")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 lg:col-span-2">
          <CardHeader className="pt-3 pb-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ban className="h-5 w-5 text-amber-200" /> {t("admin.userDetail.lockState")}
            </CardTitle>
            <CardDescription>{t("admin.userDetail.lockStateDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            <InfoTile icon={CalendarClock} label={t("admin.userDetail.deletionScheduledAt")} value={user.deletionScheduledAt ? formatDateTime(user.deletionScheduledAt, locale) : t("admin.userDetail.notScheduled")} />
            {user.accountStatus === "FROZEN_PENDING_DELETION" && !statusLocked && (
              <Button variant="secondary" onClick={() => void onReactivate()}>{t("admin.userDetail.reactivate")}</Button>
            )}
            {user.accountStatus === "FROZEN_PENDING_DELETION" && statusLocked && (
              <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                {t("admin.userDetail.adminReactivateLocked")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
