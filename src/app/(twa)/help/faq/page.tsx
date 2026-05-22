"use client";

import { useI18n } from "@/lib/i18n/use-i18n";

const items = [
  { q: "client.faq.q1", a: "client.faq.a1" },
  { q: "client.faq.q2", a: "client.faq.a2" },
  { q: "client.faq.q3", a: "client.faq.a3" },
  { q: "client.faq.q4", a: "client.faq.a4" },
] as const;

export default function FaqPage() {
  const { t } = useI18n("ru");

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.faq.title")}</h1>
      <p className="mb-8 text-sm text-muted-foreground">{t("client.faq.subtitle")}</p>
      <ul className="space-y-6">
        {items.map(({ q, a }) => (
          <li key={q} className="glass rounded-xl border border-white/10 p-4">
            <h2 className="mb-2 text-sm font-semibold">{t(q)}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t(a)}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
