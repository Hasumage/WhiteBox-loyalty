"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bell, Camera, CheckCircle2, Coins, Copy, Flag, Gift, Heart, ImagePlus, Map as MapIcon, MapPin, MoreHorizontal, Send, Share2, Sparkles, Swords, TrendingUp, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { YandexRtbAd } from "@/components/ads/YandexRtbAd";
import { acceptHuntGift, advanceHuntTutorial, createHuntPost, getCachedHuntOverview, getHuntFeed, getHuntOverview, likeHuntPost, markHuntDailyRewardsSeen, reportHuntPost, startHuntTutorialTrainingMatch, uploadHuntMedia, type HuntOverview, type HuntPost, type HuntReportReason, type HuntTutorialStep } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { huntInteractiveClass, mediaSrc, NearloyStars } from "./_components/hunt-ui";

const actionCards = [
  { href: "/hunt/shop", icon: Gift, labelKey: "client.hunt.shop.title", image: "/hunt-assets/shop/weekly-gold-chest.webp", metric: "boxes" },
  { href: "/hunt/all-cards", icon: Sparkles, labelKey: "client.hunt.allCards", image: "/hunt-assets/cards/creature-sheet.png", metric: "catalog" },
  { href: "/hunt/leaderboard", icon: UsersRound, labelKey: "client.hunt.leaderboard", image: "/hunt-assets/ui/nearloy-cup.png", metric: "trophies" },
] satisfies Array<{ href: string; icon: typeof Camera; labelKey: TranslationKey; image: string; metric: "posts" | "boxes" | "cards" | "catalog" | "trophies" }>;

const HUNT_FEED_PAGE_SIZE = 8;
const HUNT_FEED_REFRESH_MS = 15000;
const HUNT_FEED_AD_BLOCK_ID =
  process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_BANNER_BLOCK_ID ||
  process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_SHOP_BANNER_BLOCK_ID;
const MAX_COMPOSER_PHOTOS = 3;

const reportReasons = [
  { value: "SPAM", labelKey: "client.hunt.report.reasonSpam" },
  { value: "OFFENSIVE", labelKey: "client.hunt.report.reasonOffensive" },
  { value: "FALSE_PLACE", labelKey: "client.hunt.report.reasonFalsePlace" },
  { value: "DUPLICATE", labelKey: "client.hunt.report.reasonDuplicate" },
  { value: "PRIVATE_DATA", labelKey: "client.hunt.report.reasonPrivateData" },
  { value: "COPYRIGHT", labelKey: "client.hunt.report.reasonCopyright" },
  { value: "OTHER", labelKey: "client.hunt.report.reasonOther" },
] satisfies Array<{ value: HuntReportReason; labelKey: TranslationKey }>;

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      openTelegramLink?: (url: string) => void;
    };
  };
};

type ShareTarget = { path: string; title: string } | null;
type ComposerPosition = { latitude: number; longitude: number; accuracy?: number } | null;

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function splitList(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

const BATTLE_STORAGE_KEY = "nearloy-hunt-battle-state";

const tutorialCopy: Record<HuntTutorialStep, { pose: string; eyebrow: string; title: string; body: string; cta: string; icon: typeof Sparkles }> = {
  WELCOME: {
    pose: "/hunt-assets/tutorial/lira-welcome.png",
    eyebrow: "Лира Нокс",
    title: "Я ждала именно тебя",
    body: "Смотри: в Hunt мы исследуем места, собираем истории города и превращаем их в силу для команды. Пойдём, покажу всё на практике.",
    cta: "Пойдём",
    icon: Sparkles,
  },
  OPEN_FIRST_BOX: {
    pose: "/hunt-assets/tutorial/lira-reward.png",
    eyebrow: "Первый бокс",
    title: "У меня есть подарок",
    body: "Я закинула тебе немного NearCoin. Сейчас идём в магазин и берём районную коробку, из неё выйдет твой первый боец.",
    cta: "В магазин",
    icon: Gift,
  },
  FIRST_BATTLE: {
    pose: "/hunt-assets/tutorial/lira-point.png",
    eyebrow: "Первый бой",
    title: "Пора размяться",
    body: "Не волнуйся, я рядом. Тап по клетке двигает героя, тап по врагу атакует. А способности зажимай пальцем, я подскажу, что они делают.",
    cta: "На арену",
    icon: Swords,
  },
  TACTICS: {
    pose: "/hunt-assets/tutorial/lira-bloomy.png",
    eyebrow: "Команда растёт",
    title: "Смотри, какой милашка",
    body: "Я нашла Блуми в кусту. Он пытался выглядеть загадочно, но выдал себя тем, что радостно шуршал листьями. Теперь у нас три героя: огонь, вода и природа. Стихия влияет на урон по другим стихиям, так что команда уже начинает играть головой.",
    cta: "Дальше",
    icon: MapIcon,
  },
  SECOND_BATTLE: {
    pose: "/hunt-assets/tutorial/lira-tydli.png",
    eyebrow: "Команда растёт",
    title: "Тайдли уже освоился",
    body: "Он маленький, но очень уверенный. Теперь сыграем второй короткий бой: у нас уже два героя, а значит можно смотреть не только на карту, но и на характеристики команды.",
    cta: "В бой 2 на 2",
    icon: Swords,
  },
  UPGRADE: {
    pose: "/hunt-assets/tutorial/lira-point.png",
    eyebrow: "Усиление",
    title: "Сделаем бойца сильнее",
    body: "После боя герой готов расти. Зайдём в коллекцию, выберем карту и поднимем уровень. Это не косметика, каждая характеристика чувствуется на арене.",
    cta: "В коллекцию",
    icon: TrendingUp,
  },
  COMPLETE: {
    pose: "/hunt-assets/tutorial/lira-bloomy.png",
    eyebrow: "Отряд готов",
    title: "Теперь у нас три героя",
    body: "Огонь, вода и природа играют по-разному. Стихия влияет на урон по другим стихиям, так что дальше будем собирать не просто милых, а полезных под матчап.",
    cta: "Играть",
    icon: CheckCircle2,
  },
};

function saveTutorialBattle(payload: { matchId: string; teamUuids: string[]; leadCardUuid: string; tutorialPhase: "first" | "second" }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    BATTLE_STORAGE_KEY,
    JSON.stringify({
      mode: "tutorial",
      teamUuids: payload.teamUuids,
      leadCardUuid: payload.leadCardUuid,
      matchId: payload.matchId,
      tutorial: true,
      tutorialPhase: payload.tutorialPhase,
      savedAt: new Date().toISOString(),
    }),
  );
}

