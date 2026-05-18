"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Clock3, FilePlus2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreateFinanceOperation,
  adminListFinanceOperations,
  adminUpdateFinanceOperation,
  type AdminFinanceOperation,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

function money(value: string, currency: string, locale: string) {
  return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function AdminFinancePage() {
  const { locale, t } = useI18n("ru");
  const [items, setItems] = useState<AdminFinanceOperation[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const pendingTotal = useMemo(
    () => items.filter((item) => item.status === "PENDING_APPROVAL").reduce((sum, item) => sum + Number(item.amount), 0),
    [items],
  );

  async function load() {
    setLoading(true);
    const result = await adminListFinanceOperations();
    if (result.ok) setItems(result.data.items);
    else setMessage(result.message);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setSaving(true);
    setMessage("");
    const result = await adminCreateFinanceOperation({ title, amount, details });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setTitle("");
    setAmount("");
    setDetails("");
    setMessage(t("admin.finance.createdNotice"));
    await load();
  }

  async function setStatus(uuid: string, status: AdminFinanceOperation["status"]) {
    setMessage("");
    const result = await adminUpdateFinanceOperation(uuid, status);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-muted-foreground">
          <Banknote className="h-4 w-4" /> {t("admin.finance.badge")}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("admin.finance.title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("admin.finance.description")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-muted-foreground">{t("admin.finance.pendingApproval")}</p>
          <p className="mt-2 text-3xl font-semibold">{items.filter((item) => item.status === "PENDING_APPROVAL").length}</p>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-muted-foreground">{t("admin.finance.pendingAmount")}</p>
          <p className="mt-2 text-3xl font-semibold">{money(String(pendingTotal), "RUB", locale)}</p>
        </Card>
        <Card className="border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-muted-foreground">{t("admin.finance.operations")}</p>
          <p className="mt-2 text-3xl font-semibold">{items.length}</p>
        </Card>
      </div>

      <Card className="border-white/10 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FilePlus2 className="h-5 w-5" /> {t("admin.finance.createTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.4fr_180px_auto]">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("admin.finance.reasonPlaceholder")} />
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder={t("admin.finance.amountPlaceholder")} />
          <Button disabled={saving || !title.trim() || !amount.trim()} onClick={create}>
            {t("admin.finance.createRequest")}
          </Button>
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder={t("admin.finance.detailsPlaceholder")}
            className="min-h-28 lg:col-span-3"
          />
        </CardContent>
      </Card>

      {message && <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm">{message}</div>}

      <Card className="border-white/10 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock3 className="h-5 w-5" /> {t("admin.finance.queueTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-muted-foreground">{t("admin.finance.loading")}</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">{t("admin.finance.empty")}</p>
          ) : (
            items.map((item) => (
              <div key={item.uuid} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:grid-cols-[1fr_180px_180px_auto] lg:items-center">
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.requestedBy?.email ?? t("admin.finance.system")} · {new Date(item.createdAt).toLocaleString(locale)}
                  </p>
                  {item.details && <p className="mt-2 text-sm text-muted-foreground">{item.details}</p>}
                </div>
                <p className="font-semibold">{money(item.amount, item.currency, locale)}</p>
                <Badge variant="outline">{item.status}</Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  {item.approvedBy?.email ?? t("admin.finance.approvalRequired")}
                </div>
                <div className="flex flex-wrap gap-2 lg:col-span-4">
                  {item.status === "PENDING_APPROVAL" && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setStatus(item.uuid, "APPROVED")}>{t("admin.finance.approve")}</Button>
                      <Button size="sm" variant="destructive" onClick={() => setStatus(item.uuid, "REJECTED")}>{t("admin.finance.reject")}</Button>
                    </>
                  )}
                  {item.status === "APPROVED" && (
                    <Button size="sm" onClick={() => setStatus(item.uuid, "PAID")}>{t("admin.finance.markPaid")}</Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
