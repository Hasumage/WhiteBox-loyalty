"use client";

import { Headphones, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function AdminSupportDeskPage() {
  const { t } = useI18n("ru");

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-muted-foreground">
          <Headphones className="h-4 w-4" /> {t("admin.support.badge")}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("admin.support.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {t("admin.support.description")}
        </p>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" /> {t("admin.support.guardRails")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {(["admin.support.noPassport", "admin.support.noFinance", "admin.support.noDatabase"] as const).map((key) => (
            <div key={key} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold">
              {t(key)}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
