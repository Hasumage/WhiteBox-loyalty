"use client";

import { Mail } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function ContactPage() {
  const { t } = useI18n("ru");

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.contact.title")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t("client.contact.subtitle")}</p>
      <div className="glass space-y-4 rounded-xl border border-white/10 p-5">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">{t("client.contact.email")}</p>
            <p className="text-sm text-muted-foreground">{t("client.contact.emailCopy")}</p>
          </div>
        </div>
        <p className="border-t border-white/10 pt-4 text-sm leading-relaxed text-muted-foreground">
          {t("client.contact.securityCopy")}
        </p>
      </div>
    </article>
  );
}
