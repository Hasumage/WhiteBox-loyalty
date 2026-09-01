"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Heart, Map as MapIcon, MapPin, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { YandexRtbAd } from "@/components/ads/YandexRtbAd";
import { getPublicHuntFeed, type HuntPost } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { huntInteractiveClass, mediaSrc, NearloyStars } from "@/app/(twa)/hunt/_components/hunt-ui";

const PUBLIC_FEED_PAGE_SIZE = 8;
const PUBLIC_FEED_REFRESH_MS = 20000;
const PUBLIC_HUNT_FEED_AD_BLOCK_ID = process.env.NEXT_PUBLIC_YANDEX_RSYA_HUNT_FEED_BLOCK_ID;

type Translate = ReturnType<typeof useI18n>["t"];

function buildPublicHuntDemoFeed(t: Translate): HuntPost[] {
  return [
  {
    uuid: "public-demo-coffee-corner",
    caption: t("marketing.hunt.demo.coffee.caption"),
    photoUrl: "/hunt-assets/posts/demo-coffee-corner.webp",
    mediaUrls: ["/hunt-assets/posts/demo-coffee-corner.webp"],
    tags: ["coffee", "work", "morning"],
    rating: 5,
    visitPriceBand: null,
    moodTags: [t("marketing.hunt.demo.coffee.moodOne"), t("marketing.hunt.demo.coffee.moodTwo")],
    gpsConfidence: 100,
    latitude: 55.7601,
    longitude: 37.6118,
    moderationStatus: "CLEAR",
    likeCount: 7,
    score: 92,
    likedByMe: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    author: { uuid: "public-demo-emma-clark", name: "Emma Clark" },
    place: {
      uuid: "public-demo-place-coffee-corner",
      slug: "nh-demo-coffee-corner",
      name: "Coffee Corner",
      address: "Москва, Тверская улица, 7",
      city: "Moscow",
      district: "Center",
      tags: ["coffee", "work"],
      source: "SYSTEM_SEEDED",
      category: { id: 1, slug: "coffee", name: "Coffee", icon: "Coffee" },
      company: null,
    },
  },
  {
    uuid: "public-demo-river-walk",
    caption: t("marketing.hunt.demo.river.caption"),
    photoUrl: "/hunt-assets/posts/demo-river-walk.webp",
    mediaUrls: ["/hunt-assets/posts/demo-river-walk.webp"],
    tags: ["walk", "city", "route"],
    rating: 4,
    visitPriceBand: null,
    moodTags: [t("marketing.hunt.demo.river.moodOne"), t("marketing.hunt.demo.river.moodTwo")],
    gpsConfidence: 100,
    latitude: 55.7353,
    longitude: 37.5987,
    moderationStatus: "CLEAR",
    likeCount: 6,
    score: 76,
    likedByMe: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    author: { uuid: "public-demo-liam-scott", name: "Liam Scott" },
    place: {
      uuid: "public-demo-place-river-walk",
      slug: "nh-demo-river-walk",
      name: "River Walk",
      address: "Москва, Крымская набережная",
      city: "Moscow",
      district: "Embankment",
      tags: ["walk", "route"],
      source: "SYSTEM_SEEDED",
      category: { id: 2, slug: "travel", name: "Travel", icon: "Map" },
      company: null,
    },
  },
  {
    uuid: "public-demo-green-break",
    caption: t("marketing.hunt.demo.green.caption"),
    photoUrl: "/hunt-assets/posts/demo-green-break.webp",
    mediaUrls: ["/hunt-assets/posts/demo-green-break.webp"],
    tags: ["health", "park", "pause"],
    rating: 5,
    visitPriceBand: null,
    moodTags: [t("marketing.hunt.demo.green.moodOne"), t("marketing.hunt.demo.green.moodTwo")],
    gpsConfidence: 100,
    latitude: 55.7197,
    longitude: 37.5905,
    moderationStatus: "CLEAR",
    likeCount: 7,
    score: 84,
    likedByMe: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
    author: { uuid: "public-demo-olivia-reed", name: "Olivia Reed" },
    place: {
      uuid: "public-demo-place-green-break",
      slug: "nh-demo-green-break",
      name: "Green Break",
      address: "Москва, Нескучный сад",
      city: "Moscow",
      district: "Park",
      tags: ["calm", "healthy"],
      source: "SYSTEM_SEEDED",
      category: { id: 3, slug: "health", name: "Health", icon: "HeartPulse" },
      company: null,
    },
  },
  ];
}

function yandexMapUrl(post: HuntPost) {
  const latitude = post.latitude;
  const longitude = post.longitude;
  if (latitude != null && longitude != null) return `https://yandex.ru/maps/?pt=${longitude},${latitude}&z=17&l=map`;
  const query = [post.place?.name, post.place?.address, post.place?.district, post.place?.city].filter(Boolean).join(", ");
  return query ? `https://yandex.ru/maps/?text=${encodeURIComponent(query)}` : null;
}

