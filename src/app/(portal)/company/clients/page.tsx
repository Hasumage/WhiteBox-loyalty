"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUpRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coins,
  Hash,
  History,
  Infinity as InfinityIcon,
  ListFilter,
  MessageSquareText,
  MinusCircle,
  Moon,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  TicketCheck,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requestCapacitorCameraPermission } from "@/lib/capacitor/native-permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  awardCompanyPoints,
  companyClient,
  companyClientRegistry,
  companyClients,
  lookupCompanyClientCode,
  redeemCompanyBundleBenefit,
  redeemCompanyEntitlement,
  spendCompanyPoints,
  updateCompanyClientComment,
  type CompanyClient,
  type CompanyClientDetail,
  type CompanyClientRegistryResponse,
  type CompanyClientRegistryRow,
  type CompanyClientRegistrySegment,
  type CompanyClientRegistrySortBy,
  type EntitlementWindow,
} from "@/lib/api/company-client";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
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
  if (trimmed.startsWith("nearloy:user:")) return trimmed.slice("nearloy:user:".length);
  return trimmed;
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

const registrySegments: Array<{
  value: CompanyClientRegistrySegment;
  label: string;
  getCount: (stats: CompanyClientRegistryResponse["stats"]) => number;
}> = [
  { value: "all", label: "Все", getCount: (stats) => stats.all },
  { value: "active", label: "Активные", getCount: (stats) => stats.active },
  { value: "withBalance", label: "С балансом", getCount: (stats) => stats.withBalance },
  { value: "vip", label: "VIP", getCount: (stats) => stats.vip },
  { value: "sleeping", label: "Спящие", getCount: (stats) => stats.sleeping },
  { value: "withComment", label: "С комментом", getCount: (stats) => stats.withComment },
];

const registrySortOptions: Array<{ value: CompanyClientRegistrySortBy; label: string }> = [
  { value: "lastActivity", label: "Последняя активность" },
  { value: "totalSpend", label: "Сумма покупок" },
  { value: "balance", label: "Баланс" },
  { value: "earned", label: "Начислено" },
  { value: "spent", label: "Списано" },
  { value: "level", label: "Уровень" },
  { value: "updatedAt", label: "Обновление связи" },
  { value: "name", label: "Имя" },
  { value: "email", label: "Email" },
];

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function shortUuid(value: string) {
  return value.slice(0, 8);
}

function registryDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

