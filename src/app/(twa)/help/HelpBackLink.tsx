"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";

const DEFAULT_SECTION = "section-payments";

export function HelpBackLink() {
  const { t } = useI18n("ru");
  const searchParams = useSearchParams();
  const section = searchParams.get("section") ?? DEFAULT_SECTION;
  const href = `/settings#${encodeURIComponent(section)}`;

  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      scroll={false}
    >
      <ArrowLeft className="h-4 w-4" />
      {t("client.help.backProfile")}
    </Link>
  );
}
