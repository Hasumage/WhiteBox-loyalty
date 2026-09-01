"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, CheckCircle2, Copy, Flag, Gift, Heart, Map as MapIcon, MapPin, MoreHorizontal, Send, Share2, Sparkles, UsersRound, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { YandexRtbAd } from "@/components/ads/YandexRtbAd";
import { completeHuntTutorial, getCachedHuntOverview, getHuntFeed, getHuntOverview, likeHuntPost, reportHuntPost, type HuntOverview, type HuntPost, type HuntReportReason } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { huntInteractiveClass, mediaSrc, NearloyStars } from "./_components/hunt-ui";

const actionCards = [
  { href: "/hunt/create", icon: Camera, labelKey: "client.hunt.createPost", image: "/hunt-assets/posts/demo-coffee-corner.webp", metric: "posts" },
  { href: "/hunt/cards", icon: WalletCards, labelKey: "client.hunt.collection", image: "/hunt-assets/cards/compass-light.webp", metric: "cards" },
  { href: "/hunt/shop", icon: Gift, labelKey: "client.hunt.shop.title", image: "/hunt-assets/shop/weekly-gold-chest.webp", metric: "boxes" },
  { href: "/hunt/all-cards", icon: Sparkles, labelKey: "client.hunt.allCards", image: "/hunt-assets/cards/creature-sheet.png", metric: "catalog" },
] satisfies Array<{ href: string; icon: typeof Camera; labelKey: TranslationKey; image: string; metric: "posts" | "boxes" | "cards" | "catalog" }>;

const HUNT_FEED_PAGE_SIZE = 8;
const HUNT_FEED_REFRESH_MS = 15000;
const HUNT_FEED_AD_BLOCK_ID = process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_FEED_BLOCK_ID;

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

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function Tutorial({ onComplete }: { onComplete: () => void }) {
  const { t } = useI18n("ru");
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(103,232,249,0.18),rgba(8,13,22,0.82)_45%,rgba(4,6,12,0.98))] p-4 shadow-[0_0_45px_rgba(103,232,249,0.12)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/80">{t("client.hunt.title")}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{t("client.hunt.tutorialTitle")}</h1>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10">
          <Sparkles className="h-6 w-6 text-cyan-100" />
        </div>
      </div>
      <div className="grid gap-2 text-sm text-white/74">
        <p>{t("client.hunt.tutorialOne")}</p>
        <p>{t("client.hunt.tutorialTwo")}</p>
        <p>{t("client.hunt.tutorialThree")}</p>
      </div>
      <Button onClick={onComplete} className={cn("mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {t("client.hunt.start")}
      </Button>
    </motion.section>
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
  const [overview, setOverview] = useState<HuntOverview>(getCachedHuntOverview());
  const [feed, setFeed] = useState<HuntPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [visiblePostCount, setVisiblePostCount] = useState(HUNT_FEED_PAGE_SIZE);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<HuntPost | null>(null);
  const [reportReason, setReportReason] = useState<HuntReportReason>("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [shareTarget, setShareTarget] = useState<ShareTarget>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async (force = false, background = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (background) setRefreshing(true);
    try {
      const [nextOverview, nextFeed] = await Promise.all([getHuntOverview(force), getHuntFeed(force)]);
      setOverview(nextOverview);
      setFeed(nextFeed);
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

  async function finishTutorial() {
    const result = await completeHuntTutorial();
    if (result.ok) setOverview((current) => ({ ...current, profile: result.data.profile }));
  }

  async function likePost(uuid: string) {
    const result = await likeHuntPost(uuid);
    if (result.ok) await refresh(true, true);
    else setNotice(result.message);
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

  function pluralRu(count: number, forms: [string, string, string]) {
    const value = Math.abs(count) % 100;
    const last = value % 10;
    if (value > 10 && value < 20) return forms[2];
    if (last === 1) return forms[0];
    if (last >= 2 && last <= 4) return forms[1];
    return forms[2];
  }

  function actionMetric(metric: (typeof actionCards)[number]["metric"]) {
    if (metric === "posts") return `${overview.profile.postsCount} ${t("client.hunt.posts").toLowerCase()}`;
    if (metric === "boxes") return `${overview.boxes.length} ${t("client.hunt.shop.granted").toLowerCase()}`;
    if (metric === "cards") return `${overview.profile.cardsOwnedCount} ${pluralRu(overview.profile.cardsOwnedCount, ["карта", "карты", "карт"])}`;
    return t("client.hunt.catalog");
  }

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      {!overview.profile.tutorialCompletedAt && <Tutorial onComplete={finishTutorial} />}

      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{t("client.hunt.title")}</h1>
        </div>
        <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">{overview.profile.influenceBalance} {t("client.hunt.influence")}</Badge>
      </header>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <section className="mb-5 grid grid-cols-2 gap-2">
        {actionCards.map(({ href, icon: Icon, image, labelKey, metric }) => (
          <Link key={href} href={href} className={cn("group relative min-h-32 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 p-3", huntInteractiveClass)}>
            <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-300 group-hover:scale-105 group-hover:opacity-65" />
            <span className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
            <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/12 text-cyan-50">
              <Icon className="h-4 w-4" />
            </span>
            <span className="relative mt-8 block text-sm font-semibold text-white">{t(labelKey)}</span>
            <span className="relative mt-1 inline-flex rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2 py-1 text-[11px] text-cyan-50/82">{actionMetric(metric)}</span>
          </Link>
        ))}
      </section>

      <section className="mb-5">
        {(loading || refreshing || lastUpdatedAt) && <div className="sr-only">{loading ? t("client.hunt.loading") : refreshing ? t("client.hunt.refreshing") : t("client.hunt.live")}</div>}
        <div className="space-y-3">
          {visibleFeed.map((post, index) => (
            <div key={post.uuid} className="contents">
              <FeedCard post={post} onLike={likePost} onReport={setReportTarget} onShare={openShare} />
              {shouldShowFeedAd(index) && (
                <YandexRtbAd
                  blockId={HUNT_FEED_AD_BLOCK_ID}
                  pageNumber={Math.floor(index / 6) + 1}
                  placement="hunt-feed"
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
