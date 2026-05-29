"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CalendarRange, CheckCircle2, Gift, Infinity as InfinityIcon, PackagePlus, ShieldCheck, Sparkles, Sun, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import { companyProfile, createCompanySubscription, type EntitlementWindow } from "@/lib/api/company-client";

type RenewalUnit = "week" | "month" | "year";

const renewalOptions = [
  { value: "week", label: "Неделя", description: "Короткий тестовый тариф", icon: CalendarDays },
  { value: "month", label: "Месяц", description: "Самый понятный формат", icon: CalendarRange },
  { value: "year", label: "Год", description: "Долгий доступ с выгодой", icon: ShieldCheck },
];

const entitlementWindowOptions = [
  { value: "DAY", label: "Каждый день", description: "Лимит обновляется ежедневно", icon: Sun },
  { value: "WEEK", label: "Каждую неделю", description: "Лимит обновляется раз в неделю", icon: CalendarDays },
  { value: "MONTH", label: "Каждый месяц", description: "Лимит обновляется раз в месяц", icon: CalendarRange },
  { value: "TERM", label: "Один раз за срок", description: "Общий лимит на весь период подписки", icon: Ticket },
  { value: "UNLIMITED", label: "Без лимита использований", description: "Например, проход в клуб без ограничений", icon: InfinityIcon },
];

