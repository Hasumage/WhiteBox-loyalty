"use client";

import { Star } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "@/lib/i18n/use-i18n";

const reviewItemKeys = [
  {
    id: "r1",
    companyKey: "client.reviews.sample1Company",
    rating: 5,
    textKey: "client.reviews.sample1Text",
    dateKey: "client.reviews.sample1Date",
  },
  {
    id: "r2",
    companyKey: "client.reviews.sample2Company",
    rating: 4,
    textKey: "client.reviews.sample2Text",
    dateKey: "client.reviews.sample2Date",
  },
  {
    id: "r3",
    companyKey: "client.reviews.sample3Company",
    rating: 5,
    textKey: "client.reviews.sample3Text",
    dateKey: "client.reviews.sample3Date",
  },
] as const;

export default function ReviewsPage() {
  const { t } = useI18n("ru");
  const reviewItems = useMemo(
    () => reviewItemKeys.map((item) => ({ ...item, company: t(item.companyKey), text: t(item.textKey), date: t(item.dateKey) })),
    [t],
  );

  return (
    <article className="mx-auto max-w-lg">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.reviews.title")}</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {t("client.reviews.subtitle")}
      </p>
      <ul className="space-y-3">
        {reviewItems.map((item) => (
          <li key={item.id} className="glass rounded-xl border border-white/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{item.company}</p>
              <p className="text-muted-foreground text-xs">{item.date}</p>
            </div>
            <div className="mb-2 flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Star
                  key={`${item.id}-${idx}`}
                  className={idx < item.rating ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4 text-muted-foreground"}
                />
              ))}
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
          </li>
        ))}
      </ul>
    </article>
  );
}
