"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import QRCode from "qrcode";
import { Clock3, Hash, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { createTwaLookupCode, getTwaQr, type TwaLookupCode, type TwaQr } from "@/lib/api/twa-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function ScanPage() {
  const { t } = useI18n("ru");
  const [qr, setQr] = useState<TwaQr | null>(null);
  const [lookupCode, setLookupCode] = useState<TwaLookupCode | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeError, setCodeError] = useState("");

  useEffect(() => {
    let ignore = false;
    void getTwaQr().then((data) => {
      if (ignore) return;
      setQr(data);
    });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!qr?.payload) return;
    const canvas = document.getElementById("scan-user-qr") as HTMLCanvasElement | null;
    if (!canvas) return;
    void QRCode.toCanvas(canvas, qr.payload, {
      margin: 2,
      width: 220,
      color: {
        dark: "#020617",
        light: "#f8fafc",
      },
    });
  }, [qr?.payload]);

  async function generateLookupCode() {
    setCodeLoading(true);
    setCodeError("");
    const result = await createTwaLookupCode();
    if (result.ok) {
      setLookupCode(result.data);
    } else {
      setCodeError(t("client.scan.codeError"));
    }
    setCodeLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full px-4 pb-6 pt-6"
    >
      <motion.header
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-5 text-center"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20">
          <QrCode className="h-9 w-9 text-primary" />
        </div>
        <h1 className="text-xl font-semibold">{t("client.scan.title")}</h1>
        <p className="mx-auto mt-1 max-w-[300px] text-sm text-muted-foreground">
          {t("client.scan.subtitle")}
        </p>
      </motion.header>

      <Card className="glass mx-auto w-full max-w-sm overflow-hidden border-white/10">
        <CardHeader className="border-b border-white/10 bg-white/[0.03] pb-3">
          <CardTitle className="flex items-center justify-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("client.scan.yourQr")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="mx-auto flex aspect-square max-w-[240px] items-center justify-center rounded-2xl border border-white/10 bg-slate-50 p-3 shadow-lg shadow-black/20">
            {qr?.payload ? (
              <canvas id="scan-user-qr" className="h-full w-full rounded-xl" aria-label={t("client.scan.userQr")} />
            ) : (
              <span className="text-xs text-slate-500">{t("client.scan.generating")}</span>
            )}
          </div>
          {qr?.payload && (
            <p className="mt-4 truncate text-center font-mono text-[10px] text-muted-foreground">
              {qr.payload}
            </p>
          )}
          <Button className="mt-5 w-full" variant="secondary" disabled>
            {t("client.scan.partnerComingSoon")}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass mx-auto mt-4 w-full max-w-sm overflow-hidden border-cyan-300/20 bg-cyan-300/[0.04]">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-2 text-cyan-100">
              <Hash className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">{t("client.scan.quickCodeTitle")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("client.scan.quickCodeDescription")}</p>
            </div>
          </div>
          {lookupCode && (
            <div className="rounded-2xl border border-cyan-200/20 bg-black/25 px-4 py-5 text-center">
              <p className="font-mono text-4xl font-semibold tracking-[0.3em] text-cyan-50">
                {lookupCode.code.split("").join(" ")}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-100/80">
                <Clock3 className="h-3.5 w-3.5" /> {t("client.scan.codeExpires")}
              </p>
            </div>
          )}
          {codeError && <p className="rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{codeError}</p>}
          <Button type="button" className="w-full rounded-xl" onClick={() => void generateLookupCode()} disabled={codeLoading}>
            {lookupCode ? <RefreshCw /> : <Hash />}
            {lookupCode ? t("client.scan.refreshCode") : t("client.scan.generateCode")}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