function formatMoney(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0 ₽";
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function renewalLabel(value: string, unit: RenewalUnit) {
  const amount = Number(value) || 1;
  const labels: Record<RenewalUnit, [string, string, string]> = {
    week: ["неделя", "недели", "недель"],
    month: ["месяц", "месяца", "месяцев"],
    year: ["год", "года", "лет"],
  };
  const label =
    amount % 10 === 1 && amount % 100 !== 11
      ? labels[unit][0]
      : amount % 10 >= 2 && amount % 10 <= 4 && (amount % 100 < 10 || amount % 100 >= 20)
        ? labels[unit][1]
        : labels[unit][2];
  return `${amount} ${label}`;
}

function entitlementWindowLabel(unit: EntitlementWindow) {
  return entitlementWindowOptions.find((option) => option.value === unit)?.label ?? "Каждый день";
}

export default function NewCompanySubscriptionPage() {
  const router = useRouter();
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    renewalValue: "1",
    renewalUnit: "month" as RenewalUnit,
    serviceTitle: "",
    serviceDescription: "",
    serviceAllowance: "1",
    serviceWindowValue: "1",
    serviceWindowUnit: "DAY" as EntitlementWindow,
  });

  useEffect(() => {
    companyProfile()
      .then((profile) => setCanManage(profile.member.role !== "CASHIER"))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось проверить права компании."))
      .finally(() => setLoading(false));
  }, []);

  const serviceHasLimit = form.serviceWindowUnit !== "UNLIMITED";
  const canCreate = Boolean(
    form.name.trim() &&
      form.description.trim().length >= 5 &&
      Number(form.price) >= 0 &&
      form.serviceTitle.trim().length >= 2 &&
      (!serviceHasLimit || (Number(form.serviceAllowance) >= 1 && Number(form.serviceWindowValue) >= 1)),
  );

  async function submit() {
    if (!canCreate || saving) return;
    try {
      setSaving(true);
      setError("");
      await createCompanySubscription({
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        renewalValue: Number(form.renewalValue) || 1,
        renewalUnit: form.renewalUnit,
        entitlements: [
          {
            title: form.serviceTitle.trim(),
            description: form.serviceDescription.trim() || undefined,
            allowance: serviceHasLimit ? Number(form.serviceAllowance) || 1 : 1,
            windowValue: serviceHasLimit ? Number(form.serviceWindowValue) || 1 : 1,
            windowUnit: form.serviceWindowUnit,
          },
        ],
      });
      router.push("/company/subscriptions");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать подписку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="secondary" className="rounded-xl">
        <Link href="/company/subscriptions">
          <ArrowLeft />
          Назад к подпискам
        </Link>
      </Button>

      <header className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,13,18,0.98))] p-5 md:p-6">
        <div className="pointer-events-none absolute right-10 top-8 h-28 w-28 rounded-full bg-cyan-200/10 blur-3xl" />
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          <PackagePlus className="h-3.5 w-3.5" />
          Новый тариф
        </p>
        <h1 className="text-3xl font-semibold md:text-4xl">Создать подписку</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Сначала создаём понятный тариф и сразу добавляем первую услугу. Подписка без услуги не продаётся и не может быть погашена на кассе.
        </p>
      </header>

      {error && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      {!loading && !canManage ? (
        <div className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.07] p-6 text-amber-50">
          Создавать подписки может владелец или менеджер компании. Кассиру доступна касса и погашение услуг.
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <Card className="glass border-white/10 py-0">
            <CardContent className="space-y-4 p-5 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Название подписки</span>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Aurora Coffee Plus"
                    maxLength={160}
                    className="h-12 rounded-xl"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Цена, ₽</span>
                  <Input
                    type="number"
                    min={0}
                    value={form.price}
                    onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                    placeholder="999"
                    className="h-12 rounded-xl"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Короткая ценность для клиента</span>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Например: ежедневный напиток, закрытые акции и быстрые бонусы за покупки."
                  maxLength={1000}
                  className="min-h-36 rounded-xl"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Срок</span>
                  <Input
                    type="number"
                    min={1}
                    max={36}
                    value={form.renewalValue}
                    onChange={(event) => setForm((current) => ({ ...current, renewalValue: event.target.value }))}
                    className="h-12 rounded-xl text-center"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Период действия</span>
                  <OptionSelect
                    value={form.renewalUnit}
                    onChange={(value) => setForm((current) => ({ ...current, renewalUnit: value as RenewalUnit }))}
                    options={renewalOptions}
                    placeholder="Выберите период"
                  />
                </label>
              </div>

              <section className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-300/[0.045] p-4 md:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      <Gift className="h-5 w-5 text-cyan-100" />
                      Первая услуга обязательна
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Это то, что кассир сможет погашать у клиента по подписке: кофе, проход, консультация или доставка.
                    </p>
                  </div>
                  <span className="w-fit rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1 text-xs font-semibold text-cyan-50">
                    минимум 1 услуга
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Название услуги</span>
                    <Input
                      value={form.serviceTitle}
                      onChange={(event) => setForm((current) => ({ ...current, serviceTitle: event.target.value }))}
                      placeholder="Напиток из классического меню"
                      maxLength={120}
                      className="h-12 rounded-xl"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Период лимита</span>
                    <OptionSelect
                      value={form.serviceWindowUnit}
                      onChange={(value) => setForm((current) => ({ ...current, serviceWindowUnit: value as EntitlementWindow }))}
                      options={entitlementWindowOptions}
                      placeholder="Как часто обновляется лимит"
                    />
                  </label>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium">Описание услуги</span>
                  <Textarea
                    value={form.serviceDescription}
                    onChange={(event) => setForm((current) => ({ ...current, serviceDescription: event.target.value }))}
                    placeholder="Например: один кофе или чай стандартного размера на выбор гостя."
                    maxLength={500}
                    className="min-h-28 rounded-xl"
                  />
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Сколько раз</span>
                    <Input
                      type="number"
                      min={1}
                      max={1000}
                      disabled={!serviceHasLimit}
                      value={serviceHasLimit ? form.serviceAllowance : ""}
                      placeholder="∞"
                      onChange={(event) => setForm((current) => ({ ...current, serviceAllowance: event.target.value }))}
                      className="h-12 rounded-xl text-center disabled:opacity-60"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">За периодов</span>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      disabled={!serviceHasLimit}
                      value={serviceHasLimit ? form.serviceWindowValue : ""}
                      placeholder="∞"
                      onChange={(event) => setForm((current) => ({ ...current, serviceWindowValue: event.target.value }))}
                      className="h-12 rounded-xl text-center disabled:opacity-60"
                    />
                  </label>
                </div>

                {!serviceHasLimit && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted-foreground">
                    Безлимитная услуга подходит для прохода в фитнес-клуб, коворкинг или доступной зоны, где количество входов не ограничивается.
                  </div>
                )}
              </section>

              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4 text-sm leading-6 text-cyan-50">
                Подписка создаётся только с первой услугой. Остальные услуги можно будет добавить позже в редактировании тарифа.
              </div>

              <Button onClick={() => void submit()} disabled={!canCreate || saving || !canManage} className="h-12 w-full rounded-xl">
                <CheckCircle2 />
                {saving ? "Создаём..." : "Создать подписку"}
              </Button>
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card className="overflow-hidden border-cyan-300/15 bg-[linear-gradient(135deg,rgba(103,232,249,0.09),rgba(255,255,255,0.02))] py-0">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100">
                    <Ticket className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Предпросмотр</p>
                    <h2 className="mt-1 text-xl font-semibold">{form.name || "Название тарифа"}</h2>
                  </div>
                </div>
                <p className="mt-4 min-h-20 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted-foreground">
                  {form.description || "Здесь будет описание ценности подписки для клиента."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Цена</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(form.price)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Период</p>
                    <p className="mt-2 text-xl font-semibold">{renewalLabel(form.renewalValue, form.renewalUnit)}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
                    {serviceHasLimit ? <Gift className="h-4 w-4" /> : <InfinityIcon className="h-4 w-4" />}
                    {form.serviceTitle || "Первая услуга"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {form.serviceDescription || "Опишите, что клиент сможет получить по этой подписке."}
                  </p>
                  <span className="mt-3 inline-flex rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted-foreground">
                    {serviceHasLimit
                      ? `${Number(form.serviceAllowance) || 1} шт. / ${Number(form.serviceWindowValue) || 1} период (${entitlementWindowLabel(form.serviceWindowUnit)})`
                      : "Без лимита использований"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-5">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-cyan-100" />
                Как сделать тариф сильнее
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                <li>Пишите конкретную пользу: “1 кофе каждый день”, а не “приятные бонусы”.</li>
                <li>Цена должна быть понятна клиенту за первые 3 секунды.</li>
                <li>После создания сразу добавьте хотя бы одну услугу для погашения.</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
