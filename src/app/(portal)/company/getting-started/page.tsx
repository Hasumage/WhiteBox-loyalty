"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgeCheck, Circle, Coins, QrCode, Rocket, Settings2, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { companyProfile, companySubscriptions, type CompanyProfile } from "@/lib/api/company-client";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

export default function CompanyGettingStartedPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [subscriptionCount, setSubscriptionCount] = useState(0);

  useEffect(() => {
    if (SUBSCRIPTIONS_ENABLED) {
      void Promise.all([companyProfile(), companySubscriptions()]).then(([current, subscriptions]) => {
        setProfile(current);
        setSubscriptionCount(subscriptions.length);
      });
      return;
    }

    void companyProfile().then(setProfile);
  }, []);

  const steps = useMemo(() => [
    { title: "Оформите профиль", detail: "Название, описание, категории и формат работы.", done: Boolean(profile?.company.description && profile.company.categories.length), href: "/company/settings", icon: Settings2 },
    { title: "Пройдите верификацию", detail: "После проверки станут доступны операции и подписки.", done: Boolean(profile?.company.identityVerificationCompleted), href: "/company/compliance", icon: BadgeCheck },
    { title: "Настройте уровни", detail: "Определите пороги покупок и процент возврата баллов.", done: Boolean(profile?.company.levels.length), href: "/company/loyalty", icon: Coins },
    ...(SUBSCRIPTIONS_ENABLED
      ? [{ title: "Создайте подписку", detail: "Опишите тариф и правила выдачи услуг на кассе.", done: subscriptionCount > 0, href: "/company/subscriptions", icon: WalletCards }]
      : []),
    { title: "Проведите обслуживание", detail: "Попросите код клиента или отсканируйте QR и проведите первую операцию.", done: false, href: "/company/clients", icon: QrCode },
  ], [profile, subscriptionCount]);
  const completeCount = steps.filter((step) => step.done).length;

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-[1.75rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_85%_15%,rgba(103,232,249,0.18),transparent_35%),rgba(255,255,255,0.025)] p-6 sm:p-8">
        <Badge variant="outline" className="mb-4 border-cyan-300/25 bg-cyan-300/10 text-cyan-100"><Rocket /> Первый запуск</Badge>
        <h1 className="text-3xl font-semibold">Запустите компанию в NearLoy</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Этот маршрут проведёт от карточки компании до первого клиента на кассе. Настройте только необходимое, остальное можно улучшать уже в работе.</p>
        <p className="mt-5 text-sm text-cyan-100">Готово {completeCount} из {steps.length} шагов</p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <Card key={step.title} className={`py-0 ${step.done ? "border-cyan-300/20 bg-cyan-300/[0.045]" : "glass border-white/10"}`}>
              <CardContent className="flex h-full gap-4 p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${step.done ? "border-cyan-200/25 bg-cyan-200/10 text-cyan-100" : "border-white/10 text-muted-foreground"}`}><Icon className="h-5 w-5" /></span>
                <div className="flex flex-1 flex-col">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Шаг {index + 1}</p>
                  <h2 className="mt-1 font-semibold">{step.title}</h2>
                  <p className="mt-1 flex-1 text-sm text-muted-foreground">{step.detail}</p>
                  <Button asChild variant={step.done ? "ghost" : "secondary"} size="sm" className="mt-4 w-fit rounded-xl">
                    <Link href={step.href}>{step.done ? <BadgeCheck /> : <Circle />} {step.done ? "Проверить" : "Перейти"} <ArrowRight /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card className="border-cyan-300/15 bg-cyan-300/[0.04] py-0">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3"><Users className="h-5 w-5 text-cyan-100" /><div><p className="font-semibold">Добавьте кассиров после настройки</p><p className="text-sm text-muted-foreground">Руководитель управляет командой, кассир получает только рабочую кассу.</p></div></div>
          <Button asChild variant="outline" className="rounded-xl"><Link href="/company/team">Команда <ArrowRight /></Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
