"use client";

import { useI18n } from "@/lib/i18n/use-i18n";

const sections = [
  { title: "client.privacy.collectTitle", text: "client.privacy.collectText" },
  { title: "client.privacy.useTitle", text: "client.privacy.useText" },
  { title: "client.privacy.sharingTitle", text: "client.privacy.sharingText" },
  { title: "client.privacy.choicesTitle", text: "client.privacy.choicesText" },
] as const;

export default function PrivacyPage() {
  const { t } = useI18n("ru");

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.privacy.title")}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t("client.privacy.updated")}</p>
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        {sections.map((section) => (
          <section key={section.title} className="glass rounded-xl border border-white/10 p-4">
            <h2 className="mb-2 font-semibold text-foreground">{t(section.title)}</h2>
            <p>{t(section.text)}</p>
          </section>
        ))}
      </div>
    </article>
  );
}