function segmentBadges(row: CompanyClientRegistryRow) {
  return [
    row.segmentFlags.vip ? "VIP" : null,
    row.segmentFlags.active ? "Активный" : null,
    row.segmentFlags.sleeping ? "Спящий" : null,
    row.segmentFlags.withBalance ? "Баланс" : null,
    row.segmentFlags.withComment ? "Комментарий" : null,
  ].filter(Boolean) as string[];
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
  const [customerCommentDraft, setCustomerCommentDraft] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);
  const [workspaceMode, setWorkspaceMode] = useState<"registry" | "cashier">("registry");
  const [registry, setRegistry] = useState<CompanyClientRegistryResponse | null>(null);
  const [registryQuery, setRegistryQuery] = useState("");
  const [registrySegment, setRegistrySegment] = useState<CompanyClientRegistrySegment>("all");
  const [registrySortBy, setRegistrySortBy] = useState<CompanyClientRegistrySortBy>("lastActivity");
  const [registrySortDir, setRegistrySortDir] = useState<"asc" | "desc">("desc");
  const [registryPage, setRegistryPage] = useState(1);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [registryError, setRegistryError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // #SubNearloyCode: погашение клиентских подписок скрыто до запуска модуля.
  const redeemableItems = useMemo<RedeemableItem[]>(() => {
    if (!SUBSCRIPTIONS_ENABLED || !selected) return [];
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
    setHydrated(true);
  }, []);

  useEffect(() => {
    return () => stopScanner();
  }, []);

  useEffect(() => {
    setCustomerCommentDraft(selected?.customerComment ?? "");
  }, [selected?.uuid, selected?.customerComment]);

  async function loadRegistry(overrides: {
    query?: string;
    segment?: CompanyClientRegistrySegment;
    sortBy?: CompanyClientRegistrySortBy;
    sortDir?: "asc" | "desc";
    page?: number;
  } = {}) {
    const nextQuery = overrides.query ?? registryQuery;
    const nextSegment = overrides.segment ?? registrySegment;
    const nextSortBy = overrides.sortBy ?? registrySortBy;
    const nextSortDir = overrides.sortDir ?? registrySortDir;
    const nextPage = overrides.page ?? registryPage;
    try {
      setRegistryError("");
      setRegistryLoading(true);
      const result = await companyClientRegistry({
        query: nextQuery.trim(),
        segment: nextSegment,
        sortBy: nextSortBy,
        sortDir: nextSortDir,
        page: nextPage,
        limit: 25,
      });
      setRegistry(result);
      setRegistryQuery(nextQuery);
      setRegistrySegment(result.segment);
      setRegistrySortBy(result.sortBy);
      setRegistrySortDir(result.sortDir);
      setRegistryPage(result.page);
    } catch (reason) {
      setRegistryError(reason instanceof Error ? reason.message : "Не удалось загрузить клиентов компании.");
    } finally {
      setRegistryLoading(false);
    }
  }

  useEffect(() => {
    void loadRegistry({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setWorkspaceMode("cashier");
      setFeedback(`Клиент найден: ${result.name}`);
      stopScanner();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Клиент не найден.");
    } finally {
      setLoading(false);
    }
  }

  async function searchClients() {
    const trimmedQuery = query.trim();
    if (trimmedQuery.startsWith("nearloy:user:")) {
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
      setWorkspaceMode("cashier");
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
      const nativeCameraPermission = await requestCapacitorCameraPermission();
      if (nativeCameraPermission === "denied") throw new Error("native-camera-denied");
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("camera-unavailable");

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

  async function saveCustomerComment() {
    if (!selected) return;
    try {
      setError("");
      setCommentSaving(true);
      const result = await updateCompanyClientComment(selected.uuid, customerCommentDraft);
      setSelected(result);
      setFeedback("Комментарий для клиента сохранён.");
      await loadRegistry();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить комментарий.");
    } finally {
      setCommentSaving(false);
    }
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
      await loadRegistry();
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
      await loadRegistry();
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

  const registryStats = registry?.stats ?? {
    all: 0,
    active: 0,
    withBalance: 0,
    vip: 0,
    sleeping: 0,
    withComment: 0,
    totalBalance: 0,
    totalSpend: 0,
    averageSpend: 0,
  };
  const visibleWorkspaceMode = hydrated ? workspaceMode : "registry";
  const maxAudienceStat = Math.max(registryStats.all, registryStats.active, registryStats.withBalance, registryStats.vip, 1);
  const audiencePercent = (value: number) => `${Math.max(6, Math.round((value / maxAudienceStat) * 100))}%`;

  return (
    <div className="space-y-3 pb-28 sm:space-y-5 lg:pb-0">
      <header className="grid gap-4 xl:flex xl:items-end xl:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:text-xs sm:tracking-[0.24em]">Клиентская база</p>
          <h1 className="text-2xl font-semibold sm:text-3xl">Клиенты компании</h1>
          <p className="mt-2 text-sm text-muted-foreground">Все клиенты, сегменты, балансы и быстрый переход в кассовую карточку.</p>
        </div>
        <div className="hidden grid-cols-2 gap-2 sm:grid xl:flex xl:flex-wrap">
          <Button
            variant={visibleWorkspaceMode === "registry" ? "default" : "secondary"}
            onClick={() => {
              stopScanner();
              setWorkspaceMode("registry");
            }}
            className="rounded-xl"
          >
            <UsersRound /> Реестр
          </Button>
          <Button
            variant={visibleWorkspaceMode === "cashier" ? "default" : "secondary"}
            onClick={() => setWorkspaceMode("cashier")}
            className="rounded-xl"
          >
            <ReceiptText /> Касса
          </Button>
          <Button
            size="lg"
            onClick={() => {
              setWorkspaceMode("cashier");
              void startScanner();
            }}
            className="col-span-2 rounded-xl sm:col-span-1"
          >
            <Camera /> Сканировать QR
          </Button>
        </div>
      </header>

      <div className="fixed inset-x-3 bottom-[5.35rem] z-30 grid grid-cols-[1fr_1fr_3.25rem] gap-2 rounded-2xl border border-white/10 bg-background/95 p-2 shadow-[0_-16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:hidden">
        <Button
          variant={visibleWorkspaceMode === "registry" ? "default" : "secondary"}
          onClick={() => {
            stopScanner();
            setWorkspaceMode("registry");
          }}
          className="h-11 rounded-xl px-2 text-xs"
        >
          <UsersRound className="h-4 w-4" /> Реестр
        </Button>
        <Button
          variant={visibleWorkspaceMode === "cashier" ? "default" : "secondary"}
          onClick={() => setWorkspaceMode("cashier")}
          className="h-11 rounded-xl px-2 text-xs"
        >
          <ReceiptText className="h-4 w-4" /> Касса
        </Button>
        <Button
          size="icon"
          onClick={() => {
            setWorkspaceMode("cashier");
            void startScanner();
          }}
          className="h-11 w-full rounded-xl"
          aria-label="Сканировать QR"
        >
          <Camera className="h-4 w-4" />
        </Button>
      </div>

      {visibleWorkspaceMode === "registry" && (
      <Card className="glass overflow-hidden border-cyan-300/15 bg-cyan-300/[0.025] py-0">
        <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-5">
          <div className="grid grid-cols-[6.75rem_1fr] gap-2 rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.04] p-2 sm:grid-cols-[15rem_1fr] sm:gap-3 sm:p-3">
            <div className="grid gap-1.5 sm:grid-cols-2 sm:gap-2">
              <button
                type="button"
                onClick={() => void loadRegistry({ segment: "active", sortBy: "lastActivity", sortDir: "desc", page: 1 })}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] p-2 text-left transition active:scale-[0.98] sm:block sm:min-h-[5.25rem] sm:p-3"
              >
                <Clock3 className="h-4 w-4 shrink-0 text-emerald-100 sm:mb-2" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-none sm:text-xl">{registryStats.active}</p>
                  <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground sm:mt-1 sm:text-[11px] sm:leading-4">живые</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void loadRegistry({ segment: "withBalance", sortBy: "balance", sortDir: "desc", page: 1 })}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.055] p-2 text-left transition active:scale-[0.98] sm:block sm:min-h-[5.25rem] sm:p-3"
              >
                <WalletCards className="h-4 w-4 shrink-0 text-amber-100 sm:mb-2" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold leading-none sm:text-xl">{registryStats.totalBalance.toLocaleString("ru-RU")}</p>
                  <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground sm:mt-1 sm:text-[11px] sm:leading-4">баллы</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void loadRegistry({ segment: "vip", sortBy: "totalSpend", sortDir: "desc", page: 1 })}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-300/[0.055] p-2 text-left transition active:scale-[0.98] sm:block sm:min-h-[5.25rem] sm:p-3"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-violet-100 sm:mb-2" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-none sm:text-xl">{registryStats.vip}</p>
                  <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground sm:mt-1 sm:text-[11px] sm:leading-4">VIP</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void loadRegistry({ segment: "sleeping", sortBy: "lastActivity", sortDir: "asc", page: 1 })}
                className="flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] p-2 text-left transition active:scale-[0.98] sm:block sm:min-h-[5.25rem] sm:p-3"
              >
                <Moon className="h-4 w-4 shrink-0 text-cyan-100 sm:mb-2" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-none sm:text-xl">{registryStats.sleeping}</p>
                  <p className="mt-0.5 truncate text-[10px] leading-3 text-muted-foreground sm:mt-1 sm:text-[11px] sm:leading-4">уснули</p>
                </div>
              </button>
            </div>
            <div className="grid content-between rounded-xl border border-white/10 bg-black/15 p-2.5 text-left sm:p-4">
              <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3 sm:gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-cyan-100 sm:text-[10px] sm:tracking-[0.18em]">Карта базы</p>
                  <div className="mt-1.5 flex items-end gap-1.5 sm:mt-2 sm:gap-2">
                    <p className="text-3xl font-semibold leading-none sm:text-4xl">{registryStats.all}</p>
                    <p className="pb-0.5 text-[10px] text-muted-foreground sm:pb-1 sm:text-xs">клиентов</p>
                  </div>
                </div>
                <span className="rounded-xl border border-cyan-200/25 bg-cyan-200/10 p-2 text-cyan-50 sm:p-2.5">
                  <UsersRound className="h-4 w-4 sm:h-5 sm:w-5" />
                </span>
              </div>
              {registryStats.all === 0 ? (
                <div className="grid gap-2">
                  <p className="text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                    Клиенты появятся после первого QR или быстрого кода на кассе.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWorkspaceMode("cashier");
                        void startScanner();
                      }}
                      className="rounded-lg border border-cyan-200/25 bg-cyan-200/10 px-2 py-2 text-[10px] font-semibold text-cyan-50 transition active:scale-[0.98] sm:text-xs"
                    >
                      QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setWorkspaceMode("cashier")}
                      className="rounded-lg border border-white/10 bg-white/[0.045] px-2 py-2 text-[10px] font-semibold text-foreground transition active:scale-[0.98] sm:text-xs"
                    >
                      Код
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  <button
                    type="button"
                    onClick={() => void loadRegistry({ segment: "active", sortBy: "lastActivity", sortDir: "desc", page: 1 })}
                    className="grid w-full grid-cols-[3.95rem_1fr_1.25rem] items-center gap-1.5 text-left text-[10px] text-muted-foreground sm:grid-cols-[5.5rem_1fr_2rem] sm:gap-2 sm:text-xs"
                  >
                    <span>Активность</span>
                    <div className="h-1.5 rounded-full bg-white/10 sm:h-2">
                      <div className="h-full rounded-full bg-emerald-200" style={{ width: audiencePercent(registryStats.active) }} />
                    </div>
                    <span className="text-right">{registryStats.active}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadRegistry({ segment: "withBalance", sortBy: "balance", sortDir: "desc", page: 1 })}
                    className="grid w-full grid-cols-[3.95rem_1fr_1.25rem] items-center gap-1.5 text-left text-[10px] text-muted-foreground sm:grid-cols-[5.5rem_1fr_2rem] sm:gap-2 sm:text-xs"
                  >
                    <span>Баланс</span>
                    <div className="h-1.5 rounded-full bg-white/10 sm:h-2">
                      <div className="h-full rounded-full bg-amber-200" style={{ width: audiencePercent(registryStats.withBalance) }} />
                    </div>
                    <span className="text-right">{registryStats.withBalance}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadRegistry({ segment: "vip", sortBy: "totalSpend", sortDir: "desc", page: 1 })}
                    className="grid w-full grid-cols-[3.95rem_1fr_1.25rem] items-center gap-1.5 text-left text-[10px] text-muted-foreground sm:grid-cols-[5.5rem_1fr_2rem] sm:gap-2 sm:text-xs"
                  >
                    <span>VIP</span>
                    <div className="h-1.5 rounded-full bg-white/10 sm:h-2">
                      <div className="h-full rounded-full bg-violet-200" style={{ width: audiencePercent(registryStats.vip) }} />
                    </div>
                    <span className="text-right">{registryStats.vip}</span>
                  </button>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => void loadRegistry({ segment: "all", sortBy: "totalSpend", sortDir: "desc", page: 1 })}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] text-muted-foreground"
                    >
                      Топ по чекам
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadRegistry({ segment: "withComment", sortBy: "updatedAt", sortDir: "desc", page: 1 })}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] text-muted-foreground"
                    >
                      С заметками
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form
            className="grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-2 md:grid-cols-2 md:bg-transparent md:p-0 xl:grid-cols-[1fr_220px_150px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void loadRegistry({ page: 1 });
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={registryQuery}
                onChange={(event) => setRegistryQuery(event.target.value)}
                placeholder="Поиск по имени, email или uuid"
                className="h-11 rounded-xl pl-11 sm:h-12"
              />
            </div>
            <label className="relative">
              <ListFilter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={registrySortBy}
                onChange={(event) =>
                  loadRegistry({ sortBy: event.target.value as CompanyClientRegistrySortBy, page: 1 })
                }
                className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-background pl-11 pr-4 text-sm sm:h-12"
              >
                {registrySortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void loadRegistry({ sortDir: registrySortDir === "asc" ? "desc" : "asc", page: 1 })}
              className="h-11 rounded-xl sm:h-12"
            >
              <ArrowUpDown /> {registrySortDir === "asc" ? "По возр." : "По убыв."}
            </Button>
            <Button type="submit" disabled={registryLoading} className="h-11 rounded-xl px-6 sm:h-12">
              {registryLoading ? <RefreshCw className="animate-spin" /> : <Search />} Найти
            </Button>
          </form>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {registrySegments.map((segment) => (
              <button
                key={segment.value}
                type="button"
                onClick={() => void loadRegistry({ segment: segment.value, page: 1 })}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm",
                  registrySegment === segment.value
                    ? "border-cyan-200/60 bg-cyan-200/15 text-cyan-50"
                    : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-cyan-200/30 hover:text-foreground",
                )}
              >
                {segment.label} <span className="ml-1 text-xs opacity-75">{segment.getCount(registryStats)}</span>
              </button>
            ))}
          </div>

          {registryError && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {registryError}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Клиент</th>
                    <th className="px-4 py-3">Сегменты</th>
                    <th className="px-4 py-3">Баланс</th>
                    <th className="px-4 py-3">Покупки</th>
                    <th className="px-4 py-3">Уровень</th>
                    <th className="px-4 py-3">Активность</th>
                    <th className="px-4 py-3 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {(registry?.items ?? []).map((client) => (
                    <tr key={client.uuid} className="border-b border-white/10 last:border-0">
                      <td className="px-4 py-4">
                        <p className="font-semibold">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.email || "email скрыт"} · {shortUuid(client.uuid)}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex max-w-[260px] flex-wrap gap-1.5">
                          {segmentBadges(client).slice(0, 3).map((label) => (
                            <Badge key={label} variant="outline" className="rounded-full text-[11px]">
                              {label}
                            </Badge>
                          ))}
                          {segmentBadges(client).length === 0 && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold">{client.balance.toLocaleString("ru-RU")}</td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{formatMoney(client.totalSpend)}</p>
                        <p className="text-xs text-muted-foreground">{client.purchaseCount} чеков · +{client.totalEarnedPoints} / -{client.totalSpentPoints}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{client.level.name}</p>
                        <p className="text-xs text-muted-foreground">{client.level.cashbackPercent}%</p>
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">{registryDate(client.lastActivityAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <Button variant="secondary" onClick={() => void openClient(client.uuid)} className="rounded-xl">
                          Открыть
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!registryLoading && (registry?.items ?? []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        Клиентов по текущим условиям нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid gap-3 p-2 md:hidden">
              {(registry?.items ?? []).map((client) => (
                <button
                  key={client.uuid}
                  type="button"
                  onClick={() => void openClient(client.uuid)}
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left transition active:scale-[0.99] active:border-cyan-200/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{client.email || shortUuid(client.uuid)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="text-[11px]">{client.balance} баллов</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {segmentBadges(client).slice(0, 3).map((label) => (
                      <Badge key={label} variant="outline" className="rounded-full text-[11px]">{label}</Badge>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-xl bg-black/20 p-2">Покупки<br /><b className="text-foreground">{formatMoney(client.totalSpend)}</b></span>
                    <span className="rounded-xl bg-black/20 p-2">Уровень<br /><b className="text-foreground">{client.level.name}</b></span>
                    <span className="rounded-xl bg-black/20 p-2">Чеков<br /><b className="text-foreground">{client.purchaseCount}</b></span>
                    <span className="rounded-xl bg-black/20 p-2">Активность<br /><b className="text-foreground">{registryDate(client.lastActivityAt)}</b></span>
                  </div>
                </button>
              ))}
              {!registryLoading && (registry?.items ?? []).length === 0 && (
                <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-muted-foreground">
                  Клиентов по текущим условиям нет.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground sm:flex sm:items-center sm:justify-between">
            <div>
              Показано {registry?.items.length ?? 0} из {registry?.total ?? 0} · средний оборот {formatMoney(registryStats.averageSpend)}
            </div>
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                disabled={registryLoading || registryPage <= 1}
                onClick={() => void loadRegistry({ page: registryPage - 1 })}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" /> Назад
              </Button>
              <Badge variant="outline" className="rounded-full">
                {registry?.page ?? 1} / {registry?.totalPages ?? 1}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={registryLoading || registryPage >= (registry?.totalPages ?? 1)}
                onClick={() => void loadRegistry({ page: registryPage + 1 })}
                className="rounded-xl"
              >
                Далее <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {visibleWorkspaceMode === "cashier" && (
      <>
      {scannerOpen && (
        <Card className="overflow-hidden border-cyan-300/20 bg-cyan-300/[0.035] py-0">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[360px_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              <div className="absolute inset-8 rounded-2xl border-2 border-cyan-200/70" />
            </div>
            <div className="flex flex-col justify-center gap-3">
              <div className="flex items-center gap-2 text-base font-semibold sm:text-lg"><QrCode className="text-cyan-100" /> Наведите камеру на QR клиента</div>
              <p className="text-sm text-muted-foreground">{scannerMessage || "Код будет распознан автоматически и откроет карточку обслуживания."}</p>
              <Button variant="outline" onClick={stopScanner} className="w-full sm:w-fit"><Square /> Закрыть сканер</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass border-white/10 py-0">
        <CardContent className="space-y-4 p-4 sm:space-y-5 sm:p-5">
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-3 sm:p-4">
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
              placeholder="Имя, email, uuid или nearloy:user payload"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-left transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.06] sm:p-4"
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
            <CardContent className="grid gap-4 p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-lg font-semibold sm:text-xl">{selected.name}</p>
                <p className="text-sm text-muted-foreground">{selected.email || "Новый клиент, найден по QR"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-cyan-100 text-black"><BadgeCheck /> {selected.level.name} · {selected.level.cashbackPercent}%</Badge>
                <Badge variant="outline">{selected.balance} баллов</Badge>
                <Badge variant="outline">Потрачено {selected.totalSpend.toLocaleString("ru-RU")} ₽</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-300/20 bg-cyan-300/[0.035] py-0">
            <CardContent className="space-y-3 p-4 sm:p-5">
              <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 font-semibold">
                  <MessageSquareText className="h-4 w-4 text-cyan-100" /> Комментарий для клиента
                </h3>
                <Button
                  variant="secondary"
                  onClick={() => void saveCustomerComment()}
                  disabled={commentSaving || customerCommentDraft === (selected.customerComment ?? "")}
                  className="w-full rounded-xl sm:w-auto"
                >
                  {commentSaving ? "Сохраняем..." : "Сохранить"}
                </Button>
              </div>
              <Textarea
                value={customerCommentDraft}
                onChange={(event) => setCustomerCommentDraft(event.target.value.slice(0, 2000))}
                placeholder="Комментарий для клиента"
                className="min-h-24 rounded-2xl bg-black/20"
              />
              <p className="text-right text-xs text-muted-foreground">{customerCommentDraft.length}/2000</p>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="glass border-white/10 py-0">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-semibold"><Coins className="h-4 w-4 text-cyan-100" /> Начислить вручную</h3>
                <p className="text-xs text-muted-foreground">Для компенсации, подарка или ручной корректировки.</p>
                <Input type="number" min={1} value={manualPoints} onChange={(event) => setManualPoints(event.target.value)} placeholder="Количество баллов" className="h-11 rounded-xl" />
                <Button onClick={() => void award("MANUAL")} disabled={!manualPoints} className="w-full rounded-xl">Начислить</Button>
              </CardContent>
            </Card>
            <Card className="border-cyan-300/20 bg-cyan-300/[0.04] py-0">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-semibold"><ReceiptText className="h-4 w-4 text-cyan-100" /> Покупка с бонусами</h3>
                <p className="text-xs text-muted-foreground">WhiteBox рассчитает баллы по уровню клиента.</p>
                <Input type="number" min={0.01} value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} placeholder="Сумма чека, ₽" className="h-11 rounded-xl" />
                <Button onClick={() => void award("PURCHASE")} disabled={!purchaseAmount} className="w-full rounded-xl">Провести покупку</Button>
              </CardContent>
            </Card>
            <Card className="border-amber-300/20 bg-amber-300/[0.035] py-0">
              <CardContent className="space-y-4 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-semibold"><MinusCircle className="h-4 w-4 text-amber-100" /> Списать баллы</h3>
                <p className="text-xs text-muted-foreground">Сервер проверит баланс и не даст списать больше доступного.</p>
                <Input type="number" min={1} max={selected.balance} value={spendPoints} onChange={(event) => setSpendPoints(event.target.value)} placeholder={`Доступно: ${selected.balance}`} className="h-11 rounded-xl" />
                <Button variant="secondary" onClick={() => void spend()} disabled={!spendPoints || Number(spendPoints) > selected.balance} className="w-full rounded-xl">Списать</Button>
              </CardContent>
            </Card>
          </div>

          {SUBSCRIPTIONS_ENABLED && (
          <Card className="glass border-white/10 py-0">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 font-semibold"><TicketCheck className="h-4 w-4 text-cyan-100" /> Списать услугу по подписке</h3>
                <Badge variant="outline" className="rounded-full"><ShieldCheck className="h-3.5 w-3.5" /> лимиты проверяет сервер</Badge>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {redeemableItems.map((item) => {
                  const state = item.redemption;
                  const disabled = state ? !state.canRedeem : false;
                  return (
                    <div key={`${item.source}-${item.uuid}`} className={cn("rounded-2xl border p-3 sm:p-4", disabled ? "border-amber-300/25 bg-amber-300/[0.035]" : "border-white/10 bg-white/[0.025]") }>
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
                      <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="text-xs text-muted-foreground">
                          {state?.lastRedeemedAt ? `Последнее списание: ${formatDate(state.lastRedeemedAt)}` : "Ещё не списывали"}
                        </div>
                        <Button variant="secondary" disabled={disabled} onClick={() => void redeem(item)} className="w-full rounded-xl sm:w-auto">
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
          )}

          <div className={cn("grid gap-4", SUBSCRIPTIONS_ENABLED && "lg:grid-cols-2")}>
            <Card className="glass border-white/10 py-0">
              <CardContent className="p-4 sm:p-5">
                <h3 className="mb-4 flex items-center gap-2 font-semibold"><History className="h-4 w-4 text-cyan-100" /> Баллы и покупки</h3>
                <div className="space-y-2">
                  {selected.recentPointOperations.map((operation) => (
                    <div key={operation.uuid} className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:flex sm:items-center sm:justify-between">
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

            {SUBSCRIPTIONS_ENABLED && (
            <Card className="glass border-cyan-300/15 bg-cyan-300/[0.025] py-0">
              <CardContent className="p-4 sm:p-5">
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
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[360px] items-center justify-center rounded-3xl border border-dashed border-white/10 text-sm text-muted-foreground">
          Карточка обслуживания появится после выбора клиента.
        </div>
      )}
      </>
      )}
    </div>
  );
}
