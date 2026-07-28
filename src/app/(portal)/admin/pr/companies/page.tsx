"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, RefreshCcw, Save, Search, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type ReferralStatus = "ACTIVE" | "PAUSED" | "ENDED";
type PipelineStatus = "LEAD" | "NEGOTIATION" | "TRIAL" | "CONNECTED" | "REVENUE_ACTIVE" | "LOST";
type PipelineDisplayStatus = PipelineStatus | "SUBSCRIPTION_EXPIRED";
type PipelineLockReason = "ACTIVE_SUBSCRIPTION" | "EXPIRED_SUBSCRIPTION" | null;

type PrCompany = {
  uuid: string;
  status: ReferralStatus;
  pipelineStatus: PipelineStatus;
  pipelineLockReason: PipelineLockReason;
  source: string;
  notes: string | null;
  referralPercent: number;
  updatedAt: string;
  company: {
    slug: string;
    name: string;
    isActive: boolean;
    verificationStatus: string;
    billingStatus: string | null;
    billingEndsAt: string | null;
    hasPaidNearloySubscription: boolean;
  };
  referrer: {
    name: string;
    email: string;
  };
};

type EditableCompany = {
  companyName: string;
  status: ReferralStatus;
  pipelineStatus: PipelineStatus;
  source: string;
  notes: string;
};

const statusLabels: Record<ReferralStatus, string> = {
  ACTIVE: "PR активен",
  PAUSED: "На паузе",
  ENDED: "Завершено",
};

const pipelineLabels: Record<PipelineDisplayStatus, string> = {
  LEAD: "Новый лид",
  NEGOTIATION: "Переговоры",
  TRIAL: "Тест",
  CONNECTED: "Договорились",
  REVENUE_ACTIVE: "Приносит прибыль",
  LOST: "Отказ",
  SUBSCRIPTION_EXPIRED: "Не оплачивают подписку",
};

const manualPipelineStatuses: PipelineStatus[] = ["LEAD", "NEGOTIATION", "TRIAL", "CONNECTED", "LOST"];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

function editFromCompany(company: PrCompany): EditableCompany {
  return {
    companyName: company.company.name,
    status: company.status,
    pipelineStatus: company.pipelineStatus,
    source: company.source,
    notes: company.notes ?? "",
  };
}

function getDisplayPipelineStatus(company: PrCompany): PipelineDisplayStatus {
  if (company.pipelineLockReason === "ACTIVE_SUBSCRIPTION") return "REVENUE_ACTIVE";
  if (company.pipelineLockReason === "EXPIRED_SUBSCRIPTION") return "SUBSCRIPTION_EXPIRED";
  return company.pipelineStatus;
}

function getPipelineLockText(reason: PipelineLockReason) {
  if (reason === "ACTIVE_SUBSCRIPTION") return "Компания оплачивает NearLoy — этап фиксируется автоматически.";
  if (reason === "EXPIRED_SUBSCRIPTION") return "Компания уже платила за NearLoy — этап фиксируется автоматически.";
  return "";
}

