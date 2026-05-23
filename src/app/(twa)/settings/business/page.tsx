"use client";

import { BarChart3, Megaphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

const businessFeatures = [
  { titleKey: "client.business.feature1Title", textKey: "client.business.feature1Text", icon: Megaphone },
  { titleKey: "client.business.feature2Title", textKey: "client.business.feature2Text", icon: BarChart3 },
  { titleKey: "client.business.feature3Title", textKey: "client.business.feature3Text", icon: Store },
] as const;

export default function BusinessPage() {
  const { t } = useI18n("ru");

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.business.title")}</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {t("client.business.subtitle")}
      </p>
      <div className="space-y-3">
        {businessFeatures.map(({ titleKey, textKey, icon: Icon }) => (
          <section key={titleKey} className="glass rounded-xl border border-white/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">{t(titleKey)}</h2>
            </div>
            <p className="text-muted-foreground text-sm">{t(textKey)}</p>
          </section>
        ))}
      </div>
      <Button className="mt-4 w-full">{t("client.business.talkToSales")}</Button>
    </article>
  );
}
