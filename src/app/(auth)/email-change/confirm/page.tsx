"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

function EmailChangeShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n("ru");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <Card className="glass w-full max-w-xl border-white/10">
        <CardHeader>
          <CardTitle className="text-xl">{t("client.auth.emailChangeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}

function ConfirmEmailChangeContent() {
  const searchParams = useSearchParams();
  const { t } = useI18n("ru");
  const token = searchParams.get("token");
  const message = token ? t("client.auth.emailChangeInactive") : t("client.auth.emailChangeMissingToken");

  return (
    <EmailChangeShell>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild>
        <Link href="/login">{t("client.auth.goLogin")}</Link>
      </Button>
    </EmailChangeShell>
  );
}

function ConfirmEmailFallback() {
  const { t } = useI18n("ru");

  return (
    <EmailChangeShell>
      <p className="text-muted-foreground">{t("client.auth.emailConfirmationInactive")}</p>
    </EmailChangeShell>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <Suspense fallback={<ConfirmEmailFallback />}>
      <ConfirmEmailChangeContent />
    </Suspense>
  );
}
