"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, CircleDollarSign } from "lucide-react";
import type { ApiCategory } from "@/lib/api/categories-client";
import { getTwaCompanies, getTwaMarketplace, type TwaCompany, type TwaSubscriptionPlan } from "@/lib/api/twa-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { categoryName } from "@/lib/i18n/categories";
import { useI18n } from "@/lib/i18n/use-i18n";
import { formatPlanPrice as formatLocalizedPlanPrice, interpolate } from "@/lib/i18n/format";
import type { TranslateFn } from "@/lib/i18n/format";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function companyHasCategory(company: TwaCompany, slug: string) {
  return [company.category, ...company.categories].filter(Boolean).some((category) => category.slug === slug);
}

function formatPlanPrice(plan: TwaSubscriptionPlan, t: TranslateFn) {
  return formatLocalizedPlanPrice(plan.price, plan.renewalUnit, t);
}

export default function CategoryDetailPage() {
  const { t } = useI18n("ru");
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [plans, setPlans] = useState<TwaSubscriptionPlan[]>([]);

  useEffect(() => {
    let ignore = false;
    void Promise.all([getTwaCompanies(), getTwaMarketplace()]).then(([apiCompanies, marketplace]) => {
      if (ignore) return;
      setCompanies(apiCompanies);
      setPlans(marketplace.subscriptions);
    });
    return () => {
      ignore = true;
    };
  }, []);

  const category = useMemo<ApiCategory | null>(() => {
    const fromCompany = companies
      .flatMap((company) => [company.category, ...company.categories])
      .find((item) => item.slug === slug);
    const fromPlan = plans.map((plan) => plan.category).find((item): item is ApiCategory => Boolean(item && item.slug === slug));
    return fromCompany ?? fromPlan ?? null;
  }, [companies, plans, slug]);

  const categoryCompanies = useMemo(
    () => companies.filter((company) => companyHasCategory(company, slug)),
    [companies, slug],
  );

  const categoryPlans = useMemo(
    () => plans.filter((plan) => plan.category?.slug === slug),
    [plans, slug],
  );

  return (
    <div className="min-h-full px-4 pb-4 pt-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <div className="mb-4 flex items-center gap-2">
        <CategoryIcon iconName={category?.icon ?? "Circle"} className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">{category ? categoryName(category, t) : titleFromSlug(slug)}</h1>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("client.category.partnersPlans")}</p>

      <section className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CircleDollarSign className="h-4 w-4" />
          {t("client.category.subscriptions")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryPlans.map((plan, idx) => (
            <Link key={plan.uuid} href={`/marketplace/${plan.uuid}`}>
              <Card className="glass overflow-hidden border-white/10 transition-all hover:border-white/20">
                <div className="h-24 w-full bg-gradient-to-br from-primary/20 via-primary/10 to-muted/30 p-3">
                  <div className="flex h-full items-end">
                    <span className="rounded-full bg-background/70 px-2 py-1 text-xs">{interpolate(t("client.category.top"), { index: idx + 1 })}</span>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-semibold">{plan.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{plan.description}</p>
                  <p className="mt-2 text-sm font-medium text-primary">{formatPlanPrice(plan, t)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {categoryPlans.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t("client.category.noSubscriptions")}</p>}
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Building2 className="h-4 w-4" />
          {t("client.category.partners")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categoryCompanies.map((company) => (
            <Link key={company.id} href={`/wallet/${company.id}`}>
              <Card className="glass border-white/10 transition-all hover:border-white/20">
                <CardContent className="p-3">
                  <p className="text-sm font-semibold">{company.name}</p>
                  {company.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{company.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      {company.points.balance} {t("client.common.pointsShort")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{company.level.current?.levelName ?? t("client.common.member")}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        {categoryCompanies.length === 0 && <p className="py-4 text-sm text-muted-foreground">{t("client.category.noPartners")}</p>}
      </section>
    </div>
  );
}

