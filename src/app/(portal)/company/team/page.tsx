"use client";

import { useEffect, useState } from "react";
import { Crown, ShieldCheck, Store, UserCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  companyTeam,
  createCompanyTeamMember,
  setCompanyTeamMemberRole,
  setCompanyTeamMemberStatus,
  type CompanyMemberRole,
} from "@/lib/api/company-client";

const roleMeta: Record<CompanyMemberRole, { label: string; icon: typeof Crown; description: string }> = {
  OWNER: { label: "Владелец", icon: Crown, description: "Полное управление компанией" },
  MANAGER: { label: "Руководитель", icon: ShieldCheck, description: "Команда, подписки и финансы" },
  CASHIER: { label: "Кассир", icon: Store, description: "QR, начисление и выдача услуг" },
};

type TeamMember = Awaited<ReturnType<typeof companyTeam>>[number];

export default function CompanyTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "CASHIER" as "MANAGER" | "CASHIER" });

  async function load() {
    try {
      setMembers(await companyTeam());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Раздел доступен руководителю компании.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addMember() {
    try {
      await createCompanyTeamMember(form);
      setNotice("Сотрудник создан. Передайте временный пароль безопасным способом.");
      setForm({ name: "", email: "", password: "", role: "CASHIER" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать сотрудника.");
    }
  }

  async function changeRole(member: TeamMember, role: "MANAGER" | "CASHIER") {
    try {
      await setCompanyTeamMemberRole(member.uuid, role);
      setNotice(`Роль сотрудника ${member.user.name} обновлена.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить роль.");
    }
  }

  async function changeStatus(member: TeamMember, isActive: boolean) {
    try {
      await setCompanyTeamMemberStatus(member.uuid, isActive);
      setNotice(isActive ? `Доступ сотрудника ${member.user.name} восстановлен.` : `Доступ сотрудника ${member.user.name} приостановлен.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить доступ.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Доступ сотрудников</p>
        <h1 className="text-3xl font-semibold">Команда компании</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Эти роли действуют только внутри вашей компании и никогда не дают доступ к админке WhiteBox.
        </p>
      </header>

      {(error || notice) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>
          {error || notice}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        {(Object.entries(roleMeta) as Array<[CompanyMemberRole, (typeof roleMeta)[CompanyMemberRole]]>).map(([key, role]) => {
          const Icon = role.icon;
          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-cyan-100" /> {role.label}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{role.description}</p>
            </div>
          );
        })}
      </section>

      <Card className="glass border-white/10 py-0">
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><UserPlus className="h-4 w-4 text-cyan-100" /> Добавить сотрудника</h2>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr_1fr_180px_auto]">
            <Input placeholder="Имя" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-11 rounded-xl" />
            <Input placeholder="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="h-11 rounded-xl" />
            <Input placeholder="Временный пароль" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="h-11 rounded-xl" />
            <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as "MANAGER" | "CASHIER" }))} className="h-11 rounded-xl border border-input bg-background px-3 text-sm">
              <option value="CASHIER">Кассир</option>
              <option value="MANAGER">Руководитель</option>
            </select>
            <Button onClick={() => void addMember()} className="h-11 rounded-xl">Создать</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/10 py-0">
        <CardContent className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-cyan-100" /> Сотрудники и доступ</h2>
          <div className="space-y-2">
            {members.map((member) => {
              const meta = roleMeta[member.role];
              const Icon = meta.icon;
              return (
                <div key={member.uuid} className={`grid items-center gap-3 rounded-2xl border border-white/10 p-4 sm:grid-cols-[minmax(0,1fr)_auto_180px_auto] ${member.isActive ? "bg-white/[0.02]" : "bg-red-300/[0.035] opacity-80"}`}>
                  <div className="min-w-0">
                    <p className="font-semibold">{member.user.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline"><Icon /> {meta.label}</Badge>
                    <Badge variant="outline">{member.isActive ? "Доступен" : "Отключён"}</Badge>
                  </div>
                  {member.role === "OWNER" ? (
                    <p className="text-right text-xs text-muted-foreground">Не изменяется</p>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(event) => void changeRole(member, event.target.value as "MANAGER" | "CASHIER")}
                      className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="CASHIER">Кассир</option>
                      <option value="MANAGER">Руководитель</option>
                    </select>
                  )}
                  {member.role !== "OWNER" && (
                    <Button
                      variant={member.isActive ? "destructive" : "secondary"}
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void changeStatus(member, !member.isActive)}
                    >
                      {member.isActive ? <UserMinus /> : <UserCheck />}
                      {member.isActive ? "Отключить" : "Вернуть"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
