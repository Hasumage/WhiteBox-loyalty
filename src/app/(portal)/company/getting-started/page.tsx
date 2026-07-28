"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Check,
  Gift,
  Loader2,
  MapPinned,
  Power,
  Rocket,
  Settings2,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  companyBilling,
  companyLocations,
  companyMedia,
  companyProfile,
  updateCompanyProfile,
  type CompanyBillingData,
  type CompanyLocation,
  type CompanyMediaState,
  type CompanyProfile,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

function hasSubscriptionAccess(billing: CompanyBillingData | null) {
  if (!billing) return false;
  const now = Date.now();
  const trialActive = billing.account.status === "TRIAL" && (!billing.account.trialEndsAt || new Date(billing.account.trialEndsAt).getTime() > now);
  return (
    billing.access?.status === "ACTIVE" ||
    billing.access?.status === "TRIAL" ||
    billing.access?.status === "GRACE" ||
    billing.account.status === "ACTIVE" ||
    trialActive ||
    billing.invoice?.status === "PAID" ||
    billing.invoice?.status === "WAIVED"
  );
}

function subscriptionEndDate(billing: CompanyBillingData | null) {
  return billing?.account.trialEndsAt ?? billing?.invoice?.periodEndsAt ?? billing?.account.currentPeriodEndsAt ?? null;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

type LaunchStep = {
  title: string;
  description: string;
  href: string;
  required?: boolean;
  done: boolean;
  icon: typeof Settings2;
  action: string;
  hint?: string;
};

export default function CompanyGettingStartedPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [media, setMedia] = useState<CompanyMediaState | null>(null);
  const [billing, setBilling] = useState<CompanyBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationPulse, setActivationPulse] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [currentProfile, currentLocations, currentMedia, currentBilling] = await Promise.all([
        companyProfile(),
        companyLocations().catch(() => []),
        companyMedia().catch(() => null),
        companyBilling().catch(() => null),
      ]);
      setProfile(currentProfile);
      setLocations(currentLocations);
      setMedia(currentMedia);
      setBilling(currentBilling);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить первичный запуск компании.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profileReady = Boolean(profile?.company.name.trim() && profile.company.description?.trim() && profile.company.categories.length);
  const locationReady = Boolean(profile?.company.operatesOnline || locations.some((location) => location.isActive));
  const mediaReady = Boolean(media?.media.logo || media?.media.hero || media?.media.gallery.length);
  const billingReady = hasSubscriptionAccess(billing);
  const offersReady = Boolean(media?.offers.some((offer) => offer.isActive));
  const companyActive = Boolean(profile?.company.isActive);
  const subscriptionUntil = formatDate(subscriptionEndDate(billing));

  const steps = useMemo<LaunchStep[]>(
    () => [
      {
        title: "Карточка компании",
        description: "Название, описание, slug, категории и формат работы.",
        href: "/company/settings",
        required: true,
        done: profileReady,
        icon: Settings2,
        action: profileReady ? "Проверить" : "Заполнить",
      },
      {
        title: "Адреса или онлайн",
        description: "Добавьте точки на карте или отметьте, что компания работает онлайн.",
        href: "/company/settings/locations",
        required: true,
        done: locationReady,
        icon: MapPinned,
        action: locationReady ? "Проверить" : "Настроить",
      },
      {
        title: "Фото и витрина",
        description: "Логотип, шапка и галерея. Можно пропустить и вернуться позже.",
        href: "/company/settings/media",
        done: mediaReady,
        icon: Camera,
        action: mediaReady ? "Открыть" : "Добавить",
        hint: "Необязательно",
      },
      {
        title: "Подписка NearLoy",
        description: billingReady ? `Доступ активен до ${subscriptionUntil}.` : "Оплатите доступ или примените тестовый период.",
        href: "/company/billing",
        required: true,
        done: billingReady,
        icon: WalletCards,
        action: billingReady ? "Открыть" : "Оплатить",
        hint: billingReady ? "Активна" : undefined,
      },
      {
        title: "Акции",
        description: "Промокоды и предложения для клиентов. Можно добавить позже.",
        href: "/company/settings/media",
        done: offersReady,
        icon: Gift,
        action: offersReady ? "Открыть" : "Создать",
        hint: "По желанию",
      },
    ],
    [billingReady, locationReady, mediaReady, offersReady, profileReady, subscriptionUntil],
  );

  const requiredReady = profileReady && locationReady;

  async function activateCompany() {
    if (!profile || activating || companyActive) return;
    if (!billingReady) {
      setError("Сначала оплатите подписку NearLoy или примените тестовый период.");
      return;
    }
    try {
      setActivating(true);
      setError("");
      const updated = await updateCompanyProfile({
        name: profile.company.name,
        slug: profile.company.slug,
        description: profile.company.description ?? "",
        operatesOnline: profile.company.operatesOnline,
        categoryIds: profile.company.categories.map((category) => category.id),
        isActive: true,
      });
      setProfile(updated);
      setActivationPulse(true);
      window.setTimeout(() => setActivationPulse(false), 2600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось активировать компанию.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_14%_12%,rgba(103,232,249,0.2),transparent_36%),rgba(255,255,255,0.025)] p-6 sm:p-8">
        <Badge variant="outline" className="mb-4 border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
          <Rocket className="h-3.5 w-3.5" /> Первый вход
        </Badge>
        <h1 className="text-3xl font-semibold">Запустите компанию в NearLoy</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Заполните обязательный минимум: карточку компании и формат работы. Фото, акции и публикацию можно настроить сразу или вернуться позже.
        </p>
      </header>

      {error && <div className="rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      {loading ? (
        <Card className="glass border-white/10 py-0">
          <CardContent className="flex min-h-56 items-center justify-center p-6 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Загружаем шаги запуска...
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Card
                  key={step.title}
                  className={cn(
                    "py-0 transition hover:-translate-y-0.5",
                    step.done ? "border-emerald-300/20 bg-emerald-300/[0.055]" : "glass border-white/10",
                  )}
                >
                  <CardContent className="flex h-full gap-4 p-5">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                        step.done ? "border-emerald-200/25 bg-emerald-200/10 text-emerald-100" : "border-cyan-200/18 bg-cyan-200/8 text-cyan-100",
                      )}
                    >
                      {step.done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold">{step.title}</h2>
                        {step.required && <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-100">обязательно</span>}
                        {step.hint && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[0.65rem] font-semibold text-white/60">{step.hint}</span>}
                      </div>
                      <p className="mt-1 flex-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                      <Button asChild variant={step.done ? "ghost" : "secondary"} size="sm" className="mt-4 w-fit rounded-xl">
                        <Link href={step.href}>
                          {step.action}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden border-cyan-300/20 bg-[radial-gradient(circle_at_18%_20%,rgba(45,212,191,0.18),transparent_38%),rgba(255,255,255,0.025)] py-0">
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                  <Power className="h-5 w-5" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold">Активировать компанию</h2>
                    {companyActive && <Badge className="bg-emerald-200 text-emerald-950">Опубликована</Badge>}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Когда компания активна, она может появляться в выдаче, на карте и в публичной карточке. Нужна заполненная база и активная подписка.
                  </p>
                  {!billingReady && <p className="mt-2 text-sm text-amber-100">Перед активацией оплатите подписку или примените тестовый период.</p>}
                  {billingReady && <p className="mt-2 text-sm text-emerald-100">Подписка активна до {subscriptionUntil}.</p>}
                </div>
              </div>
              <Button
                type="button"
                onClick={() => void activateCompany()}
                disabled={activating || companyActive || !billingReady || !requiredReady}
                className={cn("shrink-0 rounded-2xl px-6", companyActive && "bg-emerald-300 text-emerald-950 hover:bg-emerald-300")}
              >
                {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : companyActive ? <BadgeCheck className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {companyActive ? "Компания активна" : "Активировать"}
              </Button>
            </CardContent>
          </Card>

          {activationPulse && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-md">
              <div className="max-w-md rounded-[2rem] border border-emerald-200/25 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.24),transparent_42%),#07110f] p-8 text-center shadow-[0_0_80px_rgba(52,211,153,0.22)]">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-200/30 bg-emerald-200/12 text-emerald-100">
                  <Sparkles className="h-8 w-8 animate-pulse" />
                </div>
                <h3 className="text-2xl font-semibold">Компания успешно активирована</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Спасибо! Теперь клиенты смогут находить вашу компанию в NearLoy и открывать публичную карточку.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