export default function AdminPrCompaniesPage() {
  const [items, setItems] = useState<PrCompany[]>([]);
  const [edits, setEdits] = useState<Record<string, EditableCompany>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUuid, setSavingUuid] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/companies", { cache: "no-store" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось загрузить компании PR.");
      setItems([]);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as { items: PrCompany[] };
    setItems(data.items);
    setEdits(Object.fromEntries(data.items.map((item) => [item.uuid, editFromCompany(item)])));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.company.name, item.company.slug, item.source, item.referrer.email, pipelineLabels[getDisplayPipelineStatus(item)]]
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [items, query]);

  async function save(uuid: string) {
    const edit = edits[uuid];
    if (!edit) return;
    setSavingUuid(uuid);
    setNotice("");
    setError("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/companies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referralUuid: uuid, ...edit }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось сохранить изменения.");
      setSavingUuid("");
      return;
    }

    const updated = (await response.json()) as PrCompany;
    setItems((current) => current.map((item) => (item.uuid === uuid ? updated : item)));
    setEdits((current) => ({ ...current, [uuid]: editFromCompany(updated) }));
    setNotice("Воронка обновлена.");
    setSavingUuid("");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_34%),rgba(255,255,255,0.035)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <UsersRound className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Привлечённые компании</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Компании, закреплённые за PR-менеджером: название, стадия воронки и рабочие заметки.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-11" placeholder="Поиск по компании, slug, стадии или источнику..." />
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/leads">Заявки с лендинга</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin/company-billing-promos">Промокоды</Link>
        </Button>
      </div>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      <div className="grid gap-3">
        {loading ? (
          <Card className="border-white/10 bg-white/[0.035] p-6 text-muted-foreground">Загружаю компании...</Card>
        ) : filteredItems.length === 0 ? (
          <Card className="border-white/10 bg-white/[0.035] p-6 text-muted-foreground">Компаний по этим условиям нет.</Card>
        ) : (
          filteredItems.map((item) => {
            const edit = edits[item.uuid] ?? editFromCompany(item);
            const displayPipelineStatus = getDisplayPipelineStatus(item);
            const pipelineLockText = getPipelineLockText(item.pipelineLockReason);
            return (
              <Card key={item.uuid} className="overflow-hidden border-white/10 bg-white/[0.035]">
                <CardContent className="grid gap-4 p-4 xl:grid-cols-[minmax(240px,1.1fr)_minmax(360px,1.7fr)_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building2 className="h-4 w-4 text-cyan-100" />
                      <h2 className="truncate text-lg font-semibold">{item.company.name}</h2>
                      <Badge variant={item.status === "ACTIVE" ? "default" : "secondary"}>{statusLabels[item.status]}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">/{item.company.slug}</p>
                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <span>Биллинг: {item.company.billingStatus ?? "нет"}</span>
                      <span>До: {formatDate(item.company.billingEndsAt)}</span>
                      <span>Верификация: {item.company.verificationStatus}</span>
                      <span>PR: {item.referralPercent}%</span>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_160px_180px]">
                      <Input
                        value={edit.companyName}
                        maxLength={120}
                        onChange={(event) =>
                          setEdits((current) => ({ ...current, [item.uuid]: { ...edit, companyName: event.target.value } }))
                        }
                        placeholder="Название компании"
                      />
                      <select
                        value={edit.status}
                        onChange={(event) =>
                          setEdits((current) => ({ ...current, [item.uuid]: { ...edit, status: event.target.value as ReferralStatus } }))
                        }
                        className="h-11 rounded-xl border border-white/10 bg-black px-3 text-sm"
                      >
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {item.pipelineLockReason ? (
                        <div
                          className="flex h-11 items-center justify-between gap-2 rounded-xl border border-cyan-200/15 bg-cyan-300/10 px-3 text-sm text-cyan-50"
                          title={pipelineLockText}
                        >
                          <span className="truncate">{pipelineLabels[displayPipelineStatus]}</span>
                          <Badge variant="outline" className="shrink-0 border-cyan-200/20 text-[10px] text-cyan-100">
                            авто
                          </Badge>
                        </div>
                      ) : (
                        <select
                          value={edit.pipelineStatus}
                          onChange={(event) =>
                            setEdits((current) => ({ ...current, [item.uuid]: { ...edit, pipelineStatus: event.target.value as PipelineStatus } }))
                          }
                          className="h-11 rounded-xl border border-white/10 bg-black px-3 text-sm"
                        >
                          {manualPipelineStatuses.map((value) => (
                            <option key={value} value={value}>{pipelineLabels[value]}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    {pipelineLockText && (
                      <p className="text-xs text-cyan-100/70">{pipelineLockText}</p>
                    )}
                    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                      <Input
                        value={edit.source}
                        maxLength={80}
                        onChange={(event) =>
                          setEdits((current) => ({ ...current, [item.uuid]: { ...edit, source: event.target.value } }))
                        }
                        placeholder="Источник"
                      />
                      <textarea
                        value={edit.notes}
                        maxLength={4000}
                        onChange={(event) =>
                          setEdits((current) => ({ ...current, [item.uuid]: { ...edit, notes: event.target.value } }))
                        }
                        placeholder="Заметки по воронке"
                        className="min-h-11 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm outline-none transition focus:border-cyan-200/40"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:flex-col">
                    <Button onClick={() => void save(item.uuid)} disabled={savingUuid === item.uuid}>
                      <Save className="h-4 w-4" />
                      {savingUuid === item.uuid ? "Сохраняю..." : "Сохранить"}
                    </Button>
                    <Button asChild variant="secondary">
                      <Link href={`/wallet/${item.company.slug}`}>
                        Карточка <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
