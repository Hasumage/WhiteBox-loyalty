"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Coins,
  Hash,
  History,
  Infinity as InfinityIcon,
  MinusCircle,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  Square,
  TicketCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  awardCompanyPoints,
  companyClient,
  companyClients,
  lookupCompanyClientCode,
  redeemCompanyBundleBenefit,
  redeemCompanyEntitlement,
  spendCompanyPoints,
  type CompanyClient,
  type CompanyClientDetail,
  type EntitlementWindow,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

type BarcodeDetectorLike = {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
};

type RedeemableItem = {
  uuid: string;
  title: string;
  planName: string;
  description?: string | null;
  windowUnit: EntitlementWindow;
  windowValue: number;
  allowance: number;
  source: "SUBSCRIPTION" | "BUNDLE";
  redemption?: {
    unlimited: boolean;
    used: number | null;
    allowance: number | null;
    remaining: number | null;
    canRedeem: boolean;
    windowStartedAt: string | null;
    windowEndsAt: string | null;
    lastRedeemedAt: string | null;
  };
};

function extractUserUuid(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("whitebox:user:") ? trimmed.slice("whitebox:user:".length) : trimmed;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function windowLabel(unit: EntitlementWindow, value: number) {
  if (unit === "UNLIMITED") return "без лимита";
  if (unit === "TERM") return "за срок подписки";
  const every = value > 1 ? `${value} ` : "";
  if (unit === "DAY") return `${every}день`;
  if (unit === "WEEK") return `${every}неделю`;
  return `${every}месяц`;
}

function limitText(item: RedeemableItem) {
  const state = item.redemption;
  if (state?.unlimited || item.windowUnit === "UNLIMITED") return "Без лимита списаний";
  if (!state) return `${item.allowance} шт. / ${windowLabel(item.windowUnit, item.windowValue)}`;
  return `Осталось ${state.remaining ?? 0} из ${state.allowance ?? item.allowance} / ${windowLabel(item.windowUnit, item.windowValue)}`;
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
  const [spendPoints, setSpendPoints] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const redeemableItems = useMemo<RedeemableItem[]>(() => {
    if (!selected) return [];
    const ordinary = selected.activeSubscriptions.flatMap((plan) =>
      plan.subscription.entitlements.map((benefit) => ({
        uuid: benefit.uuid,
        title: benefit.title,
        planName: plan.subscription.name,
        description: benefit.description,
        windowUnit: benefit.windowUnit,
        windowValue: benefit.windowValue,
        allowance: benefit.allowance,
        source: "SUBSCRIPTION" as const,
        redemption: benefit.redemption,
      })),
    );
    const bundled = (selected.activeBundleSubscriptions ?? []).flatMap((plan) =>
      plan.bundle.participants.map((benefit) => ({
        uuid: benefit.uuid,
        title: benefit.benefitTitle,
        planName: plan.bundle.name,
        description: benefit.benefitDescription,
        windowUnit: benefit.windowUnit,
        windowValue: benefit.windowValue,
        allowance: benefit.allowance,
        source: "BUNDLE" as const,
        redemption: benefit.redemption,
      })),
    );
    return [...ordinary, ...bundled];
  }, [selected]);

  function stopScanner() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerOpen(false);
  }

  useEffect(() => {
    return () => stopScanner();
  }, []);

  async function openClient(value: string) {
    const uuid = extractUserUuid(value);
    if (!uuid) return;
    try {
      setError("");
      setLoading(true);
      const result = await companyClient(uuid);
      setSelected(result);
      setQuery(uuid);
      setItems([]);
      setFeedback(`Клиент найден: ${result.name}`);
      stopScanner();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Клиент не найден.");
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
      setError("");
      setLoading(true);
      const results = await companyClients(extractUserUuid(query));
      setItems(results.slice(0, 6));
      if (results.length > 1) {
        setFeedback(`Найдено ${results.length} клиентов. Показываем первые 6, уточните поиск при необходимости.`);
      }
      if (results.length === 1) {
        await openClient(results[0].uuid);
        return;
      }
      if (!results.length) setFeedback("Клиенты по запросу не найдены.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Поиск временно недоступен.");
    } finally {
      setLoading(false);
    }
  }

  async function findByQuickCode() {
    if (quickCode.length !== 5) return;
    try {
      setError("");
      setLoading(true);
      const result = await lookupCompanyClientCode(quickCode);
      setSelected(result);
      setItems([]);
      setFeedback(`Клиент найден по коду: ${result.name}. Теперь можно провести операцию.`);
      setQuickCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось использовать код клиента.");
    } finally {
      setLoading(false);
    }
  }

  async function startScanner() {
    setFeedback("");
    setError("");
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
          setScannerMessage("Камера включена, но браузер не умеет распознавать QR. Введите код или uuid вручную.");
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
      setScannerMessage("Не удалось открыть камеру. Введите QR payload, uuid или быстрый код клиента вручную.");
      setScannerOpen(true);
    }
  }

  async function refreshSelected() {
    if (!selected) return;
    setSelected(await companyClient(selected.uuid));
  }

  async function award(mode: "MANUAL" | "PURCHASE") {
    if (!selected) return;
    try {
      setError("");
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
      await refreshSelected();
      setItems([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось начислить баллы.");
    }
  }

  async function spend() {
    if (!selected || !Number(spendPoints)) return;
    try {
      setError("");
      const result = await spendCompanyPoints({
        userUuid: selected.uuid,
        points: Number(spendPoints),
        description: "Оплата покупки баллами на кассе",
      });
      setFeedback(`Списано ${result.pointsSpent} баллов. Новый баланс: ${result.balance}.`);
      setSpendPoints("");
      await refreshSelected();
      setItems([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось списать баллы.");
    }
  }

  async function redeem(item: RedeemableItem) {
    if (!selected) return;
    try {
      setError("");
      const result = item.source === "BUNDLE"
        ? await redeemCompanyBundleBenefit({ userUuid: selected.uuid, participantUuid: item.uuid })
        : await redeemCompanyEntitlement({ userUuid: selected.uuid, entitlementUuid: item.uuid });
      setFeedback(
        result.unlimited
          ? `Списано: ${result.benefit}. Услуга доступна без лимита использований.`
          : `Списано: ${result.benefit}. Осталось ${result.remaining} из ${result.allowance} на текущий период.`,
      );
      await refreshSelected();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось списать услугу по подписке.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Рабочее место кассира</p>
          <h1 className="text-3xl font-semibold">Касса и клиенты</h1>
          <p className="mt-2 text-sm text-muted-foreground">Сканируйте QR, начисляйте или списывайте баллы и погашайте услуги по подписке.</p>
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
        <CardContent className="space-y-5 p-5">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Hash className="h-5 w-5 text-cyan-100" />
              <div>
                <h2 className="font-semibold">Быстрый поиск по коду</h2>
                <p className="text-xs text-muted-foreground">Клиент открывает код на экране QR и называет 5 цифр. Код одноразовый.</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                inputMode="numeric"
                maxLength={5}
                value={quickCode}
                onChange={(event) => setQuickCode(event.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(event) => event.key === "Enter" && void findByQuickCode()}
                placeholder="Например, 42107"
                className="h-12 rounded-xl font-mono text-lg tracking-[0.25em]"
              />
              <Button onClick={() => void findByQuickCode()} disabled={loading || quickCode.length !== 5} className="h-12 rounded-xl px-7">
                <Hash /> Открыть клиента
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void searchClients()}
              placeholder="Имя, email, uuid или whitebox:user payload"
              className="h-12 rounded-xl"
            />
            <Button onClick={searchClients} disabled={loading} className="h-12 rounded-xl px-7">
              <Search /> Найти
            </Button>
          </div>
          {feedback && <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-3 text-sm text-cyan-50">{feedback}</div>}
          {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card className="glass border-cyan-300/15 bg-cyan-300/[0.035] py-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-4 w-4 text-cyan-100" /> Найдено несколько клиентов</h2>
              <Badge variant="outline">{items.length} показано</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <button
                  key={item.uuid}
                  type="button"
                  onClick={() => void openClient(item.uuid)}
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.06]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0">{item.balance} баллов</Badge>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{item.level.name} · {item.level.cashbackPercent}%</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="glass border-white/10 py-0">
              <CardContent className="space-y-4 p-5">
                <h3 className="flex items-center gap-2 font-semibold"><Coins className="h-4 w-4 text-cyan-100" /> Начислить вручную</h3>
                <p className="text-xs text-muted-foreground">Для компенсации, подарка или ручной корректировки.</p>
                <Input type="number" min={1} value={manualPoints} onChange={(event) => setManualPoints(event.target.value)} placeholder="Количество баллов" className="h-11 rounded-xl" />
                <Button onClick={() => void award("MANUAL")} disabled={!manualPoints} className="w-full rounded-xl">Начислить</Button>
              </CardContent>
            </Card>
            <Card className="border-cyan-300/20 bg-cyan-300/[0.04] py-0">
              <CardContent className="space-y-4 p-5">
                <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4 text-cyan-100" /> Покупка с бонусами</h3>
                <p className="text-xs text-muted-foreground">WhiteBox рассчитает баллы по уровню клиента.</p>
                <Input type="number" min={0.01} value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} placeholder="Сумма чека, ₽" className="h-11 rounded-xl" />
                <Button onClick={() => void award("PURCHASE")} disabled={!purchaseAmount} className="w-full rounded-xl">Провести покупку</Button>
              </CardContent>
            </Card>
            <Card className="border-amber-300/20 bg-amber-300/[0.035] py-0">
              <CardContent className="space-y-4 p-5">
                <h3 className="flex items-center gap-2 font-semibold"><MinusCircle className="h-4 w-4 text-amber-100" /> Списать баллы</h3>
                <p className="text-xs text-muted-foreground">Сервер проверит баланс и не даст списать больше доступного.</p>
                <Input type="number" min={1} max={selected.balance} value={spendPoints} onChange={(event) => setSpendPoints(event.target.value)} placeholder={`Доступно: ${selected.balance}`} className="h-11 rounded-xl" />
                <Button variant="secondary" onClick={() => void spend()} disabled={!spendPoints || Number(spendPoints) > selected.balance} className="w-full rounded-xl">Списать</Button>
              </CardContent>
            </Card>
          </div>

          <Card className="glass border-white/10 py-0">
            <CardContent className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold"><TicketCheck className="h-4 w-4 text-cyan-100" /> Списать услугу по подписке</h3>
                <Badge variant="outline" className="rounded-full"><ShieldCheck className="h-3.5 w-3.5" /> лимиты проверяет сервер</Badge>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {redeemableItems.map((item) => {
                  const state = item.redemption;
                  const disabled = state ? !state.canRedeem : false;
                  return (
                    <div key={`${item.source}-${item.uuid}`} className={cn("rounded-2xl border p-4", disabled ? "border-amber-300/25 bg-amber-300/[0.035]" : "border-white/10 bg-white/[0.025]") }>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.planName}</p>
                        </div>
                        <Badge variant={state?.unlimited ? "outline" : disabled ? "secondary" : "default"} className="rounded-full">
                          {state?.unlimited ? <InfinityIcon className="h-3.5 w-3.5" /> : disabled ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          {limitText(item)}
                        </Badge>
                      </div>
                      {item.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs text-muted-foreground">
                          {state?.lastRedeemedAt ? `Последнее списание: ${formatDate(state.lastRedeemedAt)}` : "Ещё не списывали"}
                        </div>
                        <Button variant="secondary" disabled={disabled} onClick={() => void redeem(item)} className="rounded-xl">
                          <TicketCheck /> {disabled ? "Лимит исчерпан" : "Списать услугу"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {redeemableItems.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground xl:col-span-2">
                    У клиента нет активных подписок с услугами этой компании.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-cyan-100" /> Баллы и покупки</h3>
                <div className="space-y-2">
                  {selected.recentPointOperations.map((operation) => (
                    <div key={operation.uuid} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("rounded-lg p-2", operation.type === "EARN" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200")}>
                          {operation.type === "EARN" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{operation.type === "EARN" ? "Начисление баллов" : "Списание баллов"}</p>
                          <p className="truncate text-xs text-muted-foreground">{operation.description || formatDate(operation.occurredAt)}</p>
                        </div>
                      </div>
                      <p className={cn("shrink-0 text-sm font-semibold", operation.type === "EARN" ? "text-emerald-200" : "text-amber-200")}>
                        {operation.type === "EARN" ? "+" : "-"}{operation.amount}
                      </p>
                    </div>
                  ))}
                  {selected.recentPurchases.map((purchase) => (
                    <div key={purchase.uuid} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Покупка по программе уровней</p>
                        <p className="truncate text-xs text-muted-foreground">{formatDate(purchase.createdAt)} · начислено {purchase.pointsAwarded} баллов</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold">{purchase.amount.toLocaleString("ru-RU")} ₽</p>
                    </div>
                  ))}
                  {selected.recentPointOperations.length === 0 && selected.recentPurchases.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">Операций с баллами пока нет.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="glass border-cyan-300/15 bg-cyan-300/[0.025] py-0">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold"><TicketCheck className="h-4 w-4 text-cyan-100" /> История погашений</h3>
                <div className="space-y-2">
                  {(selected.recentSubscriptionRedemptions ?? []).map((redemption) => (
                    <div key={redemption.uuid} className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{redemption.benefit}</p>
                          <p className="truncate text-xs text-muted-foreground">{redemption.planName} · {formatDate(redemption.redeemedAt)}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">-{redemption.quantity}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Кассир: {redemption.processedBy}</p>
                    </div>
                  ))}
                  {(selected.recentSubscriptionRedemptions ?? []).length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">Погашений услуг по подписке пока нет.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-muted-foreground">
          Карточка обслуживания появится после выбора клиента.
        </div>
      )}
    </div>
  );
}
