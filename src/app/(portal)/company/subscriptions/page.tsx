"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Gift, Plus, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  companyProfile,
  companySubscriptions,
  createCompanySubscription,
  createCompanyEntitlement,
  type CompanySubscription,
  type EntitlementWindow,
} from "@/lib/api/company-client";

const periodNames: Record<EntitlementWindow, string> = {
  DAY: "день",
  WEEK: "неделю",
  MONTH: "месяц",
  TERM: "срок подписки",
  UNLIMITED: "без лимита использований",
};

export default function CompanySubscriptionsPage() {
  const [items, setItems] = useState<CompanySubscription[]>([]);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    allowance: "1",
    windowValue: "1",
    windowUnit: "DAY" as EntitlementWindow,
  });
  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    price: "",
    renewalValue: "1",
    renewalUnit: "month" as "week" | "month" | "year",
  });

  async function load() {
    try {
      const [subscriptions, profile] = await Promise.all([companySubscriptions(), companyProfile()]);
      setItems(subscriptions);
      setSelectedUuid((current) => current || subscriptions[0]?.uuid || "");
      setCanManage(profile.member.role !== "CASHIER");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Подписки временно недоступны.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => items.find((item) => item.uuid === selectedUuid), [items, selectedUuid]);

  async function createRule() {
    if (!selected || !form.title.trim()) return;
    try {
      await createCompanyEntitlement(selected.uuid, {
        title: form.title,
        description: form.description,
        allowance: Number(form.allowance),
        windowValue: Number(form.windowValue),
        windowUnit: form.windowUnit,
      });
      setSuccess("Правило выдачи добавлено. Оно уже защищает погашение на кассе.");
      setForm({ title: "", description: "", allowance: "1", windowValue: "1", windowUnit: "DAY" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать правило.");
    }
  }

  async function createPlan() {
    if (!planForm.name.trim() || !planForm.description.trim() || !Number(planForm.price)) return;
    try {
      setError("");
      const created = await createCompanySubscription({
        name: planForm.name,
        description: planForm.description,
        price: Number(planForm.price),
        renewalValue: Number(planForm.renewalValue) || 1,
        renewalUnit: planForm.renewalUnit,
      });
      setSuccess("Тариф создан. Теперь добавьте услуги и лимиты выдачи.");
      setPlanForm({ name: "", description: "", price: "", renewalValue: "1", renewalUnit: "month" });
      await load();
      setSelectedUuid(created.uuid);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать тариф.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Каталог услуг</p>
        <h1 className="text-3xl font-semibold">Подписки и погашения</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Опишите контрольные услуги: один кофе в день, десять пачек чая в месяц или единовременный подарок. WhiteBox запретит повторную выдачу сверх лимита.
        </p>
      </header>

      {(error || success) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>
          {error || success}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="glass border-white/10 py-0">
          <CardContent className="space-y-2 p-4">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><WalletCards className="h-4 w-4 text-cyan-100" /> Ваши предложения</h2>
            {items.map((subscription) => (
              <button
                key={subscription.uuid}
                type="button"
                onClick={() => setSelectedUuid(subscription.uuid)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selectedUuid === subscription.uuid ? "border-cyan-200/30 bg-cyan-300/[0.07]" : "border-white/10 hover:bg-white/[0.04]"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{subscription.name}</p>
                  <Badge variant="outline">{subscription.entitlements.length}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{Number(subscription.price).toLocaleString("ru-RU")} ₽ / {subscription.renewalPeriod}</p>
              </button>
            ))}
            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">
                Подписок пока нет. Их создание станет доступно после подтверждения компании.
              </div>
            )}
            {canManage && (
              <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Plus className="h-4 w-4 text-cyan-100" /> Новый тариф
                </h3>
                <Input
                  value={planForm.name}
                  onChange={(event) => setPlanForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Название подписки"
                  className="h-11 rounded-xl"
                />
                <Input
                  value={planForm.description}
                  onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Короткая ценность для клиента"
                  className="h-11 rounded-xl"
                />
                <div className="grid grid-cols-[1fr_70px_112px] gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={planForm.price}
                    onChange={(event) => setPlanForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="Цена, ₽"
                    className="h-11 rounded-xl"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={planForm.renewalValue}
                    onChange={(event) => setPlanForm((current) => ({ ...current, renewalValue: event.target.value }))}
                    className="h-11 rounded-xl"
                  />
                  <select
                    value={planForm.renewalUnit}
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        renewalUnit: event.target.value as "week" | "month" | "year",
                      }))
                    }
                    className="h-11 rounded-xl border border-input bg-background px-2 text-sm"
                  >
                    <option value="week">неделя</option>
                    <option value="month">месяц</option>
                    <option value="year">год</option>
                  </select>
                </div>
                <Button onClick={() => void createPlan()} className="w-full rounded-xl">
                  <Plus /> Создать тариф
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selected ? (
            <>
              <Card className="glass border-white/10 py-0">
                <CardContent className="p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">{selected.name}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
                    </div>
                    <Badge className="h-fit bg-white text-black"><ShieldCheck /> Лимиты защищены</Badge>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {selected.entitlements.map((benefit) => (
                      <div key={benefit.uuid} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <p className="flex items-center gap-2 font-semibold"><Gift className="h-4 w-4 text-cyan-100" /> {benefit.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{benefit.description || "Описание не указано"}</p>
                        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1 text-xs text-cyan-50">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {benefit.windowUnit === "UNLIMITED"
                            ? periodNames.UNLIMITED
                            : `${benefit.allowance} шт. / ${benefit.windowValue} ${periodNames[benefit.windowUnit]}`}
                        </p>
                      </div>
                    ))}
                    {selected.entitlements.length === 0 && <p className="text-sm text-muted-foreground">Правила погашения ещё не описаны.</p>}
                  </div>
                </CardContent>
              </Card>

              {canManage && (
                <Card className="border-cyan-300/15 bg-cyan-300/[0.025] py-0">
                  <CardContent className="p-5">
                    <h3 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Добавить услугу и лимит</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Например, Капучино 350 мл" className="h-11 rounded-xl" />
                      <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Что получает клиент" className="h-11 rounded-xl" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" min={1} disabled={form.windowUnit === "UNLIMITED"} value={form.allowance} onChange={(event) => setForm((current) => ({ ...current, allowance: event.target.value }))} placeholder="Количество" className="h-11 rounded-xl" />
                        <Input type="number" min={1} disabled={form.windowUnit === "UNLIMITED"} value={form.windowValue} onChange={(event) => setForm((current) => ({ ...current, windowValue: event.target.value }))} placeholder="Период" className="h-11 rounded-xl" />
                      </div>
                      <select
                        value={form.windowUnit}
                        onChange={(event) => setForm((current) => ({ ...current, windowUnit: event.target.value as EntitlementWindow }))}
                        className="h-11 rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="DAY">Каждый день</option>
                        <option value="WEEK">Каждую неделю</option>
                        <option value="MONTH">Каждый месяц</option>
                        <option value="TERM">Один раз за срок подписки</option>
                        <option value="UNLIMITED">Без лимита использований</option>
                      </select>
                    </div>
                    {form.windowUnit === "UNLIMITED" && (
                      <p className="mt-3 text-sm text-cyan-100/80">
                        Подходит для доступа в фитнес-клуб или пространство: каждое посещение фиксируется, но количество входов не ограничивается.
                      </p>
                    )}
                    <Button onClick={() => void createRule()} className="mt-4 rounded-xl"><Plus /> Сохранить правило</Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-muted-foreground">
              Выберите подписку, чтобы настроить выдачу.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
