"use client";

import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Building2,
  Check,
  ChevronRight,
  Compass,
  Copy,
  Gift,
  Globe2,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Route,
  Send,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  TicketPercent,
} from "lucide-react";
import {
  getCachedTwaHistory,
  getCachedTwaWallet,
  getPublicTwaCompany,
  getPublicTwaCompanySuggestions,
  getTwaHistory,
  getTwaWallet,
  setTwaCompanyFavorite,
  type TwaCompany,
  type TwaHistory,
} from "@/lib/api/twa-client";
import { getAccessToken } from "@/lib/api/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { cn } from "@/lib/utils";
import { TwaLoadingScreen } from "@/components/twa/TwaLoadingScreen";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { companyLevelName } from "@/lib/i18n/company-levels";

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];
const EMPTY_HISTORY: TwaHistory = {
  transactions: [],
  redemptions: [],
  subscriptions: [],
  archivedSubscriptions: [],
};

const AURORA_ASSETS = {
  hero: "/company-assets/aurora/hero-coffee-shop.webp",
  coffee: "/company-assets/aurora/reward-coffee.webp",
  dessert: "/company-assets/aurora/reward-dessert.webp",
  frappe: "/company-assets/aurora/reward-frappe.webp",
};

const COMPANY_PLACEHOLDER_ASSETS = {
  hero: "/company-assets/placeholders/company-hero.svg",
  logo: "/company-assets/placeholders/company-logo.svg",
  gallery: "/company-assets/placeholders/company-gallery.svg",
  galleryAlt: "/company-assets/placeholders/company-gallery-2.svg",
  galleryExtra: "/company-assets/placeholders/company-gallery-3.svg",
  offer: "/company-assets/placeholders/company-offer.svg",
};

function replaceBrokenImage(event: SyntheticEvent<HTMLImageElement>, fallback: string) {
  if (event.currentTarget.src.endsWith(fallback)) return;
  event.currentTarget.src = fallback;
}

type PublicMediaAsset = {
  id: string;
  title: string | null;
  description: string | null;
  url: string | null;
  width: number;
  height: number;
  sortOrder: number;
};

type PublicSpecialOffer = {
  id: string;
  title: string;
  description: string | null;
  code: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  sortOrder: number;
};

type PublicCompanyMediaState = {
  media: {
    logo: PublicMediaAsset | null;
    hero: PublicMediaAsset | null;
    gallery: PublicMediaAsset[];
  };
  offers: PublicSpecialOffer[];
  socialLinks: Array<{
    id: string;
    kind: "WEBSITE" | "VK" | "MAX" | "OTHER";
    title: string;
    url: string;
    sortOrder: number;
  }>;
};

type GalleryItem = {
  title: string;
  caption: string;
  image: string;
  className: string;
  position: string;
};

const PUBLIC_GALLERY_ITEMS: GalleryItem[] = [
  {
    title: "Атмосфера вечера",
    caption: "бар, свет и спокойный вайб",
    image: AURORA_ASSETS.hero,
    className: "col-span-2 h-36",
    position: "center 44%",
  },
  {
    title: "Фирменный кофе",
    caption: "напитки каждый день",
    image: AURORA_ASSETS.coffee,
    className: "h-32",
    position: "center",
  },
  {
    title: "Десерты",
    caption: "к кофе и встречам",
    image: AURORA_ASSETS.dessert,
    className: "h-32",
    position: "center",
  },
  {
    title: "Холодные напитки",
    caption: "для прогулок рядом",
    image: AURORA_ASSETS.frappe,
    className: "h-32",
    position: "center",
  },
  {
    title: "Уютный зал",
    caption: "можно зависнуть с ноутом",
    image: AURORA_ASSETS.hero,
    className: "h-32",
    position: "68% 42%",
  },
  {
    title: "Латте-арт",
    caption: "маленький ритуал дня",
    image: AURORA_ASSETS.coffee,
    className: "col-span-2 h-36",
    position: "center 36%",
  },
  {
    title: "Сладкая витрина",
    caption: "новинки и классика",
    image: AURORA_ASSETS.dessert,
    className: "h-32",
    position: "center",
  },
  {
    title: "Барная стойка",
    caption: "быстрый заказ",
    image: AURORA_ASSETS.hero,
    className: "h-32",
    position: "34% 46%",
  },
  {
    title: "Напиток с собой",
    caption: "по пути на дела",
    image: AURORA_ASSETS.frappe,
    className: "h-32",
    position: "center",
  },
  {
    title: "Подарки за баллы",
    caption: "копите и забирайте",
    image: AURORA_ASSETS.coffee,
    className: "h-32",
    position: "center",
  },
].slice(0, 10);

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isLocationOpenNow(location: TwaCompany["locations"][number], now = new Date()) {
  const day = now.getDay();
  const workingDays = Array.isArray(location.workingDays) ? location.workingDays : DEFAULT_WORKING_DAYS;
  if (!workingDays.includes(day)) return false;
  const open = timeToMinutes(location.openTime ?? "09:00");
  const close = timeToMinutes(location.closeTime ?? "21:00");
  if (open == null || close == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (open === close) return true;
  if (open < close) return current >= open && current < close;
  return current >= open || current < close;
}

function routeHref(location: TwaCompany["locations"][number]) {
  return `https://yandex.ru/maps/?rtext=~${location.latitude},${location.longitude}&rtt=auto`;
}

function PublicSocialIcon({ kind }: { kind: "WEBSITE" | "VK" | "MAX" | "OTHER" }) {
  if (kind === "VK") return <span className="text-[11px] font-black tracking-[-0.04em]">VK</span>;
  if (kind === "MAX") return <MessageCircle className="h-4 w-4" />;
  if (kind === "WEBSITE") return <Globe2 className="h-4 w-4" />;
  return null;
}

function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "22:00";
}

function formatOperationTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / (24 * 60 * 60 * 1000));
  const time = date.toLocaleTimeString(locale === "ru" ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" });

  if (dayDiff === 0) return `${locale === "ru" ? "Сегодня" : "Today"} · ${time}`;
  if (dayDiff === 1) return `${locale === "ru" ? "Вчера" : "Yesterday"} · ${time}`;
  return `${dayDiff} ${locale === "ru" ? "дн. назад" : "days ago"} · ${time}`;
}

function operationsForCompany(history: TwaHistory, company: TwaCompany, locale: string) {
  const transactions = history.transactions
    .filter((operation) => operation.company.id === company.id)
    .map((operation) => ({
      id: operation.uuid,
      amount: operation.type === "SPEND" ? -operation.amount : operation.amount,
      title: operation.type === "SPEND" ? "Оплата баллами" : "Покупка",
      subtitle: operation.description ?? (operation.type === "SPEND" ? "Списание в заведении" : "Начисление баллов"),
      occurredAt: operation.occurredAt,
      time: formatOperationTime(operation.occurredAt, locale),
      tone: operation.type === "SPEND" ? "amber" : "violet",
      icon: operation.type === "SPEND" ? ShoppingBag : Star,
    }));

  const redemptions = history.redemptions
    .filter((operation) => operation.company.id === company.id)
    .map((operation) => ({
      id: operation.uuid,
      amount: -operation.quantity,
      title: "Награда",
      subtitle: operation.benefit,
      occurredAt: operation.redeemedAt,
      time: formatOperationTime(operation.redeemedAt, locale),
      tone: "amber",
      icon: Gift,
    }));

  return [...transactions, ...redemptions]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 3);
}

