"use client";

import { useEffect, useState } from "react";
import { BadgePercent, CalendarClock, Power, Sparkles, TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAccessToken } from "@/lib/api/auth-client";

type Promo = {
  uuid: string;
  code: string;
  title: string;
  discountPercent: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  isActive: boolean;
};

async function api(path = "", init?: RequestInit) {
  const response = await fetch(`/api/admin/company-billing-promos${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken() ?? ""}`,
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
  return payload;
}

export default function CompanyBillingPromosPage() {
  const [items, setItems] = useState<Promo[]>([]);
  const [form, setForm] = useState({ code: "", title: "", discountPercent: "100", maxRedemptions: "", expiresAt: "" });
  const [message, setMessage] = useState("");

  async function load() {
    try {
      setItems(await api());
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить промокоды.");
    }
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    try {
      await api("", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          discountPercent: Number(form.discountPercent),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      setForm({ code: "", title: "", discountPercent: "100", maxRedemptions: "", expiresAt: "" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать промокод.");
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
          <TicketPercent className="h-4 w-4" /> PR и продажи
        </p>
        <h1 className="text-3xl font-semibold">Промокоды на подписку NearLoy</h1>
        <p className="mt-2 text-muted-foreground">Администраторы и PR-менеджеры могут предоставить компании скидку вплоть до 100%.</p>
      </header>

      {message && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{message}</div>}

      <section className="rounded-3xl border border-cyan-200/15 bg-cyan-300/[0.035] p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-cyan-100" /> Создать промокод</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Код" />
          <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Название кампании" />
          <Input value={form.discountPercent} onChange={(event) => setForm({ ...form, discountPercent: event.target.value })} type="number" min="0" max="100" placeholder="Скидка, %" />
          <Input value={form.maxRedemptions} onChange={(event) => setForm({ ...form, maxRedemptions: event.target.value })} type="number" min="1" placeholder="Лимит активаций" />
          <Input value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} type="datetime-local" />
        </div>
        <Button className="mt-4" onClick={() => void create()} disabled={!form.code || !form.title}>
          <BadgePercent /> Создать промокод
        </Button>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {items.map((promo) => (
          <article key={promo.uuid} className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-cyan-100">{promo.code}</p>
                <h2 className="mt-1 text-xl font-semibold">{promo.title}</h2>
              </div>
              <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-lg font-semibold text-cyan-50">-{promo.discountPercent}%</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>{promo.redemptionCount}{promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ""} активаций</span>
              <span className="flex items-center gap-1"><CalendarClock className="h-4 w-4" /> {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString("ru-RU") : "без срока"}</span>
            </div>
            <Button
              variant="secondary"
              className="mt-5"
              onClick={async () => {
                await api(`/${promo.uuid}`, { method: "PATCH", body: JSON.stringify({ isActive: !promo.isActive }) });
                await load();
              }}
            >
              <Power /> {promo.isActive ? "Отключить" : "Включить"}
            </Button>
          </article>
        ))}
      </section>
    </div>
  );
}
