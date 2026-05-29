"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, Camera, Coins, Hash, History, MinusCircle, QrCode, ReceiptText, Search, Square, TicketCheck, UserRound } from "lucide-react";
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
  const [spendPoints, setSpendPoints] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
      const result = await companyClient(uuid);
      setSelected(result);
      setQuery(uuid);
      setItems([]);
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
      setItems(results.slice(0, 6));
      if (results.length > 1) {
        setFeedback(`Найдено ${results.length} клиентов. Показываем первые 6, при необходимости уточните поиск.`);
      }
      if (results.length === 1) {
        await openClient(results[0].uuid);
        return;
      }
      if (!results.length) setFeedback("Клиенты по запросу не найдены.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Поиск недоступен.");
    } finally {
      setLoading(false);
    }
  }

  async function findByQuickCode() {
    if (quickCode.length !== 5) return;
    try {
      setLoading(true);
      const result = await lookupCompanyClientCode(quickCode);
      setSelected(result);
      setItems([]);
      setFeedback(`Клиент найден по коду: ${result.name}. Теперь можно провести операцию.`);
      setQuickCode("");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось использовать код клиента.");
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
      setItems([]);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось начислить баллы.");
    }
  }

  async function spend() {
    if (!selected || !Number(spendPoints)) return;
    try {
      const result = await spendCompanyPoints({
        userUuid: selected.uuid,
        points: Number(spendPoints),
        description: "Оплата покупки баллами на кассе",
      });
      setFeedback(`Списано ${result.pointsSpent} баллов. Новый баланс: ${result.balance}.`);
      setSpendPoints("");
      setSelected(await companyClient(selected.uuid));
      setItems([]);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось списать баллы.");
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
      setSelected(await companyClient(selected.uuid));
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось погасить услугу.");
    }
  }

  async function redeemBundle(participantUuid: string) {
    if (!selected) return;
    try {
      const result = await redeemCompanyBundleBenefit({ userUuid: selected.uuid, participantUuid });
      setFeedback(
        result.unlimited
          ? `Погашено преимущество “${result.benefit}” по парной подписке “${result.bundle}”. Услуга без лимита использований.`
          : `Погашено преимущество “${result.benefit}” по парной подписке “${result.bundle}”: ${result.used} из ${result.allowance}.`,
      );
      setSelected(await companyClient(selected.uuid));
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "Не удалось погасить преимущество парной подписки.");
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
        <CardContent className="space-y-5 p-5">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Hash className="h-5 w-5 text-cyan-100" />
              <div>
                <h2 className="font-semibold">Быстрый поиск по коду</h2>
                <p className="text-xs text-muted-foreground">Клиент открывает код на экране QR и называет вам 5 цифр. Код одноразовый.</p>
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
              <Card className="border-amber-300/20 bg-amber-300/[0.035] py-0">
                <CardContent className="space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-semibold"><MinusCircle className="h-4 w-4 text-amber-100" /> Списать баллы</h3>
                  <p className="text-xs text-muted-foreground">Баланс проверяется сервером: списать больше доступного нельзя.</p>
                  <Input type="number" min={1} max={selected.balance} value={spendPoints} onChange={(event) => setSpendPoints(event.target.value)} placeholder={`Доступно: ${selected.balance}`} className="h-11 rounded-xl" />
                  <Button variant="secondary" onClick={() => void spend()} disabled={!spendPoints || Number(spendPoints) > selected.balance} className="w-full rounded-xl">Списать</Button>
                </CardContent>
              </Card>
            </div>

            <Card className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-cyan-100" /> История операций клиента</h3>
                <div className="space-y-2">
                  {selected.recentPointOperations.map((operation) => (
                    <div key={operation.uuid} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`rounded-lg p-2 ${operation.type === "EARN" ? "bg-emerald-300/10 text-emerald-200" : "bg-amber-300/10 text-amber-200"}`}>
                          {operation.type === "EARN" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{operation.type === "EARN" ? "Начисление баллов" : "Списание баллов"}</p>
                          <p className="truncate text-xs text-muted-foreground">{operation.description || new Date(operation.occurredAt).toLocaleString("ru-RU")}</p>
                        </div>
                      </div>
                      <p className={`shrink-0 text-sm font-semibold ${operation.type === "EARN" ? "text-emerald-200" : "text-amber-200"}`}>
                        {operation.type === "EARN" ? "+" : "-"}{operation.amount}
                      </p>
                    </div>
                  ))}
                  {selected.recentPurchases.map((purchase) => (
                    <div key={purchase.uuid} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Покупка по программе уровней</p>
                        <p className="truncate text-xs text-muted-foreground">{new Date(purchase.createdAt).toLocaleString("ru-RU")} · начислено {purchase.pointsAwarded} баллов</p>
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
                  {(selected.activeBundleSubscriptions ?? []).flatMap((plan) =>
                    plan.bundle.participants.map((benefit) => (
                      <div key={benefit.uuid} className="flex flex-col justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.045] p-4 sm:flex-row sm:items-center">
                        <div>
                          <p className="font-semibold">{benefit.benefitTitle}</p>
                          <p className="text-xs text-muted-foreground">
                            Парная подписка: {plan.bundle.name} · {benefit.windowUnit === "UNLIMITED"
                              ? "без лимита использований"
                              : `${benefit.allowance} шт. / ${benefit.windowValue} ${benefit.windowUnit.toLowerCase()}`}
                          </p>
                        </div>
                        <Button variant="secondary" onClick={() => void redeemBundle(benefit.uuid)} className="rounded-xl">Погасить</Button>
                      </div>
                    )),
                  )}
                  {selected.activeSubscriptions.length === 0 && (selected.activeBundleSubscriptions ?? []).length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">У клиента нет активной подписки этой компании. Сначала клиент оформляет тариф в приложении.</p>
                  )}
                  {selected.activeSubscriptions.length > 0 &&
                    selected.activeSubscriptions.flatMap((plan) => plan.subscription.entitlements).length === 0 &&
                    (selected.activeBundleSubscriptions ?? []).flatMap((plan) => plan.bundle.participants).length === 0 && (
                    <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">В активной подписке ещё не настроены услуги. Добавьте правила погашения в разделе подписок.</p>
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
  );
}