export default function WalletPage() {
  const { locale, t } = useI18n("ru");
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [history, setHistory] = useState<TwaHistory>(() => getCachedTwaHistory());
  const [loading, setLoading] = useState(true);
  const [isPublicView, setIsPublicView] = useState(false);
  const [isGuestView, setIsGuestView] = useState(false);
  const [suggestedCompanies, setSuggestedCompanies] = useState<TwaCompany[]>([]);
  const [publicMedia, setPublicMedia] = useState<PublicCompanyMediaState | null>(null);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedGalleryItem, setSelectedGalleryItem] = useState<GalleryItem | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [favoriteSaving, setFavoriteSaving] = useState(false);
  const [largeFavoriteHidden, setLargeFavoriteHidden] = useState(false);
  const [favoritePulse, setFavoritePulse] = useState(0);
  const [favoriteFlight, setFavoriteFlight] = useState<{
    id: number;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  } | null>(null);
  const headerFavoriteButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeFavoriteButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    const loadPublicCompany = async (guestView: boolean) => {
      const publicCompany = await getPublicTwaCompany(id);
      const suggestions = publicCompany ? [] : await getPublicTwaCompanySuggestions(id, 4);
      if (ignore) return;
      setIsPublicView(true);
      setIsGuestView(guestView);
      setCompanies(publicCompany ? [publicCompany] : []);
      setSuggestedCompanies(suggestions);
      setHistory(EMPTY_HISTORY);
      setLoading(false);
    };

    const token = getAccessToken();
    if (!token) {
      void loadPublicCompany(true);
      return () => {
        ignore = true;
      };
    }

    setIsPublicView(false);
    setIsGuestView(false);
    const cachedCompanies = getCachedTwaWallet().companies;
    if (cachedCompanies.length) {
      setCompanies(cachedCompanies);
      setLoading(false);
    }

    void Promise.all([getTwaWallet(true), getTwaHistory()] as const).then(async ([apiWallet, apiHistory]) => {
      if (ignore) return;
      const apiCompanies = apiWallet.companies;
      const matchedCompany = apiCompanies.find((item) => String(item.id) === id || item.slug === id);
      if (!matchedCompany) {
        await loadPublicCompany(false);
        return;
      }
      setIsPublicView(false);
      setIsGuestView(false);
      setSuggestedCompanies([]);
      setCompanies(apiCompanies);
      setHistory(apiHistory);
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    setLargeFavoriteHidden(false);
    setFavoriteFlight(null);
    setFavoritePulse(0);
  }, [id]);

  const company = useMemo(
    () => companies.find((item) => String(item.id) === id || item.slug === id) ?? null,
    [companies, id],
  );
  const companySlug = company?.slug ?? null;

  useEffect(() => {
    if (company && id !== company.slug) {
      router.replace(`/wallet/${company.slug}`);
    }
  }, [company, id, router]);

  useEffect(() => {
    let ignore = false;
    if (!companySlug) {
      setPublicMedia(null);
      return;
    }

    void fetch(`/api/public/company-media/${encodeURIComponent(companySlug)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: PublicCompanyMediaState | null) => {
        if (!ignore) setPublicMedia(payload);
      })
      .catch(() => {
        if (!ignore) setPublicMedia(null);
      });

    return () => {
      ignore = true;
    };
  }, [companySlug]);

  const mainLocation = useMemo(
    () => company?.locations.find((location) => location.isMain) ?? company?.locations[0] ?? null,
    [company],
  );

  const operations = useMemo(
    () => (company ? operationsForCompany(history, company, locale) : []),
    [company, history, locale],
  );
  const galleryItems = useMemo<GalleryItem[]>(() => {
    const uploaded = publicMedia?.media.gallery.filter((asset) => Boolean(asset.url)).slice(0, 10) ?? [];
    if (!uploaded.length) {
      const placeholderImages = [
        COMPANY_PLACEHOLDER_ASSETS.gallery,
        COMPANY_PLACEHOLDER_ASSETS.galleryAlt,
        COMPANY_PLACEHOLDER_ASSETS.galleryExtra,
      ];
      return PUBLIC_GALLERY_ITEMS.map((item, index) => ({
        ...item,
        title: ["Атмосфера компании", "Команда и сервис", "Продукты и детали"][index % 3],
        caption: "фото появится после загрузки",
        image: placeholderImages[index % placeholderImages.length],
        position: "center",
      }));
    }
    return uploaded.map((asset, index) => ({
      title: asset.title?.trim() || `Фото ${index + 1}`,
      caption: asset.description?.trim() || "атмосфера компании",
      image: asset.url!,
      className: index === 0 || index === 5 ? "col-span-2 h-36" : "h-32",
      position: "center",
    }));
  }, [publicMedia]);

  if (loading && companies.length === 0) {
    return <TwaLoadingScreen title={t("client.wallet.loadingTitle")} subtitle={t("client.wallet.loadingSubtitle")} />;
  }

  if (!company) {
    const notFoundCopy =
      locale === "en"
        ? {
            eyebrow: "Company card",
            title: "Company does not exist",
            description: "We could not find this loyalty card. The link may be outdated or the company is not active yet.",
            slugLabel: "Requested address",
            suggestionsTitle: "Try these companies",
            suggestionsText: "Active partners with public loyalty cards are available below.",
            emptySuggestions: "No active partner suggestions yet.",
            allPartners: "All partners",
            home: "Home",
          }
        : {
            eyebrow: "Карточка компании",
            title: "Компания не существует",
            description: "Мы не нашли такую карту лояльности. Возможно, ссылка устарела или компания ещё не активировала профиль.",
            slugLabel: "Запрошенный адрес",
            suggestionsTitle: "Попробуйте другие компании",
            suggestionsText: "Вот активные партнёры, карточки которых уже доступны в NearLoy.",
            emptySuggestions: "Пока нет активных партнёров для рекомендации.",
            allPartners: "Все партнёры",
            home: "На главную",
          };

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-full px-5 py-10 pb-28"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(36,196,212,0.22),transparent_34%),linear-gradient(145deg,rgba(13,21,33,0.96),rgba(5,8,14,0.98))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              {notFoundCopy.eyebrow}
            </div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">{notFoundCopy.title}</h1>
                <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{notFoundCopy.description}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">
                <p className="mb-1 text-xs uppercase tracking-[0.22em] text-cyan-100/70">{notFoundCopy.slugLabel}</p>
                <p className="break-all font-mono text-white">/wallet/{id || "—"}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="rounded-2xl">
                <Link href="/companies">
                  <Compass className="mr-2 h-4 w-4" />
                  {notFoundCopy.allPartners}
                </Link>
              </Button>
              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href={isPublicView ? "/" : "/app"}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {notFoundCopy.home}
                </Link>
              </Button>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-white/10 bg-card/80 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">{notFoundCopy.suggestionsTitle}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{notFoundCopy.suggestionsText}</p>
              </div>
              <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3 text-cyan-100">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            {suggestedCompanies.length ? (
              <div className="grid gap-3">
                {suggestedCompanies.map((suggestion) => {
                  const suggestionCategories = [suggestion.category, ...suggestion.categories].filter(Boolean);
                  const primaryCategory = suggestionCategories[0] ?? suggestion.category;
                  return (
                    <Link
                      key={suggestion.slug}
                      href={`/wallet/${suggestion.slug}`}
                      className="group flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-200/35 hover:bg-cyan-200/[0.06]"
                    >
                      <div
                        className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-cyan-200/20 bg-cyan-300/10 bg-cover bg-center"
                        style={suggestion.logoUrl ? { backgroundImage: `url("${suggestion.logoUrl}")` } : undefined}
                        aria-label={suggestion.logoUrl ? suggestion.name : undefined}
                      >
                        {!suggestion.logoUrl && (
                          <CategoryIcon iconName={primaryCategory?.icon ?? "Building2"} className="h-6 w-6 text-cyan-100" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-lg font-black text-white">{suggestion.name}</h3>
                        <p className="truncate text-sm text-muted-foreground">
                          {categoryName(primaryCategory, t)}
                          {suggestion.locations[0]?.city ? ` · ${suggestion.locations[0].city}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-cyan-100" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-5 text-sm text-muted-foreground">
                {notFoundCopy.emptySuggestions}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    );
  }

  const categories = [company.category, ...company.categories].filter(Boolean);
  const isOpen = mainLocation ? isLocationOpenNow(mainLocation) : true;
  const statusOpenTime = formatTime(mainLocation?.openTime);
  const statusCloseTime = formatTime(mainLocation?.closeTime);
  const currentLevel = companyLevelName(company.level.current?.levelName, locale, t("client.common.member"));
  const nextLevel = companyLevelName(company.level.next?.levelName, locale, locale === "ru" ? "Премиум" : "Premium");
  const pointsToNextLevel = company.level.next?.pointsToNext ?? 0;
  const levelProgress = Math.max(0, Math.min(100, company.level.progressPercent));
  const levels = [...company.level.ladder].sort((left, right) => left.sortOrder - right.sortOrder);
  const routeLocations = company.locations.filter(
    (location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );
  const hasRouteLocations = routeLocations.length > 0;
  const hasMultipleRouteLocations = routeLocations.length > 1;
  const showLargeFavoriteButton = !isPublicView && !company.isFavorite && !largeFavoriteHidden;
  const hasActionButtons = !isPublicView && (hasRouteLocations || showLargeFavoriteButton);
  const actionGridClass = hasRouteLocations && showLargeFavoriteButton ? "grid-cols-2" : "grid-cols-1";
  const publicCompanyPath = `/wallet/${company.slug}`;
  const publicCompanyUrl =
    typeof window === "undefined" ? publicCompanyPath : new URL(publicCompanyPath, window.location.origin).toString();
  const shareText = `${company.name} в NearLoy — бонусы, уровни и награды в одной карточке.`;
  const vkShareUrl = `https://vk.com/share.php?url=${encodeURIComponent(publicCompanyUrl)}&title=${encodeURIComponent(company.name)}&description=${encodeURIComponent(shareText)}`;
  const heroImage = publicMedia?.media.hero?.url ?? COMPANY_PLACEHOLDER_ASSETS.hero;
  const logoImage = publicMedia?.media.logo?.url ?? COMPANY_PLACEHOLDER_ASSETS.logo;
  const activeOffer = publicMedia?.offers[0] ?? null;
  const offerTitle = activeOffer?.title ?? "Акции скоро появятся";
  const offerDescription = activeOffer?.description ?? "Компания готовит специальные предложения для клиентов NearLoy.";
  const offerCode = activeOffer?.code ?? null;
  const offerImage = activeOffer?.imageUrl ?? COMPANY_PLACEHOLDER_ASSETS.offer;

  const handleNativeShare = async () => {
    if (typeof navigator === "undefined" || !("share" in navigator)) {
      return false;
    }
    await navigator.share({
      title: company.name,
      text: shareText,
      url: publicCompanyUrl,
    });
    return true;
  };

  const handleCopyShareLink = async () => {
    await navigator.clipboard?.writeText(publicCompanyUrl).catch(() => undefined);
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  };

  const startFavoriteFlight = () => {
    const sourceRect = largeFavoriteButtonRef.current?.getBoundingClientRect();
    const targetRect = headerFavoriteButtonRef.current?.getBoundingClientRect();
    if (!sourceRect || !targetRect) {
      setFavoritePulse((current) => current + 1);
      return;
    }

    setFavoriteFlight({
      id: Date.now(),
      fromX: sourceRect.left + sourceRect.width / 2,
      fromY: sourceRect.top + sourceRect.height / 2,
      toX: targetRect.left + targetRect.width / 2,
      toY: targetRect.top + targetRect.height / 2,
    });
    window.setTimeout(() => {
      setFavoriteFlight(null);
      setFavoritePulse((current) => current + 1);
    }, 760);
  };

  const handleFavoriteToggle = async (source: "header" | "large" = "header") => {
    if (favoriteSaving) return;
    const nextFavorite = !company.isFavorite;
    setFavoriteSaving(true);
    setLargeFavoriteHidden(true);
    if (source === "large" && nextFavorite) {
      startFavoriteFlight();
    }
    setCompanies((current) =>
      current.map((item) =>
        item.id === company.id
          ? {
              ...item,
              isFavorite: nextFavorite,
              favoritedAt: nextFavorite ? new Date().toISOString() : null,
            }
          : item,
      ),
    );

    const result = await setTwaCompanyFavorite(company.id, nextFavorite);
    setFavoriteSaving(false);
    if (!result.ok) {
      if (nextFavorite) {
        setLargeFavoriteHidden(false);
      }
      if (source === "large" && nextFavorite) {
        setFavoriteFlight(null);
      }
      setCompanies((current) =>
        current.map((item) =>
          item.id === company.id
            ? {
                ...item,
                isFavorite: !nextFavorite,
                favoritedAt: company.favoritedAt,
              }
            : item,
        ),
      );
      return;
    }
    setCompanies((current) =>
      current.map((item) =>
        item.id === company.id
          ? {
              ...item,
              isFavorite: result.data.isFavorite,
              favoritedAt: result.data.favoritedAt,
            }
          : item,
      ),
    );
    if (nextFavorite && source !== "large") {
      setFavoritePulse((current) => current + 1);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="mx-auto min-h-full w-full max-w-[430px] overflow-hidden bg-[#03060a] pb-8 text-white"
    >
      <AnimatePresence>
        {favoriteFlight && (
          <motion.div
            key={favoriteFlight.id}
            initial={{ opacity: 0, scale: 0.55, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0.55, 1.08, 0.82, 0.34],
              x: favoriteFlight.toX - favoriteFlight.fromX,
              y: favoriteFlight.toY - favoriteFlight.fromY,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.76, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed z-[80] flex h-11 w-11 items-center justify-center rounded-full border border-violet-200/40 bg-violet-500/85 text-white shadow-[0_18px_46px_rgba(139,92,246,0.45)]"
            style={{ left: favoriteFlight.fromX - 22, top: favoriteFlight.fromY - 22 }}
          >
            <Heart className="h-5 w-5 fill-white" />
          </motion.div>
        )}
      </AnimatePresence>

      <section className="relative h-[250px] overflow-hidden">
        <img
          src={heroImage}
          alt={company.name}
          onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.hero)}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.24)_38%,rgba(3,6,10,0.92)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_10%,rgba(255,180,85,0.2),transparent_32%),radial-gradient(circle_at_8%_100%,rgba(124,58,237,0.18),transparent_34%)]" />

        {!isPublicView && (
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 pt-4">
          <Link
            href="/app"
            aria-label={t("client.common.back")}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/55 text-white shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Поделиться"
              className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-950/55 text-white shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-white/10"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <motion.button
              type="button"
              ref={headerFavoriteButtonRef}
              onClick={() => handleFavoriteToggle("header")}
              disabled={favoriteSaving}
              aria-pressed={company.isFavorite}
              aria-label={company.isFavorite ? "Убрать из избранного" : "В избранное"}
              animate={favoritePulse > 0 ? { scale: [1, 1.16, 0.96, 1] } : { scale: 1 }}
              transition={{ duration: 0.44, ease: "easeOut" }}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center overflow-visible rounded-full border text-white shadow-[0_18px_44px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-white/10",
                company.isFavorite ? "border-violet-300/35 bg-violet-500/28" : "border-white/10 bg-slate-950/55",
                favoriteSaving && "opacity-70",
              )}
            >
              <AnimatePresence>
                {favoritePulse > 0 && company.isFavorite && (
                  <motion.span
                    key={favoritePulse}
                    initial={{ opacity: 0.7, scale: 0.7 }}
                    animate={{ opacity: 0, scale: 1.8 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.62, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full border border-violet-200/70"
                  />
                )}
              </AnimatePresence>
              <motion.span
                key={`heart-${favoritePulse}`}
                animate={favoritePulse > 0 ? { rotate: [0, -10, 8, 0], scale: [1, 1.18, 1] } : undefined}
                transition={{ duration: 0.42, ease: "easeOut" }}
              >
                <Heart className={cn("h-5 w-5", company.isFavorite && "fill-white")} />
              </motion.span>
            </motion.button>
          </div>
        </div>
        )}

        <div className="absolute inset-x-0 bottom-3 z-10 px-4">
          <div className="flex items-end gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-amber-200/35 bg-[radial-gradient(circle_at_22%_12%,rgba(255,255,255,0.22),transparent_28%),linear-gradient(135deg,rgba(115,64,25,0.92),rgba(34,18,9,0.96))] shadow-[0_22px_52px_rgba(0,0,0,0.55)]">
              {logoImage ? (
                <img
                  src={logoImage}
                  alt={company.name}
                  className="h-full w-full object-cover"
                  onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.logo)}
                />
              ) : (
                <div className="text-[46px] font-black leading-none tracking-[-0.08em] text-white">
                  {company.name.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <h1 className="line-clamp-2 text-[26px] font-black leading-[0.98] tracking-[-0.05em] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.8)]">
                {company.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-white/78">
                {categories.slice(0, 2).map((category) => (
                  <span
                    key={category.slug}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/8 bg-slate-950/62 px-2 py-0.5 text-xs backdrop-blur-xl"
                  >
                    <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3.5 w-3.5 text-cyan-100" />
                    {categoryName(category, t)}
                  </span>
                ))}
                {mainLocation && (
                  <span className="inline-flex items-center gap-1 rounded-xl border border-violet-300/20 bg-slate-950/62 px-2 py-0.5 text-xs text-violet-200 backdrop-blur-xl">
                    <MapPin className="h-3.5 w-3.5" />
                    {mainLocation.city ?? "рядом"}
                  </span>
                )}
                {mainLocation && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-xl border bg-slate-950/62 px-2 py-0.5 text-xs font-medium backdrop-blur-xl",
                      isOpen
                        ? "border-emerald-300/25 text-emerald-300"
                        : "border-red-300/25 text-red-300",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", isOpen ? "bg-emerald-300" : "bg-red-300")} />
                    {isOpen ? `Открыто до ${statusCloseTime}` : `Закрыто · откроется в ${statusOpenTime}`}
                  </span>
                )}
                {!mainLocation && (
                  <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-300/25 bg-slate-950/62 px-2 py-0.5 text-xs font-medium text-emerald-300 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    Открыто до {statusCloseTime}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-5 px-4 pt-5">
        {isPublicView ? (
          <>
            {isGuestView && (
              <motion.section
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_88%_0%,rgba(168,85,247,0.10),transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.82),rgba(2,6,23,0.92))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/16 bg-cyan-300/10 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]">
                  <Sparkles className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0">
                  <p className="max-w-[310px] text-base font-semibold leading-snug tracking-[-0.02em] text-white">
                    Эти и другие потрясающие компании доступны в NearLoy!
                  </p>
                  <p className="mt-2 max-w-[330px] text-sm leading-relaxed text-white/58">
                    В приложении можно копить баллы, открывать уровни, получать награды и хранить любимые места в одной карте.
                  </p>
                  <Button asChild className="mt-4 h-10 rounded-2xl bg-white/92 px-4 text-sm font-semibold text-slate-950 shadow-[0_10px_24px_rgba(255,255,255,0.08)] hover:bg-white">
                    <Link href={`/register?next=${encodeURIComponent(publicCompanyPath)}`}>
                      Создать аккаунт
                      <ChevronRight className="h-4 w-4" strokeWidth={1.9} />
                    </Link>
                  </Button>
                </div>
              </div>
              </motion.section>
            )}

            {Boolean(publicMedia?.socialLinks?.length) && (
              <motion.section
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.07 }}
                className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(3,7,18,0.86))] p-4"
              >
                <h2 className="text-lg font-black tracking-[-0.04em]">Где ещё найти компанию</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {publicMedia?.socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition hover:border-cyan-200/30 hover:bg-cyan-300/10"
                    >
                      {link.kind !== "OTHER" && (
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-cyan-200/18 bg-cyan-300/10 text-cyan-100">
                          <PublicSocialIcon kind={link.kind} />
                        </span>
                      )}
                      <span className="max-w-[150px] truncate">{link.title}</span>
                    </a>
                  ))}
                </div>
              </motion.section>
            )}

            <Dialog
              open={Boolean(selectedGalleryItem)}
              onOpenChange={(open) => {
                if (!open) setSelectedGalleryItem(null);
              }}
            >
              <DialogContent className="w-[calc(100vw-1rem)] max-w-[920px] overflow-hidden border-white/10 bg-[#03060a] p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.72)]">
                {selectedGalleryItem && (
                  <>
                    <div className="relative max-h-[78dvh] min-h-[420px] overflow-hidden bg-black">
                      <img
                        src={selectedGalleryItem.image}
                        alt={selectedGalleryItem.title}
                        className="h-full max-h-[78dvh] min-h-[420px] w-full object-contain"
                        onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.gallery)}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/82 via-black/24 to-transparent p-5 pt-20">
                        <DialogTitle className="text-2xl font-black tracking-[-0.05em] text-white">
                          {selectedGalleryItem.title}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-sm text-white/64">
                          {selectedGalleryItem.caption}
                        </DialogDescription>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>

            <motion.section
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.08 }}
            >
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-[-0.04em]">Галерея</h2>
                  <p className="mt-1 text-sm text-white/52">Посмотрите атмосферу, детали и то, что ждёт гостей внутри.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {galleryItems.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.title}-${index}`}
                    onClick={() => setSelectedGalleryItem(item)}
                    className={cn(
                      "group relative overflow-hidden rounded-[22px] border border-white/10 bg-slate-950 text-left shadow-[0_18px_44px_rgba(0,0,0,0.32)] outline-none transition duration-200 hover:border-cyan-200/30 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-cyan-200/70",
                      item.className,
                    )}
                  >
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.gallery)}
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ objectPosition: item.position }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.02)_0%,rgba(0,0,0,0.22)_44%,rgba(3,6,10,0.84)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(168,85,247,0.22),transparent_34%)]" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-1 text-sm font-black tracking-[-0.03em] text-white">{item.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/58">{item.caption}</p>
                    </div>
                    <span className="absolute right-3 top-3 rounded-full border border-white/12 bg-black/45 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/72 opacity-0 backdrop-blur transition group-hover:opacity-100">
                      Посмотреть
                    </span>
                  </button>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.09 }}
              className="relative overflow-hidden rounded-[28px] border border-fuchsia-300/16 bg-[radial-gradient(circle_at_12%_12%,rgba(217,70,239,0.36),transparent_32%),radial-gradient(circle_at_92%_20%,rgba(251,191,36,0.24),transparent_30%),linear-gradient(135deg,rgba(18,9,32,0.96),rgba(3,7,18,0.94))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
            >
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-fuchsia-500/18 blur-3xl" />
              <div className="absolute -bottom-12 left-2 h-32 w-32 rounded-full bg-amber-400/14 blur-3xl" />
              <div className="relative">
                <p className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-100">
                  <TicketPercent className="h-4 w-4" />
                  Акция
                </p>
                <div className="mt-4 grid grid-cols-[1fr_116px] items-stretch gap-3">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-black leading-[0.98] tracking-[-0.06em] text-white">
                      {offerTitle}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/62">
                      {offerDescription}
                    </p>
                    {offerCode && (
                      <div className="mt-4 inline-flex items-center gap-2 rounded-[18px] border border-fuchsia-200/24 bg-fuchsia-500/14 px-4 py-2 shadow-[0_0_28px_rgba(217,70,239,0.16)]">
                        <Sparkles className="h-4 w-4 text-fuchsia-100" />
                        <span className="font-mono text-lg font-black tracking-[0.18em] text-white">{offerCode}</span>
                      </div>
                    )}
                  </div>
                  <div className="relative overflow-hidden rounded-[24px] border border-white/12 bg-black/32">
                    <img
                      src={offerImage}
                      alt={offerTitle}
                      loading="lazy"
                      onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.offer)}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.62))]" />
                    <div className="absolute bottom-3 right-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
                      <span className="text-lg font-black">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>

            <Dialog>
              <motion.section
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(3,7,18,0.88))] p-4"
              >
                <div>
                  <p className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/18 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-amber-100">
                    <Award className="h-4 w-4" />
                    Уровни компании
                  </p>
                  <h2 className="mt-3 text-xl font-black tracking-[-0.04em]">
                    Что можно открыть у {company.name}
                  </h2>
                  <p className="mt-1 text-sm text-white/56">
                    Посмотрите статусы компании и преимущества, которые открываются по мере роста вашей активности.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-white/8 bg-slate-950/44 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-500/12 text-amber-100">
                    <Award className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-white">
                    {levels.length > 0 ? `Доступно ${levels.length} уровней` : "Уровни пока не настроены"}
                  </p>
                </div>

                <DialogTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Посмотреть уровни компании ${company.name}`}
                    className="relative z-20 mt-4 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 shadow-[0_14px_34px_rgba(255,255,255,0.10)] transition hover:-translate-y-0.5 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 active:translate-y-0"
                  >
                    Посмотреть уровни компании
                    <ChevronRight className="h-4 w-4" strokeWidth={2} />
                  </button>
                </DialogTrigger>
              </motion.section>

              <DialogContent className="max-h-[82vh] overflow-hidden border-white/10 bg-[#070b12] p-0 text-white">
                <DialogHeader className="border-b border-white/8 px-5 py-4 text-left">
                  <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.04em]">
                    <Award className="h-5 w-5 text-amber-200" />
                    Уровни компании
                  </DialogTitle>
                  <DialogDescription className="text-sm text-white/58">
                    Все доступные уровни, порог баллов и кешбэк в {company.name}.
                  </DialogDescription>
                </DialogHeader>
                <div className="nearloy-scrollbar max-h-[60vh] space-y-2 overflow-y-auto px-5 pb-5 pt-1">
                  {levels.length > 0 ? levels.map((level) => {
                    const isCurrent = company.level.current?.id === level.id;
                    const isNext = company.level.next?.id === level.id;
                    return (
                      <div
                        key={level.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3",
                          isCurrent ? "border-amber-200/35 bg-amber-500/12" : "border-white/8 bg-slate-950/40",
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-white">{companyLevelName(level.levelName, locale)}</p>
                          <p className="mt-1 text-sm text-white/55">от {level.minTotalSpend} баллов</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-base font-black text-amber-100">{level.cashbackPercent}%</p>
                          <p className="mt-1 text-xs text-white/45">
                            {isCurrent ? "текущий" : isNext ? "следующий" : "уровень"}
                          </p>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-[20px] border border-white/8 bg-slate-950/40 px-4 py-5 text-sm text-white/56">
                      Уровни компании пока не настроены.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
        <motion.section
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.92),rgba(3,7,18,0.88))] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.38)]"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-white/70">Ваш баланс</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-[42px] font-black leading-[0.82] tracking-[-0.06em]">{company.points.balance}</span>
                  <span className="pb-0.5 text-sm text-white/78">баллов</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/12 px-3 py-1.5 text-sm text-violet-200">
                  <Star className="h-4 w-4 fill-violet-300 text-violet-300" />
                  {currentLevel}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="min-w-[116px] rounded-[18px] border border-white/8 bg-slate-950/45 px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Дальше</p>
                  <p className="mt-1 truncate text-sm font-bold text-white/86">{company.level.next ? nextLevel : "Максимум"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLevelsOpen(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl border border-amber-200/20 bg-amber-500/10 px-3 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/16"
                >
                  <Award className="h-4 w-4" />
                  Все уровни
                </button>
              </div>
            </div>

            <div className="rounded-[18px] border border-white/8 bg-slate-950/45 p-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-white/58">До следующего уровня</p>
                  <p className="mt-1 truncate text-sm text-white/84">
                    {company.level.next ? `${currentLevel} → ${nextLevel}` : "Вы на максимальном уровне"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-black leading-none tracking-[-0.04em]">{pointsToNextLevel}</p>
                  <p className="mt-0.5 text-[11px] leading-none text-white/58">баллов</p>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500"
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-white/62">
                <span className="font-bold text-amber-200">{company.level.totalSpentPoints}</span>
                {company.level.next ? ` / ${company.level.next.minTotalSpend} баллов` : " баллов на текущем уровне"}
              </p>
            </div>
          </div>
        </motion.section>

        {hasActionButtons && (
          <motion.section
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 }}
            className={cn("grid gap-3", actionGridClass)}
          >
            {hasRouteLocations && (
              hasMultipleRouteLocations ? (
                <Button
                  type="button"
                  onClick={() => setLocationsOpen(true)}
                  className="h-12 rounded-2xl border border-white/10 bg-slate-950/82 text-xs font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)] hover:bg-white/10"
                >
                  <Route className="mr-2 h-4 w-4" />
                  Выбрать адрес
                </Button>
              ) : (
                <Button asChild className="h-12 rounded-2xl border border-white/10 bg-slate-950/82 text-xs font-semibold text-white shadow-[0_14px_34px_rgba(0,0,0,0.35)] hover:bg-white/10">
                  <a href={routeHref(routeLocations[0])} target="_blank" rel="noreferrer">
                    <Route className="mr-2 h-4 w-4" />
                    Построить маршрут
                  </a>
                </Button>
              )
            )}
            <AnimatePresence initial={false}>
              {showLargeFavoriteButton && (
                <motion.div
                  key="favorite-large-cta"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.82, y: -10, filter: "blur(6px)" }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  <Button
                    ref={largeFavoriteButtonRef}
                    type="button"
                    onClick={() => handleFavoriteToggle("large")}
                    disabled={favoriteSaving}
                    aria-pressed={company.isFavorite}
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 text-xs font-semibold text-white shadow-[0_14px_34px_rgba(88,28,135,0.35)] hover:from-violet-500 hover:to-purple-600"
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    В избранное
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        )}

        <Dialog open={levelsOpen} onOpenChange={setLevelsOpen}>
          <DialogContent className="max-h-[82vh] overflow-hidden border-white/10 bg-[#070b12] p-0 text-white">
            <DialogHeader className="border-b border-white/8 px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.04em]">
                <Award className="h-5 w-5 text-amber-200" />
                Уровни компании
              </DialogTitle>
              <DialogDescription className="text-sm text-white/58">
                Все доступные уровни, порог баллов и кешбэк в {company.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="nearloy-scrollbar max-h-[60vh] space-y-2 overflow-y-auto px-5 pb-5 pt-1">
              {levels.length > 0 ? levels.map((level) => {
                const isCurrent = company.level.current?.id === level.id;
                const isNext = company.level.next?.id === level.id;
                return (
                  <div
                    key={level.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3",
                      isCurrent ? "border-amber-200/35 bg-amber-500/12" : "border-white/8 bg-slate-950/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-white">{companyLevelName(level.levelName, locale)}</p>
                      <p className="mt-1 text-sm text-white/55">от {level.minTotalSpend} баллов</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-black text-amber-100">{level.cashbackPercent}%</p>
                      <p className="mt-1 text-xs text-white/45">
                        {isCurrent ? "текущий" : isNext ? "следующий" : "уровень"}
                      </p>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-[20px] border border-white/8 bg-slate-950/40 px-4 py-5 text-sm text-white/56">
                  Уровни компании пока не настроены.
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="overflow-hidden border-white/10 bg-[#070b12] p-0 text-white">
            <DialogHeader className="border-b border-white/8 px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.04em]">
                <Share2 className="h-5 w-5 text-violet-200" />
                Поделиться компанией
              </DialogTitle>
              <DialogDescription className="text-sm text-white/58">
                Отправьте клиентам красивую ссылку на карту лояльности {company.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-5 pb-5 pt-4">
              <div className="overflow-hidden rounded-[24px] border border-violet-200/16 bg-[radial-gradient(circle_at_12%_0%,rgba(168,85,247,0.34),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.94),rgba(3,7,18,0.96))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-amber-200/30 bg-[linear-gradient(135deg,rgba(115,64,25,0.95),rgba(34,18,9,0.98))] text-3xl font-black text-white">
                    {logoImage ? (
                      <img
                        src={logoImage}
                        alt={company.name}
                        className="h-full w-full object-cover"
                        onError={(event) => replaceBrokenImage(event, COMPANY_PLACEHOLDER_ASSETS.logo)}
                      />
                    ) : (
                      company.name.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-black tracking-[-0.04em]">{company.name}</p>
                    <p className="mt-1 truncate text-xs text-violet-100/68">{publicCompanyUrl}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/70">{shareText}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={() => void handleNativeShare().catch(() => undefined)}
                  className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-white/90"
                >
                  <Share2 className="h-4 w-4" />
                  Поделиться
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCopyShareLink()}
                  className="h-12 rounded-2xl"
                >
                  {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {shareCopied ? "Скопировано" : "Копировать"}
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(publicCompanyUrl)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-semibold text-white/86 transition hover:bg-white/8"
                >
                  <Send className="h-4 w-4 text-cyan-200" />
                  Telegram
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${publicCompanyUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-semibold text-white/86 transition hover:bg-white/8"
                >
                  <Share2 className="h-4 w-4 text-emerald-200" />
                  WhatsApp
                </a>
                <a
                  href={vkShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 text-sm font-semibold text-white/86 transition hover:bg-white/8"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-[#0077ff] text-[10px] font-black leading-none text-white">
                    VK
                  </span>
                  VK
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={locationsOpen} onOpenChange={setLocationsOpen}>
          <DialogContent className="max-h-[82vh] overflow-hidden border-white/10 bg-[#070b12] p-0 text-white">
            <DialogHeader className="border-b border-white/8 px-5 py-4 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black tracking-[-0.04em]">
                <Route className="h-5 w-5 text-cyan-100" />
                Куда построить маршрут
              </DialogTitle>
              <DialogDescription className="text-sm text-white/58">
                Выберите удобную точку {company.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="nearloy-scrollbar max-h-[60vh] space-y-2 overflow-y-auto px-5 pb-5 pt-1">
              {routeLocations.map((location) => (
                <a
                  key={location.uuid}
                  href={routeHref(location)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setLocationsOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-slate-950/40 px-4 py-3 transition hover:border-cyan-200/30 hover:bg-cyan-500/8"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/12 text-cyan-100">
                      <MapPin className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">
                        {location.title || location.address || location.city || "Точка на карте"}
                      </span>
                      <span className="mt-1 block truncate text-xs text-white/52">
                        {[location.address, location.city].filter(Boolean).join(" · ") || "Открыть в Яндекс Картах"}
                      </span>
                    </span>
                  </span>
                  <Navigation className="h-4 w-4 shrink-0 text-white/55" />
                </a>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <motion.section initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.14 }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-[-0.04em]">Последние операции</h2>
            <Link href="/history" className="inline-flex items-center gap-1 text-sm font-medium text-violet-300">
              Все операции
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.9),rgba(3,7,18,0.88))]">
            {operations.length > 0 ? (
              operations.map((operation, index) => {
                const Icon = operation.icon;
                const positive = operation.amount >= 0;
                return (
                  <div
                    key={operation.id}
                    className={cn(
                      "grid grid-cols-[58px_40px_minmax(0,1fr)_64px] items-center gap-3 px-4 py-3",
                      index > 0 && "border-t border-white/8",
                    )}
                  >
                    <div className={cn("text-base font-black", positive ? "text-violet-300" : "text-amber-300")}>
                      {positive ? "+" : ""}
                      {operation.amount}
                      <p className="mt-0.5 text-xs font-normal text-white/58">баллов</p>
                    </div>
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", operation.tone === "amber" ? "bg-amber-500/18 text-amber-300" : "bg-violet-500/18 text-violet-300")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{operation.title}</p>
                      <p className="truncate text-xs text-white/55">{operation.subtitle}</p>
                    </div>
                    <p className="text-right text-xs leading-relaxed text-white/54">{operation.time}</p>
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-6 text-sm text-white/55">Операций по этой компании пока нет.</div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="rounded-[22px] border border-violet-300/15 bg-[radial-gradient(circle_at_7%_45%,rgba(124,58,237,0.36),transparent_22%),linear-gradient(135deg,rgba(35,15,70,0.9),rgba(8,8,18,0.9))] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
        >
          <div className="grid grid-cols-[56px_1fr] items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-violet-500/20 text-violet-200">
              <TicketPercent className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-black leading-tight tracking-[-0.04em]">{offerTitle}</h3>
              <p className="mt-1 text-sm leading-snug text-white/62">{offerDescription}</p>
            </div>
            <Button className="col-span-2 h-11 rounded-2xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-500">
              {offerCode || "Подробнее"}
            </Button>
          </div>
        </motion.section>

          </>
        )}
      </div>
    </motion.main>
  );
}