function Tutorial({
  overview,
  busy,
  onAction,
}: {
  overview: HuntOverview;
  busy: boolean;
  onAction: () => void;
}) {
  const step = overview.profile.huntTutorialStep ?? "WELCOME";
  const copy = tutorialCopy[overview.profile.tutorialCompletedAt ? "COMPLETE" : step] ?? tutorialCopy.WELCOME;
  const Icon = copy.icon;
  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-5 backdrop-brightness-75"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="absolute inset-0 pointer-events-auto" aria-hidden="true" />
      <motion.section
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-cyan-300/25 bg-[radial-gradient(circle_at_72%_10%,rgba(103,232,249,0.18),transparent_38%),linear-gradient(150deg,rgba(8,13,22,0.98),rgba(3,7,18,0.99))] p-4 shadow-[0_22px_80px_rgba(0,0,0,0.62),0_0_45px_rgba(103,232,249,0.14)]"
      >
        <div className="pointer-events-none absolute -bottom-4 -left-7 h-[260px] w-[210px]">
          <img src={copy.pose} alt="" className="h-full w-full object-contain object-bottom drop-shadow-[0_22px_42px_rgba(0,0,0,0.48)]" />
        </div>
        <div className="relative ml-[104px] flex min-h-[210px] flex-col">
          <div className="relative rounded-[24px] border border-white/14 bg-white/[0.07] px-4 py-4 shadow-[0_18px_46px_rgba(0,0,0,0.28)] backdrop-blur">
            <span className="absolute -left-3 bottom-10 h-6 w-6 rotate-45 border-b border-l border-white/14 bg-[#111827]/90" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-100/72">{copy.eyebrow}</p>
            <h2 className="mt-1 text-[23px] font-semibold leading-tight text-white">{copy.title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">{copy.body}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-cyan-50/70">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10">
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span>{overview.profile.influenceBalance} NearCoin · {overview.profile.cardsOwnedCount} карт</span>
            </div>
          </div>
          <Button onClick={onAction} disabled={busy} className={cn("mt-3 ml-auto h-12 rounded-2xl bg-cyan-200 px-5 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            {copy.cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </motion.section>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
    </motion.div>
  );
}

function yandexMapUrl(post: HuntPost) {
  const latitude = post.latitude;
  const longitude = post.longitude;
  if (latitude != null && longitude != null) return `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17&l=map`;
  const query = [post.place?.name, post.place?.address, post.place?.district, post.place?.city].filter(Boolean).join(", ");
  return query ? `https://yandex.ru/maps/?text=${encodeURIComponent(query)}` : null;
}

function FeedCard({ post, onLike, onReport, onShare }: { post: HuntPost; onLike: (uuid: string) => void; onReport: (post: HuntPost) => void; onShare: (path: string, title: string) => void }) {
  const { t } = useI18n("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  const moodTags = Array.isArray(post.moodTags) ? post.moodTags : [];
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const image = mediaSrc(post.photoUrl ?? mediaUrls[0]);
  const mapUrl = yandexMapUrl(post);
  const displayTags = [...new Set([...moodTags, ...tags].map((tag) => tag.trim()).filter(Boolean))];
  const inlineTagLimit = post.rating ? 2 : 4;
  const inlineTags = displayTags.slice(0, inlineTagLimit);
  const hiddenTagCount = Math.max(0, displayTags.length - inlineTags.length);
  const authorName = post.author?.name || "Nearloy";
  const place = post.place;
  const placeTitle = [place?.name, place?.district, place?.city].filter(Boolean).join(", ") || t("client.hunt.localPlace");
  const shareTitle = `${place?.name || t("client.hunt.localPlace")} in Nearloy Hunt`;
  const authorInitials = authorName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-sm font-semibold text-cyan-50">
            {authorInitials || "NL"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{authorName}</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-white/48">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{placeTitle}</span>
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenuOpen((open) => !open)} className={cn("flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60", huntInteractiveClass)} aria-label={t("client.hunt.postMenu")}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-10 w-44 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.35)] backdrop-blur">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onReport(post);
                }}
                className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-white/74", huntInteractiveClass)}
              >
                <Flag className="h-4 w-4 text-cyan-100" />
                {t("client.hunt.report.open")}
              </button>
            </div>
          )}
        </div>
      </div>
      <p className="text-sm leading-6 text-white/78">{post.caption}</p>
      {image && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
          <img src={image} alt="" className="h-52 w-full object-cover" />
        </div>
      )}
      <div className="mt-2 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-white/48">
        {post.rating && <NearloyStars value={post.rating} size="sm" ariaLabel={t("client.hunt.create.rating")} />}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {inlineTags.map((tag) => <span key={tag} className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/52">#{tag}</span>)}
          {hiddenTagCount > 0 && <span className="shrink-0 rounded-full bg-cyan-200/10 px-2 py-1 text-[11px] text-cyan-50/78">{fill(t("client.hunt.moreTags"), { count: hiddenTagCount })}</span>}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onLike(post.uuid)}
            disabled={post.likedByMe}
            className={cn("flex h-9 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border px-3 text-sm", huntInteractiveClass, post.likedByMe ? "border-cyan-200/30 bg-cyan-200/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white")}
          >
            <Heart className={cn("h-4 w-4", post.likedByMe && "fill-cyan-200")} />
            {post.likeCount}
          </button>
        {mapUrl && (
          <a href={mapUrl} target="_blank" rel="noreferrer" className={cn("flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70", huntInteractiveClass)} aria-label={t("client.hunt.openMap")}>
            <MapIcon className="h-4 w-4" />
            {t("client.nav.map")}
        </a>
        )}
        <button
          type="button"
          onClick={() => onShare(`/hunt-share/post/${post.uuid}`, shareTitle)}
          className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}
          aria-label={t("client.hunt.forward")}
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function HuntPage() {
  const { t } = useI18n("ru");
  const router = useRouter();
  const [overview, setOverview] = useState<HuntOverview>(() => getCachedHuntOverview(false));
  const [feed, setFeed] = useState<HuntPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [overviewLoaded, setOverviewLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePostCount, setVisiblePostCount] = useState(HUNT_FEED_PAGE_SIZE);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<HuntPost | null>(null);
  const [reportReason, setReportReason] = useState<HuntReportReason>("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [dailyRewardOpen, setDailyRewardOpen] = useState(false);
  const [dailyRewardBusy, setDailyRewardBusy] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerUploading, setComposerUploading] = useState(false);
  const [composerLocating, setComposerLocating] = useState(false);
  const [composerPosition, setComposerPosition] = useState<ComposerPosition>(null);
  const [composerPhotos, setComposerPhotos] = useState<string[]>([]);
  const [composerForm, setComposerForm] = useState({
    placeName: "",
    address: "",
    caption: "",
    rating: "5",
    vibeTags: "",
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const refreshInFlightRef = useRef(false);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const shownDailyRewardIdRef = useRef<string | null>(null);

  const refresh = useCallback(async (force = false, background = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (background) setRefreshing(true);
    try {
      const [nextOverview, nextFeed] = await Promise.all([getHuntOverview(force), getHuntFeed(force)]);
      setOverview(nextOverview);
      setFeed(nextFeed);
      setOverviewLoaded(true);
      setLastUpdatedAt(new Date());
    } finally {
      refreshInFlightRef.current = false;
      if (background) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const refreshInBackground = () => {
      if (document.visibilityState === "visible") void refresh(true, true);
    };
    const interval = window.setInterval(refreshInBackground, HUNT_FEED_REFRESH_MS);
    window.addEventListener("focus", refreshInBackground);
    document.addEventListener("visibilitychange", refreshInBackground);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshInBackground);
      document.removeEventListener("visibilitychange", refreshInBackground);
    };
  }, [refresh]);

  useEffect(() => {
    setVisiblePostCount((current) => Math.min(Math.max(current, HUNT_FEED_PAGE_SIZE), Math.max(feed.length, HUNT_FEED_PAGE_SIZE)));
  }, [feed.length]);

  useEffect(() => {
    const reward = overview.dailyLikeReward;
    if (!overviewLoaded || !overview.profile.tutorialCompletedAt || !reward || reward.amount <= 0) return;
    if (shownDailyRewardIdRef.current === reward.id) return;
    shownDailyRewardIdRef.current = reward.id;
    setDailyRewardOpen(true);
  }, [overview.dailyLikeReward, overview.profile.tutorialCompletedAt, overviewLoaded]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visiblePostCount >= feed.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisiblePostCount((current) => Math.min(current + HUNT_FEED_PAGE_SIZE, feed.length));
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.length, visiblePostCount]);

  const visibleFeed = useMemo(() => feed.slice(0, visiblePostCount), [feed, visiblePostCount]);

  function shouldShowFeedAd(index: number) {
    return index === 2 || (index > 2 && (index - 2) % 6 === 0);
  }

  async function runTutorialAction() {
    if (tutorialBusy) return;
    const step = overview.profile.tutorialCompletedAt ? "COMPLETE" : overview.profile.huntTutorialStep ?? "WELCOME";
    setTutorialBusy(true);
    setNotice(null);
    try {
      if (step === "WELCOME") {
        const result = await advanceHuntTutorial("start");
        if (result.ok) {
          setOverview((current) => ({ ...current, profile: result.data.profile }));
          await refresh(true, true);
        } else setNotice(result.message);
        return;
      }
      if (step === "OPEN_FIRST_BOX") {
        router.push("/hunt/shop");
        return;
      }
      if (step === "FIRST_BATTLE") {
        const firstCard = overview.cards[0];
        if (!firstCard) {
          setNotice("Сначала откройте первую коробку в магазине.");
          return;
        }
        const result = await startHuntTutorialTrainingMatch(firstCard.uuid);
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        saveTutorialBattle({ matchId: result.data.matchId, teamUuids: [firstCard.uuid], leadCardUuid: firstCard.uuid, tutorialPhase: "first" });
        router.push("/hunt/battle/arena");
        return;
      }
      if (step === "SECOND_BATTLE") {
        const team = overview.cards.slice(0, 2);
        if (team.length < 2) {
          setNotice("Тайдли уже должен быть в команде. Обновите Hunt, и я подхвачу второй бой.");
          await refresh(true, true);
          return;
        }
        const result = await startHuntTutorialTrainingMatch(team[0].uuid, team.map((card) => card.uuid));
        if (!result.ok) {
          setNotice(result.message);
          return;
        }
        saveTutorialBattle({ matchId: result.data.matchId, teamUuids: team.map((card) => card.uuid), leadCardUuid: team[0].uuid, tutorialPhase: "second" });
        router.push("/hunt/battle/arena");
        return;
      }
      if (step === "TACTICS") {
        const result = await advanceHuntTutorial("tactics_seen");
        if (result.ok) {
          setOverview((current) => ({ ...current, profile: result.data.profile }));
          await refresh(true, true);
        } else setNotice(result.message);
        return;
      }
      if (step === "UPGRADE") {
        router.push("/hunt/cards");
        return;
      }
      router.push("/hunt/battle");
    } finally {
      setTutorialBusy(false);
    }
  }

  async function likePost(uuid: string) {
    const result = await likeHuntPost(uuid);
    if (result.ok) await refresh(true, true);
    else setNotice(result.message);
  }

  async function closeDailyReward(openShop = false) {
    if (dailyRewardBusy) return;
    setDailyRewardBusy(true);
    const result = await markHuntDailyRewardsSeen();
    if (result.ok) {
      setDailyRewardOpen(false);
      setOverview((current) => ({ ...current, dailyLikeReward: null }));
      if (openShop) router.push("/hunt/shop");
    } else {
      setNotice(result.message);
    }
    setDailyRewardBusy(false);
  }

  async function acceptPendingGift(giftUuid: string) {
    if (giftBusy) return;
    setGiftBusy(true);
    setNotice(null);
    const result = await acceptHuntGift(giftUuid);
    if (result.ok) {
      setOverview((current) => ({
        ...current,
        cards: [result.data.card, ...current.cards],
        pendingGifts: current.pendingGifts.filter((gift) => gift.uuid !== giftUuid),
        profile: {
          ...current.profile,
          cardsOwnedCount: current.profile.cardsOwnedCount + 1,
        },
      }));
      setNotice("Подарок принят. Персонаж уже в коллекции.");
    } else {
      setNotice(result.message);
    }
    setGiftBusy(false);
  }

  async function uploadComposerMedia(files: FileList | null) {
    const queue = Array.from(files ?? []).slice(0, Math.max(0, MAX_COMPOSER_PHOTOS - composerPhotos.length));
    if (queue.length === 0) return;
    setComposerUploading(true);
    setNotice(null);
    for (const file of queue) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const result = await uploadHuntMedia({
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        dataBase64: dataUrl.split(",")[1] ?? "",
      });
      if (result.ok) {
        setComposerPhotos((current) => [...current, result.data.url].slice(0, MAX_COMPOSER_PHOTOS));
      } else {
        setNotice(result.message);
        break;
      }
    }
    setComposerUploading(false);
  }

  function attachComposerLocation() {
    setNotice(null);
    if (!("geolocation" in navigator)) {
      setNotice("Геолокация недоступна в этом браузере.");
      return;
    }
    setComposerLocating(true);
    navigator.geolocation.getCurrentPosition(
      (value) => {
        const accuracy = Math.round(value.coords.accuracy);
        setComposerPosition({
          latitude: value.coords.latitude,
          longitude: value.coords.longitude,
          accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
        });
        setNotice("Геолокация привязана к посту.");
        setComposerLocating(false);
      },
      () => {
        setNotice("Не получилось получить геолокацию. Проверьте разрешение в браузере.");
        setComposerPosition(null);
        setComposerLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 },
    );
  }

  async function submitComposerPost() {
    if (composerBusy) return;
    if (composerPhotos.length === 0) {
      setNotice("Добавьте хотя бы одну фотографию для поста.");
      return;
    }
    if (composerForm.caption.trim().length < 12) {
      setNotice("Напишите пару слов о месте, чтобы пост был полезным.");
      return;
    }
    setComposerBusy(true);
    setNotice(null);
    const result = await createHuntPost({
      placeName: composerForm.placeName.trim() || undefined,
      address: composerForm.address.trim() || undefined,
      categorySlug: "coffee",
      caption: composerForm.caption.trim(),
      photoUrl: composerPhotos[0],
      mediaUrls: composerPhotos,
      rating: Number(composerForm.rating) || undefined,
      tags: ["coffee"],
      moodTags: splitList(composerForm.vibeTags),
      latitude: composerPosition?.latitude,
      longitude: composerPosition?.longitude,
      locationAccuracy: composerPosition?.accuracy,
    });
    if (result.ok) {
      setNotice("Пост опубликован. NearCoin уже летит в кошелёк.");
      setComposerForm({ placeName: "", address: "", caption: "", rating: "5", vibeTags: "" });
      setComposerPosition(null);
      setComposerPhotos([]);
      setComposerOpen(false);
      await refresh(true, true);
    } else {
      setNotice(result.message);
    }
    setComposerBusy(false);
  }

  async function submitReport() {
    if (!reportTarget || reportBusy) return;
    setReportBusy(true);
    const result = await reportHuntPost(reportTarget.uuid, { reason: reportReason, details: reportDetails.trim() || undefined });
    setNotice(result.ok ? t("client.hunt.reported") : result.message);
    if (result.ok) {
      setReportTarget(null);
      setReportReason("SPAM");
      setReportDetails("");
    }
    setReportBusy(false);
  }

  function openShare(path: string, title: string) {
    setShareTarget({ path, title });
  }

  async function copyShareLink() {
    if (!shareTarget) return;
    const url = `${window.location.origin}${shareTarget.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice(t("client.hunt.shareCopied"));
      setShareTarget(null);
    } catch {
      setNotice(t("client.hunt.shareCancelled"));
    }
  }

  async function nativeShare() {
    if (!shareTarget) return;
    const url = `${window.location.origin}${shareTarget.path}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTarget.title, url });
        setNotice(t("client.hunt.forwarded"));
        setShareTarget(null);
      } else {
        await copyShareLink();
      }
    } catch {
      setNotice(t("client.hunt.shareCancelled"));
    }
  }

  function shareTo(network: "telegram" | "vk" | "ok") {
    if (!shareTarget) return;
    const url = `${window.location.origin}${shareTarget.path}`;
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(shareTarget.title);
    const links = {
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      vk: `https://vk.com/share.php?url=${encodedUrl}&title=${encodedTitle}`,
      ok: `https://connect.ok.ru/offer?url=${encodedUrl}&title=${encodedTitle}`,
    };
    const telegramWebApp = (window as TelegramWindow).Telegram?.WebApp;
    if (network === "telegram" && telegramWebApp?.openTelegramLink) telegramWebApp.openTelegramLink(links.telegram);
    else window.open(links[network], "_blank", "noopener,noreferrer");
    setNotice(t("client.hunt.forwarded"));
    setShareTarget(null);
  }

  function actionMetric(metric: (typeof actionCards)[number]["metric"]) {
    if (metric === "boxes") return `${overview.boxes.length} ${t("client.hunt.shop.granted").toLowerCase()}`;
    if (metric === "trophies") return `${overview.profile.huntTrophies ?? 0} кубков`;
    return t("client.hunt.catalog");
  }

  const composerInitials =
    feed[0]?.author?.name
      ?.split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "NL";
  const showTutorial = overviewLoaded && !overview.profile.tutorialCompletedAt;
  const dailyReward = overview.dailyLikeReward;
  const pendingGift = overview.pendingGifts[0] ?? null;

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      {showTutorial && <Tutorial overview={overview} busy={tutorialBusy} onAction={runTutorialAction} />}

      <Dialog open={Boolean(pendingGift) && !showTutorial && !dailyRewardOpen} onOpenChange={() => undefined}>
        <DialogContent className="overflow-hidden border-cyan-200/20 bg-slate-950 p-0 text-white">
          {pendingGift && (
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.2),transparent_48%),radial-gradient(circle_at_20%_55%,rgba(168,85,247,0.16),transparent_34%)]" />
              <div className="relative p-5">
                <div className="relative mx-auto flex h-48 w-full max-w-[300px] items-center justify-center overflow-hidden rounded-[28px] border border-cyan-200/16 bg-cyan-200/[0.04]">
                  {pendingGift.species.imageUrl && (
                    <img src={mediaSrc(pendingGift.species.imageUrl) ?? pendingGift.species.imageUrl} alt="" className="h-full w-full object-contain p-4 drop-shadow-[0_20px_40px_rgba(103,232,249,0.25)]" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/80 to-transparent" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70">Nearloy Hunt</p>
                  <DialogTitle className="mt-1 text-2xl font-semibold">Тебе прислали персонажа</DialogTitle>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    {pendingGift.note || "Подарок уже ждёт принятия. Забирай карту в коллекцию."}
                  </p>
                </div>
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{pendingGift.species.nameRu ?? pendingGift.species.nameEn ?? pendingGift.species.name}</p>
                      <p className="mt-1 text-xs text-white/48">{pendingGift.rarity} · ур. {pendingGift.level}</p>
                    </div>
                    <Badge className="rounded-full border-cyan-200/20 bg-cyan-200/10 px-3 text-cyan-50">
                      Подарок
                    </Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  disabled={giftBusy}
                  onClick={() => void acceptPendingGift(pendingGift.uuid)}
                  className={cn("mt-5 h-12 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}
                >
                  <Gift className="mr-2 h-4 w-4" />
                  Принять подарок
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dailyRewardOpen && Boolean(dailyReward)} onOpenChange={(open) => !open && void closeDailyReward(false)}>
        <DialogContent className="overflow-hidden border-cyan-200/20 bg-slate-950 p-0 text-white">
          {dailyReward && (
            <div className="relative">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.22),transparent_48%),radial-gradient(circle_at_80%_30%,rgba(251,191,36,0.16),transparent_34%)]" />
              <div className="relative p-5">
                <div className="relative mx-auto flex h-44 w-full max-w-[300px] items-center justify-center overflow-hidden rounded-[28px] border border-cyan-200/16 bg-cyan-200/[0.04]">
                  <img src={mediaSrc(dailyReward.artUrl) ?? dailyReward.artUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/80 to-transparent" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/70">Nearloy Hunt</p>
                  <DialogTitle className="mt-1 text-2xl font-semibold">Посты принесли NearCoin</DialogTitle>
                  <p className="mt-2 text-sm leading-6 text-white/68">
                    Твои посты собрали {dailyReward.likes} лайков и принесли {dailyReward.amount} NearCoin. Милая бухгалтерия города поздравляет.
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <p className="text-xl font-semibold text-white">{dailyReward.postsCount}</p>
                    <p className="mt-1 text-[11px] text-white/46">постов</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <p className="text-xl font-semibold text-white">{dailyReward.likes}</p>
                    <p className="mt-1 text-[11px] text-white/46">лайков</p>
                  </div>
                  <div className="rounded-2xl border border-cyan-200/18 bg-cyan-200/10 p-3 text-center">
                    <p className="text-xl font-semibold text-cyan-50">{dailyReward.amount}</p>
                    <p className="mt-1 text-[11px] text-cyan-50/58">NC</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={dailyRewardBusy}
                    onClick={() => void closeDailyReward(false)}
                    className={cn("h-12 rounded-2xl border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]", huntInteractiveClass)}
                  >
                    Закрыть
                  </Button>
                  <Button
                    type="button"
                    disabled={dailyRewardBusy}
                    onClick={() => void closeDailyReward(true)}
                    className={cn("h-12 rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}
                  >
                    <Coins className="mr-2 h-4 w-4" />
                    В магазин
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate text-[32px] font-semibold leading-none tracking-tight text-white drop-shadow-[0_0_20px_rgba(103,232,249,0.22)]">
          {t("client.hunt.title")} <span className="text-cyan-200">✦</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className="h-9 rounded-full border-cyan-200/28 bg-cyan-200/10 px-3 text-sm font-semibold text-cyan-50 shadow-[0_0_24px_rgba(103,232,249,0.12)]">
            {overview.profile.influenceBalance} {t("client.hunt.influence")}
          </Badge>
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className={cn("relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/70", huntInteractiveClass, notificationsOpen && "border-cyan-200/30 bg-cyan-200/10 text-cyan-50")}
              aria-label="Уведомления"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-5 w-5" />
            </button>
            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-13 z-50 w-72 overflow-hidden rounded-[24px] border border-cyan-200/18 bg-slate-950/96 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Уведомления</p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-white/46">Hunt</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-sm font-semibold text-white/84">Пока тихо</p>
                      <p className="mt-1 text-xs leading-5 text-white/48">Когда появятся награды, лайки, кубки или важные события, они будут здесь.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className={cn("h-10 rounded-2xl border border-cyan-200/18 bg-cyan-200/10 text-sm font-semibold text-cyan-50", huntInteractiveClass)}
                    >
                      Понятно
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <section className="relative z-30 mb-6 rounded-[26px] border border-cyan-200/18 bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(2,6,12,0.88))] p-2.5 shadow-[0_20px_70px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2.5">
          <button type="button" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border border-cyan-200/22 bg-cyan-200/10 text-base font-semibold text-cyan-50 sm:h-14 sm:w-14 sm:rounded-[22px]">
            {composerInitials}
          </button>
          <button
            type="button"
            onClick={() => setComposerOpen((open) => !open)}
            className={cn("flex h-12 min-w-0 flex-1 items-center rounded-[20px] border border-white/10 bg-black/18 px-4 text-left text-base text-white/48 sm:h-14 sm:rounded-[22px] sm:text-lg", huntInteractiveClass, composerOpen && "border-cyan-200/35 bg-cyan-200/10 text-cyan-50")}
          >
            <span className="truncate">Создать пост...</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setComposerOpen(true);
              window.setTimeout(() => composerFileInputRef.current?.click(), 120);
            }}
            className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border border-cyan-200/22 bg-cyan-200/10 text-cyan-50 sm:h-14 sm:w-14 sm:rounded-[22px]", huntInteractiveClass)}
            aria-label="Добавить фото"
          >
            <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {composerOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 right-0 top-[calc(100%+8px)] z-50"
            >
              <div className="rounded-[26px] border border-cyan-200/18 bg-slate-950/95 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.55),0_0_38px_rgba(103,232,249,0.1)] backdrop-blur-xl">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={composerForm.placeName}
                    onChange={(event) => setComposerForm((current) => ({ ...current, placeName: event.target.value }))}
                    placeholder="Название места"
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38"
                  />
                  <Input
                    value={composerForm.address}
                    onChange={(event) => setComposerForm((current) => ({ ...current, address: event.target.value }))}
                    placeholder="Адрес или район"
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38"
                  />
                </div>
                <Textarea
                  value={composerForm.caption}
                  onChange={(event) => setComposerForm((current) => ({ ...current, caption: event.target.value }))}
                  placeholder="Расскажи, чем место зацепило..."
                  className="mt-2 min-h-24 rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <NearloyStars value={Number(composerForm.rating)} onChange={(rating) => setComposerForm((current) => ({ ...current, rating: String(rating) }))} ariaLabel={t("client.hunt.create.rating")} />
                  <Input
                    value={composerForm.vibeTags}
                    onChange={(event) => setComposerForm((current) => ({ ...current, vibeTags: event.target.value }))}
                    placeholder="теги через запятую"
                    className="h-10 w-full rounded-2xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/38 sm:w-48"
                  />
                </div>
                <input
                  ref={composerFileInputRef}
                  multiple
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    void uploadComposerMedia(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
                <div className="mt-3 grid gap-2">
                  {composerPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {composerPhotos.map((photo) => (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setComposerPhotos((current) => current.filter((item) => item !== photo))}
                          className={cn("overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]", huntInteractiveClass)}
                          aria-label="Убрать фото"
                        >
                          <img src={mediaSrc(photo) ?? ""} alt="" className="aspect-square w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={composerUploading || composerPhotos.length >= MAX_COMPOSER_PHOTOS}
                      onClick={() => composerFileInputRef.current?.click()}
                      className={cn("h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]", huntInteractiveClass)}
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      {composerUploading ? "Загружаем..." : `Фото ${composerPhotos.length}/${MAX_COMPOSER_PHOTOS}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={composerLocating}
                      onClick={attachComposerLocation}
                      className={cn(
                        "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]",
                        composerPosition && "border-cyan-200/28 bg-cyan-200/10 text-cyan-50",
                        huntInteractiveClass,
                      )}
                    >
                      <MapPin className="mr-2 h-4 w-4" />
                      {composerLocating ? "Ищем..." : composerPosition ? "Гео ✓" : "Гео"}
                    </Button>
                    <Button
                      type="button"
                      disabled={composerBusy}
                      onClick={submitComposerPost}
                      className={cn("col-span-2 h-11 rounded-2xl bg-cyan-200 px-5 font-semibold text-slate-950 hover:bg-cyan-100 sm:col-span-1", huntInteractiveClass)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Опубликовать
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="mb-7">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Быстрый доступ</h2>
          <Link href="/hunt/sections" className={cn("inline-flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold text-cyan-100", huntInteractiveClass)}>
            Все разделы
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {actionCards.map(({ href, icon: Icon, image, labelKey, metric }) => (
          <Link key={href} href={href} className={cn("group relative min-h-28 overflow-hidden rounded-[22px] border border-cyan-200/18 bg-slate-950/80 p-2.5 shadow-[0_18px_54px_rgba(0,0,0,0.24)] sm:min-h-32 sm:rounded-[26px] sm:p-3", huntInteractiveClass)}>
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-300 group-hover:scale-105 group-hover:opacity-65" />
            <span className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/12 text-cyan-50 sm:h-9 sm:w-9">
              <Icon className="h-4 w-4" />
            </span>
            <span className="relative mt-7 block text-[13px] font-semibold leading-tight text-white sm:mt-8 sm:text-sm">{t(labelKey)}</span>
            <span className="relative mt-1 inline-flex max-w-full rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2 py-1 text-[10px] leading-none text-cyan-50/82 sm:text-[11px]">{actionMetric(metric)}</span>
          </Link>
        ))}
        </div>
      </section>

      <section className="mb-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[32px] font-semibold leading-none">Лента</h2>
          <button type="button" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/82">
            Сначала новое
          </button>
        </div>
        {(loading || refreshing || lastUpdatedAt) && <div className="sr-only">{loading ? t("client.hunt.loading") : refreshing ? t("client.hunt.refreshing") : t("client.hunt.live")}</div>}
        <div className="space-y-4">
          {visibleFeed.map((post, index) => (
            <div key={post.uuid} className="space-y-3">
              <FeedCard post={post} onLike={likePost} onReport={setReportTarget} onShare={openShare} />
              {shouldShowFeedAd(index) && (
                <YandexRtbAd
                  blockId={HUNT_FEED_AD_BLOCK_ID}
                  pageNumber={Math.floor(index / 6) + 1}
                  placement="hunt-feed"
                  type="banner"
                  className="my-1"
                />
              )}
            </div>
          ))}
          {feed.length === 0 && <div className="rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54">{t("client.hunt.emptyFeed")}</div>}
          {visiblePostCount < feed.length && (
            <div ref={loadMoreRef} className="rounded-3xl border border-dashed border-cyan-200/15 bg-cyan-200/[0.04] p-4 text-center text-xs text-cyan-50/70">
              {t("client.hunt.loadingMore")}
            </div>
          )}
        </div>
      </section>

      <Dialog open={Boolean(reportTarget)} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.report.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {reportReasons.map((reason) => (
              <button key={reason.value} type="button" onClick={() => setReportReason(reason.value)} className={cn("rounded-2xl border px-3 py-3 text-left text-sm", huntInteractiveClass, reportReason === reason.value ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-white/70")}>
                {t(reason.labelKey)}
              </button>
            ))}
          </div>
          {reportReason === "OTHER" && (
            <Textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder={t("client.hunt.report.details")} className="min-h-24 bg-white/[0.04]" />
          )}
          <Button type="button" disabled={reportBusy || (reportReason === "OTHER" && reportDetails.trim().length < 3)} onClick={submitReport} className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
            <Send className="mr-2 h-4 w-4" />
            {t("client.hunt.report.submit")}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(shareTarget)} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.share.title")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => shareTo("telegram")} className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left", huntInteractiveClass)}>
              <Send className="mb-3 h-5 w-5 text-cyan-100" />
              <span className="block font-semibold">Telegram</span>
            </button>
            <button type="button" onClick={() => shareTo("vk")} className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left", huntInteractiveClass)}>
              <UsersRound className="mb-3 h-5 w-5 text-cyan-100" />
              <span className="block font-semibold">VK</span>
            </button>
            <button type="button" onClick={() => shareTo("ok")} className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left", huntInteractiveClass)}>
              <UsersRound className="mb-3 h-5 w-5 text-cyan-100" />
              <span className="block font-semibold">Одноклассники</span>
            </button>
            <button type="button" onClick={nativeShare} className={cn("rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left", huntInteractiveClass)}>
              <Share2 className="mb-3 h-5 w-5 text-cyan-100" />
              <span className="block font-semibold">{t("client.hunt.share.system")}</span>
            </button>
          </div>
          <Button type="button" variant="outline" onClick={copyShareLink} className={cn("rounded-2xl border-cyan-200/20 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/15", huntInteractiveClass)}>
            <Copy className="mr-2 h-4 w-4" />
            {t("client.hunt.share.copy")}
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
