"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, Coins, QrCode, ReceiptText, Search, Square, TicketCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  awardCompanyPoints,
  companyClient,
  companyClients,
  redeemCompanyEntitlement,
  type CompanyClient,
  type CompanyClientDetail,
} from "@/lib/api/company-client";

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

function extractUserUuid(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("whitebox:user:") ? trimmed.slice("whitebox:user:".length) : trimmed;
}

export default function CompanyClientsPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMessage, setScannerMessage] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CompanyClient[]>([]);
  const [selected, setSelected] = useState<CompanyClientDetail | null>(null);
  const [manualPoints, setManualPoints] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

  function stopScanner() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerOpen(false);
  }

  useEffect(() => () => stopScanner(), []);

  async function openClient(value: string) {
    const uuid = extractUserUuid(value);
    if (!uuid) return;
    try {
      setLoading(true);
      const result = await companyClient(uuid);
      setSelected(result);
      setQuery(uuid);
      setItems([result]);
      setFeedback(`Клиент найден: ${result.name}`);
      stopScanner();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Клиент не найден.");
    } finally {
      setLoading(false);
    }
  }

  async function searchClients() {
    if (query.trim().startsWith("whitebox:user:")) {
      await openClient(query);
      return;
    }
    try {
      setLoading(true);
      const results = await companyClients(extractUserUuid(query));
      setItems(results);
      if (results.length === 1) await openClient(results[0].uuid);
      if (!results.length) setFeedback("Клиенты по запросу не найдены.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Поиск недоступен.");
    } finally {
      setLoading(false);
    }
  }

  async function startScanner() {
    setFeedback("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScannerOpen(true);
      requestAnimationFrame(async () => {
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const Detector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
        if (!Detector) {
          setScannerMessage("Камера включена. В этом браузере распознавание QR недоступно, вставьте код ниже.");
          return;
        }
        const detector = new Detector({ formats: ["qr_code"] });
        intervalRef.current = window.setInterval(async () => {
          if (!videoRef.current) return;
          const codes = await detector.detect(videoRef.current).catch(() => []);
          if (codes[0]?.rawValue) void openClient(codes[0].rawValue);
        }, 450);
      });
    } catch {
      setScannerMessage("Не удалось открыть камеру. Вставьте QR payload или uuid клиента в поиск.");
      setScannerOpen(true);
    }
  }

  async function award(mode: "MANUAL" | "PURCHASE") {
    if (!selected) return;
    try {
      const result = await awardCompanyPoints({
        userUuid: selected.uuid,
        mode,
        ...(mode === "MANUAL" ? { points: Number(manualPoints) } : { purchaseAmount: Number(purchaseAmount) }),
      });
      setFeedback(
        mode === "MANUAL"
          ? `Начислено ${result.pointsAwarded} баллов.`
          : `Покупка учтена: начислено ${result.pointsAwarded} баллов${result.level ? `, уровень ${result.level.name}` : ""}.`,
      );
      setManualPoints("");
      setPurchaseAmount("");
      setSelected(await companyClient(selected.uuid));
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось начислить баллы.");
    }
  }

  async function redeem(entitlementUuid: string) {
    if (!selected) return;
    try {
      const result = await redeemCompanyEntitlement({ userUuid: selected.uuid, entitlementUuid });
      setFeedback(
        result.unlimited
          ? `Зафиксировано посещение: ${result.benefit}. Услуга доступна без лимита использований.`
          : `Погашено: ${result.benefit}. Использовано ${result.used} из ${result.allowance}.`,
      );
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось погасить услугу.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Рабочее место кассира</p>
          <h1 className="text-3xl font-semibold">Касса и клиенты</h1>
          <p className="mt-2 text-sm text-muted-foreground">Сканируйте QR, начисляйте баллы или выдавайте услугу по подписке.</p>
        </div>
        <Button size="lg" onClick={startScanner} className="rounded-xl">
          <Camera /> Сканировать QR
        </Button>
      </header>

      {scannerOpen && (
        <Card className="overflow-hidden border-cyan-300/20 bg-cyan-300/[0.035] py-0">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[360px_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="absolute inset-8 rounded-2xl border-2 border-cyan-200/70" />
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2 text-lg font-semibold"><QrCode className="text-cyan-100" /> Наведите камеру на QR клиента</div>
              <p className="text-sm text-muted-foreground">{scannerMessage || "Код будет распознан автоматически и откроет карточку обслуживания."}</p>
              <Button variant="outline" onClick={stopScanner} className="w-fit"><Square /> Закрыть сканер</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass border-white/10 py-0">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void searchClients()}
              placeholder="Ваш клиент: имя или email; нового найдите по QR"
              className="h-12 rounded-xl"
            />
            <Button onClick={searchClients} disabled={loading} className="h-12 rounded-xl px-7">
              <Search /> Найти клиента
            </Button>
          </div>
          {feedback && <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-50">{feedback}</div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="glass border-white/10 py-0">
          <CardContent className="space-y-2 p-4">
            <h2 className="mb-3 flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4 text-cyan-100" /> Результаты</h2>
            {items.map((item) => (
              <button
                key={item.uuid}
                type="button"
                onClick={() => void openClient(item.uuid)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selected?.uuid === item.uuid ? "border-cyan-200/35 bg-cyan-200/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}
              >
                <p className="font-semibold">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <Badge variant="outline">{item.level.name} · {item.level.cashbackPercent}%</Badge>
                  <span>{item.balance} баллов</span>
                </div>
              </button>
            ))}
            {items.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">Поиск показывает только клиентов вашей компании. Для нового клиента отсканируйте его QR.</p>}
          </CardContent>
        </Card>

        {selected ? (
          <div className="space-y-4">
            <Card className="glass border-white/10 py-0">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="text-xl font-semibold">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">{selected.email || "Новый клиент, найден по QR"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-cyan-100 text-black"><BadgeCheck /> {selected.level.name} · {selected.level.cashbackPercent}%</Badge>
                  <Badge variant="outline">{selected.balance} баллов</Badge>
                  <Badge variant="outline">Потрачено {selected.totalSpend.toLocaleString("ru-RU")} ₽</Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass border-white/10 py-0">
                <CardContent className="space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-semibold"><Coins className="h-4 w-4 text-cyan-100" /> Просто начислить баллы</h3>
                  <p className="text-xs text-muted-foreground">Для компенсации или разового подарка.</p>
                  <Input type="number" min={1} value={manualPoints} onChange={(event) => setManualPoints(event.target.value)} placeholder="Количество баллов" className="h-11 rounded-xl" />
                  <Button onClick={() => void award("MANUAL")} disabled={!manualPoints} className="w-full rounded-xl">Начислить</Button>
                </CardContent>
              </Card>
              <Card className="border-cyan-300/20 bg-cyan-300/[0.04] py-0">
                <CardContent className="space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4 text-cyan-100" /> Покупка с кэшбэком</h3>
                  <p className="text-xs text-muted-foreground">WhiteBox рассчитает баллы по уровню клиента.</p>
                  <Input type="number" min={0.01} value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} placeholder="Сумма чека, ₽" className="h-11 rounded-xl" />
                  <Button onClick={() => void award("PURCHASE")} disabled={!purchaseAmount} className="w-full rounded-xl">Провести покупку</Button>
                </CardContent>
              </Card>
            </div>

            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold"><TicketCheck className="h-4 w-4 text-cyan-100" /> Погашение услуг подписки</h3>
                <div className="space-y-2">
                  {selected.activeSubscriptions.flatMap((plan) =>
                    plan.subscription.entitlements.map((benefit) => (
                      <div key={benefit.uuid} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold">{benefit.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {plan.subscription.name} · {benefit.windowUnit === "UNLIMITED"
                              ? "без лимита использований"
                              : `${benefit.allowance} шт. / ${benefit.windowValue} ${benefit.windowUnit.toLowerCase()}`}
                          </p>
                        </div>
                        <Button variant="secondary" onClick={() => void redeem(benefit.uuid)} className="rounded-xl">Погасить</Button>
                      </div>
                    )),
                  )}
                  {selected.activeSubscriptions.flatMap((plan) => plan.subscription.entitlements).length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">У клиента нет доступных услуг для погашения.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-muted-foreground">
            Карточка обслуживания появится после выбора клиента.
          </div>
        )}
      </div>
    </div>
  );
}
