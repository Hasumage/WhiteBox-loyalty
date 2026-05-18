"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function AdminPaymentsPage() {
  const { t } = useI18n("ru");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("admin.payments.title")}</h1>
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.payments.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {t("admin.payments.placeholder")}
        </CardContent>
      </Card>
    </div>
  );
}

