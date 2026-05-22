"use client";

import { Handshake, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

const benefits = [
  "client.partnership.benefit1",
  "client.partnership.benefit2",
  "client.partnership.benefit3",
] as const;

export default function PartnershipPage() {
  const { t } = useI18n("ru");

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.partnership.title")}</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {t("client.partnership.subtitle")}
      </p>
      <section className="glass rounded-xl border border-white/10 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          <p className="text-sm font-semibold">{t("client.partnership.why")}</p>
        </div>
        <ul className="space-y-2">
          {benefits.map((item) => (
            <li key={item} className="text-muted-foreground flex items-start gap-2 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
        <Button className="mt-4 w-full">{t("client.partnership.request")}</Button>
      </section>
    </article>
  );
}
