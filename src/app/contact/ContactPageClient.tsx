"use client";

import { Mail, MessageCircle } from "lucide-react";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingPageReveal } from "@/components/landing/MarketingPageReveal";
import { useI18n } from "@/lib/i18n/use-i18n";

const contactItems = [
  {
    icon: Mail,
    titleKey: "marketing.contact.mailTitle",
    textKey: "marketing.contact.mailText",
  },
  {
    icon: MessageCircle,
    titleKey: "marketing.contact.requestTitle",
    textKey: "marketing.contact.requestText",
  },
] as const;

export function ContactPageClient() {
  const { t } = useI18n("ru");

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_14%_10%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_86%_20%,rgba(168,85,247,0.10),transparent_24%),linear-gradient(rgba(255,255,255,0.034)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,82px_82px,82px_82px]" />
      <MarketingHeader active="contact" />
      <MarketingPageReveal>
        <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">{t("marketing.contact.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{t("marketing.contact.title")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/58">{t("marketing.contact.subtitle")}</p>

            <div className="mt-8 grid gap-3">
              {contactItems.map((item) => (
                <div key={item.titleKey} className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-100/10 text-cyan-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{t(item.titleKey)}</span>
                    <span className="mt-1 block text-sm leading-6 text-white/54">{t(item.textKey)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <LandingLeadForm source="user_landing" title={t("marketing.contact.formTitle")} note={t("marketing.contact.formNote")} />
          </div>
        </section>

        <MarketingFooter />
      </MarketingPageReveal>
    </main>
  );
}