function shouldShowFeedAd(index: number) {
  return index === 2 || (index > 2 && (index - 2) % 6 === 0);
}

function PublicFeedCard({ post }: { post: HuntPost }) {
  const { t } = useI18n("ru");
  const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  const moodTags = Array.isArray(post.moodTags) ? post.moodTags : [];
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const image = mediaSrc(post.photoUrl ?? mediaUrls[0]);
  const mapUrl = yandexMapUrl(post);
  const displayTags = [...new Set([...moodTags, ...tags].map((tag) => tag.trim()).filter(Boolean))].slice(0, 5);
  const authorName = post.author?.name || "Nearloy";
  const placeTitle = [post.place?.name, post.place?.district, post.place?.city].filter(Boolean).join(", ") || t("marketing.hunt.placeFallback");
  const authorInitials = authorName
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function share() {
    const url = `${window.location.origin}/hunt-share/post/${post.uuid}`;
    const title = t("marketing.hunt.shareTitle").replace("{place}", post.place?.name || "Nearloy Hunt");
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  return (
    <article className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/10 text-sm font-semibold text-cyan-50">
              {authorInitials || "NL"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{authorName}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-white/48">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{placeTitle}</span>
              </p>
            </div>
          </div>
          <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">Hunt</Badge>
        </div>

        <p className="text-sm leading-6 text-white/78">{post.caption}</p>

        {image && (
          <Link href={`/hunt-share/post/${post.uuid}`} className={cn("mt-3 block overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70", huntInteractiveClass)}>
            <img src={image} alt="" className="h-56 w-full object-cover transition duration-300 hover:scale-[1.02]" />
          </Link>
        )}

        <div className="mt-3 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-white/48">
          {post.rating && <NearloyStars value={post.rating} size="sm" ariaLabel="Оценка места" />}
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {displayTags.map((tag) => (
              <span key={tag} className="shrink-0 rounded-full bg-white/[0.06] px-2 py-1 text-[11px] text-white/52">#{tag}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <Link href="/login?next=/hunt" className={cn("flex h-9 min-w-12 shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-white", huntInteractiveClass)}>
            <Heart className="h-4 w-4" />
            {post.likeCount}
          </Link>
          <div className="flex items-center gap-2">
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noreferrer" className={cn("flex h-9 shrink-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70", huntInteractiveClass)} aria-label={t("marketing.hunt.openYandexMap")}>
                <MapIcon className="h-4 w-4" />
                {t("marketing.hunt.map")}
              </a>
            )}
            <button type="button" onClick={() => void share()} className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)} aria-label={t("marketing.hunt.share")}>
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function PublicHuntFeedClient() {
  const { t } = useI18n("ru");
  const [feed, setFeed] = useState<HuntPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [visiblePostCount, setVisiblePostCount] = useState(PUBLIC_FEED_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const refreshInFlightRef = useRef(false);

  const refresh = useCallback(async (force = false) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      const nextFeed = await getPublicHuntFeed(force);
      setFeed(nextFeed.length > 0 ? nextFeed : buildPublicHuntDemoFeed(t));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    void refresh(true).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh(true);
    }, PUBLIC_FEED_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    setVisiblePostCount((current) => Math.min(Math.max(current, PUBLIC_FEED_PAGE_SIZE), Math.max(feed.length, PUBLIC_FEED_PAGE_SIZE)));
  }, [feed.length]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || visiblePostCount >= feed.length) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setVisiblePostCount((current) => Math.min(current + PUBLIC_FEED_PAGE_SIZE, feed.length));
      },
      { rootMargin: "360px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feed.length, visiblePostCount]);

  const visibleFeed = useMemo(() => feed.slice(0, visiblePostCount), [feed, visiblePostCount]);

  return (
    <section className="mx-auto max-w-2xl px-4 pb-16">
      <div className="space-y-3">
        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-white/54">{t("marketing.hunt.loading")}</div>
        )}
        {!loading && feed.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/15 p-6 text-center text-sm text-white/54">{t("marketing.hunt.empty")}</div>
        )}
        {visibleFeed.map((post, index) => (
          <div key={post.uuid} className="contents">
            <PublicFeedCard post={post} />
            {shouldShowFeedAd(index) && (
              <YandexRtbAd
                blockId={PUBLIC_HUNT_FEED_AD_BLOCK_ID}
                pageNumber={Math.floor(index / 6) + 1}
                placement="hunt-public-feed"
              />
            )}
          </div>
        ))}
        {visiblePostCount < feed.length && (
          <div ref={loadMoreRef} className="rounded-3xl border border-dashed border-cyan-200/15 bg-cyan-200/[0.04] p-4 text-center text-xs text-cyan-50/70">
            {t("marketing.hunt.loadingMore")}
          </div>
        )}
      </div>
    </section>
  );
}
