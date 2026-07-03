"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BadgePercent, Handshake, Megaphone, RotateCcw, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  adminEndCompanyReferral,
  adminGetCompanyReferral,
  adminUpsertCompanyReferral,
  type AdminCompanyReferralPipelineStatus,
  type AdminCompanyReferralResponse,
  type AdminCompanyReferralStatus,
} from "@/lib/api/admin-client";

const pipelineOptions: Array<{ value: AdminCompanyReferralPipelineStatus; label: string }> = [
  { value: "LEAD", label: "Лид" },
  { value: "NEGOTIATION", label: "Переговоры" },
  { value: "TRIAL", label: "Тестовый период" },
  { value: "CONNECTED", label: "Подключена" },
  { value: "REVENUE_ACTIVE", label: "Приносит доход" },
  { value: "LOST", label: "Потеряна" },
];

const statusOptions: Array<{ value: AdminCompanyReferralStatus; label: string }> = [
  { value: "ACTIVE", label: "Активна" },
  { value: "PAUSED", label: "Пауза" },
  { value: "ENDED", label: "Завершена" },
];

function money(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export default function AdminCompanyReferralPage() {
  const params = useParams<{ uuid: string }>();
  const companyUserUuid = params.uuid;
  const [data, setData] = useState<AdminCompanyReferralResponse | null>(null);
  const [query, setQuery] = useState("");
  const [selectedReferrerId, setSelectedReferrerId] = useState("");
  const [referralPercent, setReferralPercent] = useState("10");
  const [status, setStatus] = useState<AdminCompanyReferralStatus>("ACTIVE");
  const [pipelineStatus, setPipelineStatus] = useState<AdminCompanyReferralPipelineStatus>("LEAD");
  const [source, setSource] = useState("admin");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReferral = useCallback(async (nextQuery = "") => {
    setLoading(true);
    setError(null);
    const res = await adminGetCompanyReferral(companyUserUuid, nextQuery);
    if (!res.ok) {
      setError(res.message);
      setLoading(false);
      return;
    }
    setData(res.data);
    if (res.data.referral) {
      setSelectedReferrerId(String(res.data.referral.referrer.id));
      setReferralPercent(String(Number(res.data.referral.referralPercent)));
      setStatus(res.data.referral.status);
      setPipelineStatus(res.data.referral.pipelineStatus);
      setSource(res.data.referral.source);
      setNotes(res.data.referral.notes ?? "");
    }
    setLoading(false);
  }, [companyUserUuid]);

  useEffect(() => {
    void loadReferral();
  }, [loadReferral]);

  const candidates = useMemo(() => {
    const items = data?.candidates ?? [];
    if (data?.referral && !items.some((candidate) => candidate.id === data.referral?.referrer.id)) {
      return [data.referral.referrer, ...items];
    }
    return items;
  }, [data]);

  async function saveReferral() {
    const referrerUserId = Number(selectedReferrerId);
    const percent = Number(referralPercent);
    if (!referrerUserId || !Number.isFinite(percent) || percent <= 0) {
      setError("Выберите реферала и укажите процент больше нуля.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await adminUpsertCompanyReferral(companyUserUuid, {
      referrerUserId,
      referralPercent: percent,
      status,
      pipelineStatus,
      source,
      notes,
    });
    if (!res.ok) {
      setError(res.message);
      setSaving(false);
      return;
    }
    setData(res.data);
    setSaving(false);
  }

  async function endReferral() {
    setSaving(true);
    setError(null);
    const res = await adminEndCompanyReferral(companyUserUuid);
    if (!res.ok) {
      setError(res.message);
      setSaving(false);
      return;
    }
    setData(res.data);
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href={`/admin/companies/${companyUserUuid}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к компании
            </Link>
          </Button>
          <div>
            <Badge variant="outline" className="mb-3 border-cyan-300/40 bg-cyan-400/10 text-cyan-100">
              <Megaphone className="mr-2 h-3.5 w-3.5" />
              PR и реферальная атрибуция
            </Badge>
            <h1 className="text-3xl font-bold">Реферал компании</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Один ответственный реферал на компанию. Выплата считается от оборота подписок и удерживается из комиссии NearLoy.
            </p>
          </div>
        </div>
      <Button onClick={() => loadReferral(query)} disabled={loading} variant="secondary">
          <RotateCcw className="mr-2 h-4 w-4" />
          Обновить
        </Button>
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/10">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Статус</p>
            <p className="mt-3 text-2xl font-semibold">{data?.referral ? "Назначен" : "Не назначен"}</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Комиссия реферала</p>
            <p className="mt-3 text-2xl font-semibold">{money(data?.revenue.referralCommission ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Оборот подписок</p>
            <p className="mt-3 text-2xl font-semibold">{money(data?.revenue.recognizedGross ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Настройки реферала
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadReferral(query);
              }}
              placeholder="Поиск кандидата по имени, email, uuid"
            />
            <Button type="button" variant="secondary" onClick={() => loadReferral(query)}>
              <Search className="mr-2 h-4 w-4" />
              Найти
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Реферал</Label>
              <SelectField
                value={selectedReferrerId}
                onChange={(event) => setSelectedReferrerId(event.target.value)}
              >
                <option value="">Не выбран</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.email}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <Label>Процент выплаты</Label>
              <Input value={referralPercent} onChange={(event) => setReferralPercent(event.target.value)} inputMode="decimal" />
            </div>
            <div className="space-y-2">
              <Label>Статус</Label>
              <SelectField value={status} onChange={(event) => setStatus(event.target.value as AdminCompanyReferralStatus)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="space-y-2">
              <Label>Воронка</Label>
              <SelectField value={pipelineStatus} onChange={(event) => setPipelineStatus(event.target.value as AdminCompanyReferralPipelineStatus)}>
                {pipelineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <div className="space-y-2">
              <Label>Источник</Label>
              <Input value={source} onChange={(event) => setSource(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Заметки</Label>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {data?.referral ? (
              <Button type="button" variant="outline" onClick={endReferral} disabled={saving}>
                Завершить реферала
              </Button>
            ) : null}
            <Button type="button" onClick={saveReferral} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              Сохранить
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/10">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div>
            <BadgePercent className="mb-2 h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">Комиссия NearLoy</p>
            <p className="text-sm text-muted-foreground">{money(data?.revenue.platformCommissionGross ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Чистая комиссия</p>
            <p className="text-sm text-muted-foreground">{money(data?.revenue.whiteBoxNetCommission ?? 0)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold">Потенциальный оборот</p>
            <p className="text-sm text-muted-foreground">{money(data?.revenue.futureGross ?? 0)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
