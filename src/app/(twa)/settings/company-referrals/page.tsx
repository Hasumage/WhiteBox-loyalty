"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Copy, HandCoins, Handshake, Loader2, Send, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getUserCompanyReferrals,
  requestUserCompanyReferralPayout,
  type UserCompanyReferralDashboard,
} from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

const emptyDashboard: UserCompanyReferralDashboard = {
  code: "",
  link: "",
  minPayoutRub: 5000,
  totals: {
    companies: 0,
    activeCompanies: 0,
    recognizedGross: 0,
    futureGross: 0,
    referralCommission: 0,
    reserved: 0,
    paid: 0,
    available: 0,
  },
  companies: [],
  payouts: [],
};

export default function CompanyReferralsPage() {
  const [dashboard, setDashboard] = useState<UserCompanyReferralDashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState("5000");

  useEffect(() => {
    let ignore = false;
    void (async () => {
      const response = await getUserCompanyReferrals();
      if (ignore) return;
      if (response.ok) {
        setDashboard(response.data);
        setAmount(String(Math.max(response.data.minPayoutRub, Math.floor(response.data.totals.available))));
      } else {
        setMessage(response.message);
      }
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const canPayout = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) && value >= dashboard.minPayoutRub && value <= dashboard.totals.available;
  }, [amount, dashboard.minPayoutRub, dashboard.totals.available]);

  async function copyLink() {
    if (!dashboard.link) return;
    await navigator.clipboard.writeText(dashboard.link);
    setMessage("РЎСЃС‹Р»РєР° СЃРєРѕРїРёСЂРѕРІР°РЅР°. Р•С‘ РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІРёС‚СЊ РїСЂРµРґРїСЂРёРЅРёРјР°С‚РµР»СЋ РёР»Рё РєРѕРјРїР°РЅРёРё.");
  }

  async function requestPayout() {
    if (!canPayout) return;
    setBusy(true);
    setMessage(null);
    const response = await requestUserCompanyReferralPayout(Number(amount));
    if (response.ok) {
      setDashboard(response.data.dashboard);
      setMessage("Р—Р°СЏРІРєР° РЅР° РІС‹РїР»Р°С‚Сѓ РѕС‚РїСЂР°РІР»РµРЅР°. РђРґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂ РїСЂРѕРІРµСЂРёС‚ РµС‘ РІ С„РёРЅР°РЅСЃРѕРІС‹С… РѕРїРµСЂР°С†РёСЏС….");
    } else {
      setMessage(response.message);
    }
    setBusy(false);
  }

  const stats = [
    { label: "РљРѕРјРїР°РЅРёР№", value: dashboard.totals.companies, detail: "РІСЃРµРіРѕ РїСЂРёРіР»Р°С€РµРЅРѕ", icon: Building2 },
    { label: "РђРєС‚РёРІРЅС‹Рµ", value: dashboard.totals.activeCompanies, detail: "СѓР¶Рµ СЂР°Р±РѕС‚Р°СЋС‚", icon: CheckCircle2 },
    { label: "Р”РѕСЃС‚СѓРїРЅРѕ", value: money(dashboard.totals.available), detail: `РјРёРЅРёРјСѓРј ${money(dashboard.minPayoutRub)}`, icon: WalletCards },
  ];

  return (
    <main className="min-h-screen bg-[#05070d] px-4 pb-24 pt-5 text-white">
      <section className="mx-auto max-w-3xl space-y-4">
        <Button asChild variant="ghost" className="rounded-2xl px-0 text-white/70 hover:text-white">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            РќР°Р·Р°Рґ РІ РЅР°СЃС‚СЂРѕР№РєРё
          </Link>
        </Button>

        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(103,232,249,0.18),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(255,255,255,0.12),transparent_30%)]" />
          <div className="relative space-y-4">
            <Badge variant="secondary" className="gap-2 border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <Handshake className="h-3.5 w-3.5" />
              РљРѕРјРїР°РЅРёСЏ РїРѕ СЂРµРєРѕРјРµРЅРґР°С†РёРё
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">РџСЂРёРіР»Р°С€Р°Р№С‚Рµ РєРѕРјРїР°РЅРёРё РІ NearLoy</h1>
              <p className="mt-2 text-sm leading-6 text-white/58">
                РћС‚РїСЂР°РІСЊС‚Рµ СЃСЃС‹Р»РєСѓ РїСЂРµРґРїСЂРёРЅРёРјР°С‚РµР»СЋ. Р•СЃР»Рё РєРѕРјРїР°РЅРёСЏ РїРѕРґРєР»СЋС‡РёС‚СЃСЏ Рё РЅР°С‡РЅС‘С‚ РїРѕР»СѓС‡Р°С‚СЊ РІС‹СЂСѓС‡РєСѓ СЃ РїРѕРґРїРёСЃРѕРє,
                РІР°Рј Р±СѓРґРµС‚ РЅР°С‡РёСЃР»СЏС‚СЊСЃСЏ СЂРµС„РµСЂР°Р»СЊРЅР°СЏ РґРѕР»СЏ РёР· РєРѕРјРёСЃСЃРёРё NearLoy.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/42">Р’Р°С€Р° СЃСЃС‹Р»РєР°</p>
              <div className="flex gap-2">
                <Input readOnly value={loading ? "РЎРѕР·РґР°С‘Рј СЃСЃС‹Р»РєСѓ..." : dashboard.link} className="h-12 rounded-2xl border-white/10 bg-black/30 text-white" />
                <Button type="button" onClick={copyLink} disabled={!dashboard.link} className="h-12 rounded-2xl bg-white text-black hover:bg-white/90">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-white/42">РљРѕРґ: {dashboard.code || "-"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
              <stat.icon className="mb-4 h-5 w-5 text-cyan-100" />
              <p className="text-xs uppercase tracking-[0.22em] text-white/42">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-xs text-white/46">{stat.detail}</p>
            </div>
          ))}
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/15 bg-cyan-300/10 text-cyan-100">
              <HandCoins className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Р—Р°РїСЂРѕСЃ РІС‹РїР»Р°С‚С‹</h2>
              <p className="text-sm text-white/50">Р—Р°СЏРІРєР° РїРѕРїР°РґС‘С‚ РІ С„РёРЅР°РЅСЃРѕРІС‹Рµ РѕРїРµСЂР°С†РёРё Р°РґРјРёРЅРєРё.</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, "").slice(0, 8))}
              className="h-12 rounded-2xl border-white/10 bg-black/25 text-white"
              placeholder="РЎСѓРјРјР° РІС‹РїР»Р°С‚С‹"
            />
            <Button type="button" disabled={!canPayout || busy} onClick={requestPayout} className="h-12 rounded-2xl bg-white text-black hover:bg-white/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Р—Р°РїСЂРѕСЃРёС‚СЊ
            </Button>
          </div>
        </section>

        {message && (
          <div className={cn("rounded-[1.5rem] border p-4 text-sm", message.includes("РќРµ СѓРґР°Р»РѕСЃСЊ") || message.includes("Failed") ? "border-red-300/20 bg-red-300/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/10 text-cyan-50")}>
            {message}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">РџСЂРёРіР»Р°С€С‘РЅРЅС‹Рµ РєРѕРјРїР°РЅРёРё</h2>
              <p className="text-sm text-white/50">РЎС‚Р°С‚СѓСЃ РїРѕРґРєР»СЋС‡РµРЅРёСЏ Рё РґРѕС…РѕРґ РїРѕ РєР°Р¶РґРѕР№ РєРѕРјРїР°РЅРёРё.</p>
            </div>
            <Badge variant="secondary" className="border-white/10 bg-white/8 text-white">{dashboard.companies.length}</Badge>
          </div>

          {loading ? (
            <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-5 text-white/55">Р—Р°РіСЂСѓР¶Р°РµРј РєРѕРјРїР°РЅРёРё...</div>
          ) : dashboard.companies.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/12 bg-white/[0.035] p-6 text-sm leading-6 text-white/55">
              РџРѕРєР° РЅРµС‚ РїСЂРёРіР»Р°С€С‘РЅРЅС‹С… РєРѕРјРїР°РЅРёР№. РћС‚РїСЂР°РІСЊС‚Рµ СЃСЃС‹Р»РєСѓ РїРµСЂРІРѕРјСѓ РїР°СЂС‚РЅС‘СЂСѓ, Р° NearLoy РїСЂРёРІСЏР¶РµС‚ Р·Р°СЏРІРєСѓ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё.
            </div>
          ) : (
            dashboard.companies.map((company) => (
              <article key={company.slug} className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{company.name}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/38">{company.pipelineStatus} В· {company.verificationStatus}</p>
                  </div>
                  <Badge variant="secondary" className={cn("shrink-0 border-white/10 bg-white/8 text-white", company.status === "ACTIVE" && "border-emerald-300/20 bg-emerald-300/10 text-emerald-100")}>
                    {company.statusLabel}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/40">РџРѕРґРїРёСЃРєРё</p>
                    <p className="mt-1 font-semibold">{company.activeSubscriptions}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/40">Р‘СѓРґСѓС‰РµРµ</p>
                    <p className="mt-1 font-semibold">{money(company.futureGross)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-white/40">Р’Р°Рј</p>
                    <p className="mt-1 font-semibold">{money(company.referralCommission)}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}

