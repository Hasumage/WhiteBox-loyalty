"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ArrowLeft, Bus, Car, ChevronRight, Crosshair, Filter, Footprints, LocateFixed, MapPin, Maximize2, Route, Search, X } from "lucide-react";
import { getActiveTwaSubscriptions, getCachedActiveTwaSubscriptions, getCachedTwaMapCompanies, getTwaMapCompanies, type TwaCompany, type TwaUserSubscription } from "@/lib/api/twa-client";
import { CLIENT_BOOTSTRAP_TIMEOUT_MS, promiseWithTimeout } from "@/lib/api/fetch-timeout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { interpolate } from "@/lib/i18n/format";
import type { TranslateFn } from "@/lib/i18n/format";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";
import { getGeolocationPosition } from "@/lib/capacitor/native-permissions";

const YANDEX_MAPS_SCRIPT_ID = "yandex-maps-js-api-v3";
const YANDEX_MAPS_LOAD_TIMEOUT_MS = 12_000;
const YANDEX_MAP_CENTER: [number, number] = [37.6176, 55.7558];
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];
const CITY_CLUSTER_MAX_ZOOM = 8.8;
const CITY_CLUSTER_ZOOM_IN = 11.2;

type CityClusterDefinition = {
  id: string;
  name: string;
  aliases: string[];
  center: [number, number];
  radiusKm: number;
  landmark: string;
  image: string;
  background: string;
};

const CITY_CLUSTERS: CityClusterDefinition[] = [
  {
    id: "moscow",
    name: "\u041c\u043e\u0441\u043a\u0432\u0430",
    aliases: ["moscow", "\u043c\u043e\u0441\u043a\u0432\u0430"],
    center: [37.6176, 55.7558],
    radiusKm: 85,
    landmark: "\u041a\u0440\u0435\u043c\u043b\u044c",
    image: "/city-clusters/moscow.webp",
    background: "radial-gradient(circle at 28% 22%, rgba(248,113,113,.92), transparent 30%), linear-gradient(135deg, rgba(127,29,29,.95), rgba(15,23,42,.96))",
  },
  {
    id: "saint-petersburg",
    name: "\u0421\u0430\u043d\u043a\u0442-\u041f\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433",
    aliases: ["saint petersburg", "st petersburg", "spb", "\u0441\u0430\u043d\u043a\u0442-\u043f\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433", "\u043f\u0435\u0442\u0435\u0440\u0431\u0443\u0440\u0433", "\u0441\u043f\u0431"],
    center: [30.3159, 59.9391],
    radiusKm: 70,
    landmark: "\u0418\u0441\u0430\u0430\u043a\u0438\u0439",
    image: "/city-clusters/saint-petersburg.webp",
    background: "radial-gradient(circle at 30% 20%, rgba(125,211,252,.85), transparent 34%), linear-gradient(135deg, rgba(30,64,175,.9), rgba(15,23,42,.96))",
  },
  {
    id: "novosibirsk",
    name: "\u041d\u043e\u0432\u043e\u0441\u0438\u0431\u0438\u0440\u0441\u043a",
    aliases: ["novosibirsk", "\u043d\u043e\u0432\u043e\u0441\u0438\u0431\u0438\u0440\u0441\u043a"],
    center: [82.9204, 55.0302],
    radiusKm: 65,
    landmark: "\u041e\u043f\u0435\u0440\u043d\u044b\u0439",
    image: "/city-clusters/novosibirsk.webp",
    background: "radial-gradient(circle at 26% 22%, rgba(96,165,250,.86), transparent 34%), linear-gradient(135deg, rgba(30,41,59,.94), rgba(2,44,34,.95))",
  },
  {
    id: "yekaterinburg",
    name: "\u0415\u043a\u0430\u0442\u0435\u0440\u0438\u043d\u0431\u0443\u0440\u0433",
    aliases: ["yekaterinburg", "ekaterinburg", "\u0435\u043a\u0430\u0442\u0435\u0440\u0438\u043d\u0431\u0443\u0440\u0433"],
    center: [60.6057, 56.8389],
    radiusKm: 60,
    landmark: "\u0412\u044b\u0441\u043e\u0446\u043a\u0438\u0439",
    image: "/city-clusters/yekaterinburg.webp",
    background: "radial-gradient(circle at 30% 18%, rgba(251,191,36,.86), transparent 34%), linear-gradient(135deg, rgba(120,53,15,.9), rgba(15,23,42,.96))",
  },
  {
    id: "kazan",
    name: "\u041a\u0430\u0437\u0430\u043d\u044c",
    aliases: ["kazan", "\u043a\u0430\u0437\u0430\u043d\u044c"],
    center: [49.1064, 55.7961],
    radiusKm: 62,
    landmark: "\u041a\u0440\u0435\u043c\u043b\u044c",
    image: "/city-clusters/kazan.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(52,211,153,.86), transparent 34%), linear-gradient(135deg, rgba(6,95,70,.92), rgba(15,23,42,.96))",
  },
  {
    id: "krasnoyarsk",
    name: "\u041a\u0440\u0430\u0441\u043d\u043e\u044f\u0440\u0441\u043a",
    aliases: ["krasnoyarsk", "\u043a\u0440\u0430\u0441\u043d\u043e\u044f\u0440\u0441\u043a"],
    center: [92.8526, 56.0106],
    radiusKm: 58,
    landmark: "\u0421\u0442\u043e\u043b\u0431\u044b",
    image: "/city-clusters/krasnoyarsk.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(74,222,128,.82), transparent 34%), linear-gradient(135deg, rgba(20,83,45,.92), rgba(15,23,42,.96))",
  },
  {
    id: "nizhny-novgorod",
    name: "\u041d\u0438\u0436\u043d\u0438\u0439 \u041d\u043e\u0432\u0433\u043e\u0440\u043e\u0434",
    aliases: ["nizhny novgorod", "\u043d\u0438\u0436\u043d\u0438\u0439 \u043d\u043e\u0432\u0433\u043e\u0440\u043e\u0434", "\u043d\u0438\u0436\u043d\u0438\u0439"],
    center: [44.0059, 56.3269],
    radiusKm: 62,
    landmark: "\u0421\u0442\u0440\u0435\u043b\u043a\u0430",
    image: "/city-clusters/nizhny-novgorod.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(45,212,191,.84), transparent 34%), linear-gradient(135deg, rgba(17,94,89,.9), rgba(15,23,42,.96))",
  },
  {
    id: "chelyabinsk",
    name: "\u0427\u0435\u043b\u044f\u0431\u0438\u043d\u0441\u043a",
    aliases: ["chelyabinsk", "\u0447\u0435\u043b\u044f\u0431\u0438\u043d\u0441\u043a"],
    center: [61.4368, 55.1644],
    radiusKm: 58,
    landmark: "\u0410\u0440\u043a\u0430",
    image: "/city-clusters/chelyabinsk.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(148,163,184,.9), transparent 34%), linear-gradient(135deg, rgba(51,65,85,.94), rgba(15,23,42,.96))",
  },
  {
    id: "ufa",
    name: "\u0423\u0444\u0430",
    aliases: ["ufa", "\u0443\u0444\u0430"],
    center: [55.9587, 54.7351],
    radiusKm: 58,
    landmark: "\u0421\u0430\u043b\u0430\u0432\u0430\u0442",
    image: "/city-clusters/ufa.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(250,204,21,.86), transparent 34%), linear-gradient(135deg, rgba(101,67,33,.92), rgba(15,23,42,.96))",
  },
  {
    id: "samara",
    name: "\u0421\u0430\u043c\u0430\u0440\u0430",
    aliases: ["samara", "\u0441\u0430\u043c\u0430\u0440\u0430"],
    center: [50.1002, 53.1959],
    radiusKm: 58,
    landmark: "\u041a\u043e\u0441\u043c\u043e\u0441",
    image: "/city-clusters/samara.webp",
    background: "radial-gradient(circle at 28% 20%, rgba(196,181,253,.9), transparent 34%), linear-gradient(135deg, rgba(76,29,149,.92), rgba(15,23,42,.96))",
  },
];

type MapStatus =
  | { state: "missing-key"; message: string }
  | { state: "loading"; message: string }
  | { state: "ready"; message: string }
  | { state: "fallback"; message: string; details?: string };

type YMaps3Api = {
  ready: Promise<void>;
  import: <T>(packageName: string) => Promise<T>;
};

type YandexReactify = {
  module: (module: YMaps3Api) => YandexReactComponents;
  useDefault: <T>(value: T, deps?: unknown[]) => T;
};

type YandexReactifyPackage = {
  reactify: {
    bindTo: (react: typeof React, reactDom: typeof ReactDOM) => YandexReactify;
  };
};

type YandexReactComponents = {
  YMap: React.ComponentType<{ location: unknown; mode?: "vector" | "raster"; children?: React.ReactNode }>;
  YMapDefaultSchemeLayer: React.ComponentType<Record<string, never>>;
  YMapDefaultFeaturesLayer: React.ComponentType<Record<string, never>>;
  YMapMarker: React.ComponentType<{ coordinates: unknown; children?: React.ReactNode }>;
  YMapListener: React.ComponentType<{ onUpdate?: (event: { location?: { center?: [number, number]; zoom?: number } }) => void }>;
};

type YandexReactifiedMaps = YandexReactComponents & {
  reactify: YandexReactify;
};

type PartnerMapPoint = {
  id: string;
  company: TwaCompany;
  location: TwaCompany["locations"][number];
};

type MarkerItem =
  | { type: "point"; point: PartnerMapPoint }
  | { type: "cluster"; id: string; points: PartnerMapPoint[]; longitude: number; latitude: number }
  | { type: "city"; id: string; city: CityClusterDefinition; points: PartnerMapPoint[]; partnerCount: number; longitude: number; latitude: number };

type MapLocationState = {
  center: [number, number];
  zoom: number;
};

type UserMapLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type MapMediaAsset = {
  url: string | null;
};

type MapCompanyMedia = {
  media: {
    logo: MapMediaAsset | null;
    hero: MapMediaAsset | null;
    gallery: MapMediaAsset[];
  };
};

type SelectedMediaItem = {
  url: string;
  kind: "logo" | "image";
};

type RouteMode = "auto" | "pedestrian" | "transit";

const ROUTE_MODES: Array<{ key: RouteMode; labelKey: TranslationKey; yandex: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "auto", labelKey: "client.map.routeAuto", yandex: "auto", icon: Car },
  { key: "pedestrian", labelKey: "client.map.routeWalk", yandex: "pd", icon: Footprints },
  { key: "transit", labelKey: "client.map.routeTransit", yandex: "mt", icon: Bus },
];

type FullMapSheetLevel = "peek" | "expanded";

const FULL_MAP_SHEET_HEIGHT: Record<FullMapSheetLevel, string> = {
  peek: "58px",
  expanded: "78dvh",
};

declare global {
  interface Window {
    ymaps3?: YMaps3Api;
  }
}

let yandexMapsLoadPromise: Promise<YMaps3Api> | null = null;
let yandexReactifiedMapsLoadPromise: Promise<YandexReactifiedMaps> | null = null;

function uniqueCompanyCategories(company: TwaCompany) {
  const bySlug = new Map([company.category, ...company.categories].filter(Boolean).map((category) => [category.slug, category]));
  return [...bySlug.values()];
}

function buildSelectedMediaItems(company: TwaCompany | null, media: MapCompanyMedia | null) {
  if (!company) return [];

  const candidates: SelectedMediaItem[] = [];
  const logoUrl = media?.media.logo?.url ?? company.logoUrl;
  if (logoUrl) candidates.push({ url: logoUrl, kind: "logo" });
  if (media?.media.hero?.url) candidates.push({ url: media.media.hero.url, kind: "image" });
  for (const asset of media?.media.gallery ?? []) {
    if (asset.url) candidates.push({ url: asset.url, kind: "image" });
  }

  return candidates
    .filter((candidate, index) => candidates.findIndex((item) => item.url === candidate.url) === index)
    .slice(0, 5);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function isLocationOpenNow(location: PartnerMapPoint["location"], now = new Date()) {
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

function routeHref(location: PartnerMapPoint["location"], mode: RouteMode = "auto", userLocation: UserMapLocation | null = null) {
  const routeMode = ROUTE_MODES.find((item) => item.key === mode) ?? ROUTE_MODES[0];
  const destination = `${location.latitude},${location.longitude}`;
  const start = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : "";
  return `https://yandex.ru/maps/?rtext=${encodeURIComponent(`${start}~${destination}`)}&rtt=${routeMode.yandex}`;
}

function categoryIconName(point: PartnerMapPoint) {
  return point.company.category?.icon ?? point.company.categories[0]?.icon ?? "MapPin";
}

function normalizeCityName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/С‘/g, "Рµ")
    .replace(/[^a-zР°-СЏ0-9]+/gi, " ")
    .trim();
}

function distanceBetweenKm(fromLatitude: number, fromLongitude: number, toLatitude: number, toLongitude: number) {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(toLatitude - fromLatitude);
  const dLng = toRad(toLongitude - fromLongitude);
  const lat1 = toRad(fromLatitude);
  const lat2 = toRad(toLatitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cityForPoint(point: PartnerMapPoint) {
  const locationCity = normalizeCityName(point.location.city);
  const address = normalizeCityName(point.location.address);
  const byName = CITY_CLUSTERS.find((city) =>
    city.aliases.some((alias) => {
      const normalizedAlias = normalizeCityName(alias);
      return locationCity === normalizedAlias || address.includes(normalizedAlias);
    }),
  );
  if (byName) return byName;

  const nearest = CITY_CLUSTERS
    .map((city) => ({
      city,
      distance: distanceBetweenKm(point.location.latitude, point.location.longitude, city.center[1], city.center[0]),
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return nearest && nearest.distance <= nearest.city.radiusKm ? nearest.city : null;
}

function buildCityMarkerItems(points: PartnerMapPoint[]): MarkerItem[] {
  const cityBuckets = new Map<string, { city: CityClusterDefinition; points: PartnerMapPoint[] }>();

  for (const point of points) {
    const city = cityForPoint(point);
    if (!city) continue;
    const current = cityBuckets.get(city.id) ?? { city, points: [] };
    current.points.push(point);
    cityBuckets.set(city.id, current);
  }

  return [...cityBuckets.values()]
    .map<MarkerItem>(({ city, points: cityPoints }) => ({
      type: "city",
      id: `city:${city.id}`,
      city,
      points: cityPoints,
      partnerCount: new Set(cityPoints.map((point) => point.company.id)).size,
      longitude: city.center[0],
      latitude: city.center[1],
    }))
    .sort((a, b) => {
      if (a.type !== "city" || b.type !== "city") return 0;
      return b.points.length - a.points.length || a.city.name.localeCompare(b.city.name);
    });
}

function clusterCellSize(zoom: number, pointsCount: number) {
  if (zoom >= 14) return 0;
  if (zoom >= 13) return pointsCount >= 20 ? 0.018 : 0.012;
  if (zoom >= 12) return 0.035;
  if (zoom >= 11) return 0.07;
  if (zoom >= 10) return 0.14;
  if (zoom > CITY_CLUSTER_MAX_ZOOM) return 0.32;
  return 0.75;
}

function buildMarkerItems(points: PartnerMapPoint[], selectedId: string | null, zoom = 11): MarkerItem[] {
  if (zoom <= CITY_CLUSTER_MAX_ZOOM) {
    const cityItems = buildCityMarkerItems(points);
    if (cityItems.length > 0) return cityItems;
  }
  if (points.length < 4) return points.map((point) => ({ type: "point", point }));

  const buckets = new Map<string, PartnerMapPoint[]>();
  const cellSize = clusterCellSize(zoom, points.length);
  if (cellSize <= 0) return points.map((point) => ({ type: "point", point }));

  for (const point of points) {
    const key = `${Math.floor(point.location.latitude / cellSize)}:${Math.floor(point.location.longitude / cellSize)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), point]);
  }

  return [...buckets.entries()].flatMap<MarkerItem>(([key, bucket]) => {
    const selectedPoints = selectedId ? bucket.filter((point) => point.id === selectedId) : [];
    const clusterablePoints = selectedId ? bucket.filter((point) => point.id !== selectedId) : bucket;
    const standaloneItems = selectedPoints.map((point) => ({ type: "point" as const, point }));

    if (clusterablePoints.length < 2) {
      return [...standaloneItems, ...clusterablePoints.map((point) => ({ type: "point" as const, point }))];
    }

    return {
      type: "cluster" as const,
      id: `cluster:${key}`,
      points: clusterablePoints,
      longitude: clusterablePoints.reduce((sum, point) => sum + point.location.longitude, 0) / clusterablePoints.length,
      latitude: clusterablePoints.reduce((sum, point) => sum + point.location.latitude, 0) / clusterablePoints.length,
    };
  });
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function interpolateLocation(from: MapLocationState, to: MapLocationState, progress: number): MapLocationState {
  return {
    center: [
      from.center[0] + (to.center[0] - from.center[0]) * progress,
      from.center[1] + (to.center[1] - from.center[1]) * progress,
    ],
    zoom: from.zoom + (to.zoom - from.zoom) * progress,
  };
}

function distanceKm(from: UserMapLocation | null, to: PartnerMapPoint["location"]) {
  if (!from) return null;
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number | null, t: TranslateFn) {
  if (km == null) return t("client.map.locationOff");
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

function pointMatchesQuery(point: PartnerMapPoint, query: string, t: TranslateFn) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const categories = uniqueCompanyCategories(point.company);
  const haystack = [
    point.company.name,
    point.company.description ?? "",
    point.location.title ?? "",
    point.location.address,
    point.location.city ?? "",
    ...categories.flatMap((category) => [category.name, categoryName(category, t), category.slug]),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(normalized);
}

function activeSubscriptionMatchesCompany(subscription: TwaUserSubscription, company: TwaCompany) {
  const plan = subscription.subscription;
  if (plan.company?.id === company.id) return true;
  if (!plan.company && plan.category?.slug) {
    return uniqueCompanyCategories(company).some((category) => category.slug === plan.category?.slug);
  }
  return false;
}

function fallbackCoordinates(longitude: number, latitude: number, points: PartnerMapPoint[]) {
  const longitudes = points.map((item) => item.location.longitude);
  const latitudes = points.map((item) => item.location.latitude);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const lngSpan = Math.max(0.001, maxLng - minLng);
  const latSpan = Math.max(0.001, maxLat - minLat);
  return {
    x: 12 + ((longitude - minLng) / lngSpan) * 76,
    y: 88 - ((latitude - minLat) / latSpan) * 76,
  };
}

function fallbackPoint(point: PartnerMapPoint, points: PartnerMapPoint[]) {
  return fallbackCoordinates(point.location.longitude, point.location.latitude, points);
}

function CityClusterBadge({ item, compact = false }: { item: Extract<MarkerItem, { type: "city" }>; compact?: boolean }) {
  return (
    <motion.span
      className={cn(
        "flex items-center gap-2 rounded-2xl border border-cyan-200/50 bg-slate-950/90 p-1.5 text-white shadow-[0_18px_42px_rgba(0,0,0,0.45)] ring-4 ring-cyan-400/15 backdrop-blur",
        compact ? "max-w-[132px] pr-2" : "max-w-[170px] pr-3",
      )}
      whileTap={{ scale: 0.96 }}
    >
      <span
        className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-slate-950", compact ? "h-11 w-11" : "h-14 w-14")}
        style={{ background: item.city.background }}
      >
        <img
          src={item.city.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          draggable={false}
        />
        <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_46%,rgba(0,0,0,0.24))]" />
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className="block truncate text-[12px] font-extrabold">{item.city.name}</span>
      </span>
      <span className="ml-auto shrink-0 rounded-full border border-cyan-200/30 bg-cyan-300/15 px-1.5 py-0.5 text-[11px] font-black text-cyan-50">
        {item.partnerCount}
      </span>
    </motion.span>
  );
}

function withYandexMapsTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), YANDEX_MAPS_LOAD_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function loadYandexMapsOnce(apiKey: string): Promise<YMaps3Api> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser is required."));
  if (window.ymaps3) {
    return withYandexMapsTimeout(window.ymaps3.ready.then(() => window.ymaps3 as YMaps3Api), "Yandex Maps initialization timed out.");
  }

  let existingScript = document.getElementById(YANDEX_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript?.dataset.loaded === "true" && !window.ymaps3) {
    existingScript.remove();
    existingScript = null;
  }

  if (existingScript) {
    const scriptElement = existingScript;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        scriptElement.removeEventListener("load", handleLoad);
        scriptElement.removeEventListener("error", handleError);
        if (timeoutId) clearTimeout(timeoutId);
      };
      const settleResolve = (api: YMaps3Api) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(api);
      };
      const settleReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (!window.ymaps3 && scriptElement.isConnected) scriptElement.remove();
        reject(error);
      };
      const resolveWhenReady = () => {
        if (!window.ymaps3) {
          settleReject(new Error("Yandex Maps script loaded, but ymaps3 is not available. Check API key restrictions."));
          return;
        }
        void withYandexMapsTimeout(window.ymaps3.ready.then(() => window.ymaps3 as YMaps3Api), "Yandex Maps initialization timed out.")
          .then(settleResolve)
          .catch(settleReject);
      };
      const handleLoad = () => {
        scriptElement.dataset.loaded = "true";
        resolveWhenReady();
      };
      const handleError = () => settleReject(new Error("Yandex Maps script failed to load."));
      const timeoutId = setTimeout(() => settleReject(new Error("Yandex Maps script loading timed out.")), YANDEX_MAPS_LOAD_TIMEOUT_MS);

      if (scriptElement.dataset.loaded === "true") {
        resolveWhenReady();
        return;
      }

      scriptElement.addEventListener("load", handleLoad);
      scriptElement.addEventListener("error", handleError);
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let lastClientError = "";
    const handleWindowError = (event: ErrorEvent) => {
      lastClientError = [event.message, event.filename, event.lineno ? `line ${event.lineno}` : ""].filter(Boolean).join(" | ");
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      lastClientError = stringifyUnknownError(event.reason);
    };

    const cleanupDiagnostics = () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      if (timeoutId) clearTimeout(timeoutId);
    };
    const settleResolve = (api: YMaps3Api) => {
      if (settled) return;
      settled = true;
      cleanupDiagnostics();
      resolve(api);
    };
    const settleReject = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanupDiagnostics();
      if (!window.ymaps3 && script.isConnected) script.remove();
      reject(error);
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const script = document.createElement("script");
    script.id = YANDEX_MAPS_SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=en_US`;
    script.onload = () => {
      script.dataset.loaded = "true";
      if (!window.ymaps3) {
        settleReject(new Error(`Yandex Maps script loaded, but ymaps3 is not available.${lastClientError ? ` Browser detail: ${lastClientError}` : ""}`));
        return;
      }
      void withYandexMapsTimeout(window.ymaps3.ready.then(() => window.ymaps3 as YMaps3Api), "Yandex Maps initialization timed out.")
        .then(settleResolve)
        .catch((error: unknown) => settleReject(error instanceof Error ? error : new Error(stringifyUnknownError(error))));
    };
    script.onerror = (event) => {
      settleReject(new Error(`Yandex Maps script failed to load. ${describeScriptError(script.src, event)}`));
    };
    const timeoutId = setTimeout(() => settleReject(new Error("Yandex Maps script loading timed out.")), YANDEX_MAPS_LOAD_TIMEOUT_MS);
    document.head.appendChild(script);
  });
}

function loadYandexMaps(apiKey: string): Promise<YMaps3Api> {
  if (!yandexMapsLoadPromise) {
    yandexMapsLoadPromise = loadYandexMapsOnce(apiKey).catch((error: unknown) => {
      yandexMapsLoadPromise = null;
      yandexReactifiedMapsLoadPromise = null;
      throw error;
    });
  }
  return yandexMapsLoadPromise;
}

async function loadYandexReactifiedMapsOnce(apiKey: string): Promise<YandexReactifiedMaps> {
  const ymaps3 = await loadYandexMaps(apiKey);
  const { reactify } = await withYandexMapsTimeout(
    ymaps3.import<YandexReactifyPackage>("@yandex/ymaps3-reactify"),
    "Yandex Maps React components loading timed out.",
  );
  const boundReactify = reactify.bindTo(React, ReactDOM);
  return { ...boundReactify.module(ymaps3), reactify: boundReactify };
}

function loadYandexReactifiedMaps(apiKey: string): Promise<YandexReactifiedMaps> {
  if (!yandexReactifiedMapsLoadPromise) {
    yandexReactifiedMapsLoadPromise = loadYandexReactifiedMapsOnce(apiKey).catch((error: unknown) => {
      yandexReactifiedMapsLoadPromise = null;
      throw error;
    });
  }
  return yandexReactifiedMapsLoadPromise;
}

function stringifyUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function describeScriptError(src: string, event: Event | string) {
  const details = typeof event === "string" ? event : [event.type, event instanceof ErrorEvent ? event.message : ""].filter(Boolean).join(" | ");
  return `Script: ${src}. Browser event: ${details || "script error"}.`;
}

function PartnerMap({
  points,
  selectedId,
  onSelect,
  userLocation,
  onClusterPreview,
  selectedPreview,
  className,
  overlay,
  showFooter = true,
}: {
  points: PartnerMapPoint[];
  selectedId: string | null;
  onSelect: (point: PartnerMapPoint) => void;
  userLocation: UserMapLocation | null;
  onClusterPreview: (points: PartnerMapPoint[]) => void;
  selectedPreview?: React.ReactNode;
  className?: string;
  overlay?: React.ReactNode;
  showFooter?: boolean;
}) {
  const { t } = useI18n("ru");
  const markerItems = useMemo(() => buildMarkerItems(points, selectedId, 11), [points, selectedId]);

  return (
    <div className={cn("relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/10 bg-muted/30", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.05),transparent)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:34px_34px]" />
      {userLocation && points.length > 0 && (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 p-1 shadow-[0_10px_24px_rgba(14,165,233,0.45)] ring-4 ring-sky-500/20"
          style={{
            left: `${fallbackCoordinates(userLocation.longitude, userLocation.latitude, points).x}%`,
            top: `${fallbackCoordinates(userLocation.longitude, userLocation.latitude, points).y}%`,
          }}
          aria-label="Your approximate location"
        >
          <LocateFixed className="h-4 w-4 text-white" />
        </span>
      )}
      {markerItems.map((item) => {
        if (item.type === "city") {
          const position = fallbackCoordinates(item.longitude, item.latitude, points);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onClusterPreview(item.points)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-cyan-200"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-label={`${item.city.name}: ${item.partnerCount} РїР°СЂС‚РЅС‘СЂРѕРІ`}
            >
              <CityClusterBadge item={item} compact />
            </button>
          );
        }
        if (item.type === "cluster") {
          const position = fallbackCoordinates(item.longitude, item.latitude, points);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onClusterPreview(item.points)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              aria-label={interpolate(t("client.map.locationsCluster"), { count: item.points.length })}
            >
              <motion.span
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-300 bg-slate-950 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.45)] ring-4 ring-slate-950/25"
                whileTap={{ scale: 0.94 }}
              >
                {item.points.length}
              </motion.span>
            </button>
          );
        }
        const point = item.point;
        const position = fallbackPoint(point, points);
        const isSelected = selectedId === point.id;
        return (
          <button
            key={point.id}
            type="button"
            onClick={() => onSelect(point)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
            aria-label={`${point.company.name}: ${point.location.address}`}
          >
            <motion.span
              className={cn(
                "flex items-center justify-center rounded-full border-2 shadow-[0_12px_24px_rgba(0,0,0,0.42)] ring-4 ring-slate-950/20",
                isSelected
                  ? "h-10 w-10 border-emerald-300 bg-slate-950 text-white"
                  : point.location.isMain
                    ? "h-9 w-9 border-white bg-slate-900 text-white"
                    : "h-8 w-8 border-white/90 bg-slate-800 text-white",
              )}
              animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <CategoryIcon iconName={categoryIconName(point)} className={cn("drop-shadow", isSelected ? "h-[18px] w-[18px]" : "h-4 w-4")} />
            </motion.span>
          </button>
        );
      })}
      {showFooter && (
        <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-background/80 px-2 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
          {interpolate(t("client.map.densityPreview"), { count: points.length })}
        </div>
      )}
      {overlay}
      {selectedPreview && (
        <div className="pointer-events-auto absolute inset-x-3 bottom-10 z-20">
          {selectedPreview}
        </div>
      )}
    </div>
  );
}
function YandexPartnerMap({
  points,
  selectedId,
  onSelect,
  focusPoint,
  userLocation,
  nearMeFocusKey,
  onClusterPreview,
  selectedPreview,
  className,
  overlay,
  showDiagnostics = true,
  showFooter = true,
}: {
  points: PartnerMapPoint[];
  selectedId: string | null;
  onSelect: (point: PartnerMapPoint) => void;
  focusPoint: PartnerMapPoint | null;
  userLocation: UserMapLocation | null;
  nearMeFocusKey: number;
  onClusterPreview: (points: PartnerMapPoint[]) => void;
  selectedPreview?: React.ReactNode;
  className?: string;
  overlay?: React.ReactNode;
  showDiagnostics?: boolean;
  showFooter?: boolean;
}) {
  const { t } = useI18n("ru");
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const initialCenterSource = focusPoint ?? points[0] ?? null;
  const initialLocation: MapLocationState = {
    center: initialCenterSource
      ? [initialCenterSource.location.longitude, initialCenterSource.location.latitude]
      : YANDEX_MAP_CENTER,
    zoom: focusPoint ? 15 : points.length > 1 ? 11 : 14,
  };
  const [maps, setMaps] = useState<YandexReactifiedMaps | null>(null);
  const [mapLocation, setMapLocation] = useState<MapLocationState>(initialLocation);
  const mapLocationRef = useRef<MapLocationState>(initialLocation);
  const animationFrameRef = useRef<number | null>(null);
  const passiveMapSyncTimeoutRef = useRef<number | null>(null);
  const [status, setStatus] = useState<MapStatus>(() =>
    apiKey
      ? { state: "loading", message: t("client.map.yandexLoading") }
      : { state: "missing-key", message: t("client.map.yandexMissing") },
  );
  const translateRef = useRef(t);
  translateRef.current = t;
  const markerItems = useMemo(() => buildMarkerItems(points, selectedId, mapLocation.zoom), [points, selectedId, mapLocation.zoom]);

  function clearPassiveMapSync() {
    if (passiveMapSyncTimeoutRef.current == null) return;
    window.clearTimeout(passiveMapSyncTimeoutRef.current);
    passiveMapSyncTimeoutRef.current = null;
  }

  function commitMapLocation(nextLocation: MapLocationState) {
    clearPassiveMapSync();
    mapLocationRef.current = nextLocation;
    setMapLocation(nextLocation);
  }

  function schedulePassiveMapLocationSync(nextLocation: MapLocationState) {
    mapLocationRef.current = nextLocation;
    clearPassiveMapSync();
    passiveMapSyncTimeoutRef.current = window.setTimeout(() => {
      passiveMapSyncTimeoutRef.current = null;
      const latestLocation = mapLocationRef.current;
      setMapLocation((currentLocation) => {
        if (
          Math.abs(currentLocation.zoom - latestLocation.zoom) < 0.01 &&
          Math.abs(currentLocation.center[0] - latestLocation.center[0]) < 0.000001 &&
          Math.abs(currentLocation.center[1] - latestLocation.center[1]) < 0.000001
        ) {
          return currentLocation;
        }
        return latestLocation;
      });
    }, 240);
  }

  function stopMapAnimation() {
    if (animationFrameRef.current == null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }

  function animateMapLocation(target: MapLocationState, duration = 560) {
    stopMapAnimation();
    const start = mapLocationRef.current;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      commitMapLocation(interpolateLocation(start, target, easeInOutCubic(progress)));
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(step);
        return;
      }
      animationFrameRef.current = null;
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
  }

  useEffect(() => {
    if (!apiKey) return;

    let disposed = false;

    void loadYandexReactifiedMaps(apiKey)
      .then((reactifiedMaps) => {
        if (disposed) return;
        setMaps(reactifiedMaps);
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setMaps(null);
          setStatus({
            state: "fallback",
            message: translateRef.current("client.map.yandexFailed"),
            details: stringifyUnknownError(error),
          });
        }
      });

    return () => {
      disposed = true;
      stopMapAnimation();
      clearPassiveMapSync();
    };
  }, [apiKey]);

  useEffect(() => {
    if (!maps) return;
    setStatus({
      state: "ready",
      message: interpolate(t("client.map.yandexReady"), { count: points.length }),
    });
  }, [maps, points.length, t]);

  useEffect(() => {
    stopMapAnimation();
    if (!focusPoint) return;
    commitMapLocation({
      center: [focusPoint.location.longitude, focusPoint.location.latitude],
      zoom: 15,
    });
  }, [focusPoint?.id]);

  useEffect(() => {
    if (!userLocation || nearMeFocusKey === 0) return;
    animateMapLocation(
      {
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 14,
      },
      620,
    );
  }, [nearMeFocusKey, userLocation?.latitude, userLocation?.longitude]);

  if (!apiKey || status.state === "missing-key" || status.state === "fallback" || !maps) {
    return (
      <div className="space-y-2">
        <PartnerMap
          points={points}
          selectedId={selectedId}
          onSelect={onSelect}
          userLocation={userLocation}
          onClusterPreview={onClusterPreview}
          selectedPreview={selectedPreview}
          className={className}
          overlay={overlay}
          showFooter={showFooter}
        />
        {showDiagnostics && <MapDiagnostics status={status} />}
      </div>
    );
  }

  const { YMap, YMapDefaultFeaturesLayer, YMapDefaultSchemeLayer, YMapMarker, YMapListener } = maps;
  const location = mapLocation;

  return (
    <div className="space-y-2">
      <div className={cn("nearloy-yandex-map relative isolate h-[280px] w-full overflow-hidden rounded-2xl border border-white/10 bg-muted/30", className)}>
        <YMap location={location} mode="vector">
          <YMapDefaultSchemeLayer />
          <YMapDefaultFeaturesLayer />
          <YMapListener
            onUpdate={(event) => {
              const nextCenter = event.location?.center;
              const nextZoom = event.location?.zoom;
              if (!nextCenter || typeof nextZoom !== "number") return;
              schedulePassiveMapLocationSync({ center: nextCenter, zoom: nextZoom });
            }}
          />
          {userLocation && (
            <YMapMarker coordinates={[userLocation.longitude, userLocation.latitude]}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-sky-500 text-white shadow-[0_12px_28px_rgba(14,165,233,0.48)] ring-4 ring-sky-500/20">
                <LocateFixed className="h-5 w-5" />
              </div>
            </YMapMarker>
          )}
          {markerItems.map((item) => {
            if (item.type === "city") {
              return (
                <YMapMarker key={item.id} coordinates={[item.longitude, item.latitude]}>
                  <button
                    type="button"
                    onClick={() => {
                      onClusterPreview(item.points);
                      animateMapLocation({
                        center: [item.longitude, item.latitude],
                        zoom: CITY_CLUSTER_ZOOM_IN,
                      });
                    }}
                    className="transition-transform focus:outline-none focus:ring-2 focus:ring-cyan-200 active:scale-95"
                    aria-label={`${item.city.name}: ${item.partnerCount} РїР°СЂС‚РЅС‘СЂРѕРІ`}
                  >
                    <CityClusterBadge item={item} />
                  </button>
                </YMapMarker>
              );
            }
            if (item.type === "cluster") {
              return (
                <YMapMarker key={item.id} coordinates={[item.longitude, item.latitude]}>
                  <button
                    type="button"
                    onClick={() => {
                      onClusterPreview(item.points);
                      animateMapLocation({
                        center: [item.longitude, item.latitude],
                        zoom: Math.max(mapLocationRef.current.zoom + 2, 14),
                      });
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-emerald-300 bg-slate-950 text-sm font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,0.45)] ring-4 ring-slate-950/25 transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-300 active:scale-95"
                    aria-label={interpolate(t("client.map.locationsCluster"), { count: item.points.length })}
                  >
                    {item.points.length}
                  </button>
                </YMapMarker>
              );
            }
            const point = item.point;
            const isSelected = selectedId === point.id;
            return (
              <YMapMarker key={point.id} coordinates={[point.location.longitude, point.location.latitude]}>
                <button
                  type="button"
                  onClick={() => onSelect(point)}
                  className={cn(
                    "flex items-center justify-center rounded-full border-2 text-white shadow-[0_12px_24px_rgba(0,0,0,0.42)] ring-4 ring-slate-950/20 transition-transform focus:outline-none focus:ring-2 focus:ring-emerald-300",
                    isSelected
                      ? "h-10 w-10 scale-110 border-emerald-300 bg-slate-950"
                      : point.location.isMain
                        ? "h-9 w-9 border-white bg-slate-900"
                        : "h-8 w-8 border-white/90 bg-slate-800",
                  )}
                  aria-label={`${point.company.name}: ${point.location.address}`}
                >
                  <CategoryIcon iconName={categoryIconName(point)} className={cn("drop-shadow", isSelected ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                </button>
              </YMapMarker>
            );
          })}
        </YMap>
        {showFooter && (
          <div className="pointer-events-none absolute bottom-2 left-2 z-[2147483647] flex min-h-9 w-[250px] max-w-[calc(100%-1rem)] items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-2.5 py-1.5 text-[10px] text-slate-300 shadow-[0_14px_34px_rgba(0,0,0,0.42)] backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-300" />
            <span className="truncate">{t("client.map.yandexIntegration")}</span>
          </div>
        )}
        {overlay}
        {selectedPreview && (
          <div className="pointer-events-auto absolute inset-x-3 bottom-10 z-20">
            {selectedPreview}
          </div>
        )}
      </div>
      {showDiagnostics && <MapDiagnostics status={status} />}
    </div>
  );
}
function MapDiagnostics({ status }: { status: MapStatus }) {
  const { t } = useI18n("ru");
  const tone =
    status.state === "ready"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : status.state === "loading"
        ? "border-white/10 bg-muted/30 text-muted-foreground"
        : "border-amber-400/20 bg-amber-500/10 text-amber-100";

  return (
    <div className={cn("rounded-xl border px-3 py-2 text-[11px] leading-relaxed", tone)}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{t("client.map.diagnostic")}</span>
        <span className="rounded-full bg-background/50 px-2 py-0.5 uppercase tracking-wide">{status.state}</span>
      </div>
      <p className="mt-1">{status.message}</p>
      {"details" in status && status.details && <pre className="mt-2 whitespace-pre-wrap text-[10px] opacity-90">{status.details}</pre>}
      {status.state !== "ready" && (
        <div className="mt-1 text-muted-foreground">
          {t("client.map.diagnosticHint")}
        </div>
      )}
    </div>
  );
}
export function MapPageContent({ full = false }: { full?: boolean } = {}) {
  const { t } = useI18n("ru");
  const searchParams = useSearchParams();
  const requestedCompany = searchParams.get("company");
  const requestedLocation = searchParams.get("location");
  const appMode = searchParams.get("app");
  const smallMapHref = appMode ? `/map?app=${encodeURIComponent(appMode)}` : "/map";
  const fullMapHref = appMode ? `/map/full?app=${encodeURIComponent(appMode)}` : "/map/full";
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pointMode, setPointMode] = useState<"all" | "main" | "visited" | "open" | "subscriptions">("all");
  const [sortMode, setSortMode] = useState<"name" | "points" | "branches">("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState<TwaUserSubscription[]>([]);
  const [userLocation, setUserLocation] = useState<UserMapLocation | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unavailable">("idle");
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [nearMeFocusKey, setNearMeFocusKey] = useState(0);
  const [clusterPreviewPoints, setClusterPreviewPoints] = useState<PartnerMapPoint[]>([]);
  const [selectedCompanyMedia, setSelectedCompanyMedia] = useState<{ slug: string; payload: MapCompanyMedia } | null>(null);
  const [fullSheetLevel, setFullSheetLevel] = useState<FullMapSheetLevel>("peek");
  const fullSheetDragControls = useDragControls();
  const fullSheetDraggingRef = useRef(false);

  const settleFullMapSheet = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) => {
    const shouldExpand = info.offset.y < -38 || info.velocity.y < -420;
    const shouldCollapse = info.offset.y > 38 || info.velocity.y > 420;
    if (!shouldExpand && !shouldCollapse) return;

    setFullSheetLevel((current) => {
      if (shouldExpand) return "expanded";
      if (shouldCollapse) return "peek";
      return current;
    });
  };

  useEffect(() => {
    let ignore = false;
    const cachedCompanies = getCachedTwaMapCompanies();
    const cachedSubscriptions = getCachedActiveTwaSubscriptions();
    if (cachedCompanies.length) setCompanies(cachedCompanies);
    if (SUBSCRIPTIONS_ENABLED && cachedSubscriptions.length) setActiveSubscriptions(cachedSubscriptions);
    const requests = SUBSCRIPTIONS_ENABLED
      ? Promise.all([getTwaMapCompanies(true), getActiveTwaSubscriptions()] as const)
      : Promise.all([getTwaMapCompanies(true), Promise.resolve([] as TwaUserSubscription[])] as const);

    void promiseWithTimeout(requests, CLIENT_BOOTSTRAP_TIMEOUT_MS)
      .then(([data, subscriptions]) => {
        if (ignore) return;
        setCompanies(data);
        setActiveSubscriptions(subscriptions);
      })
      .catch(() => {
        if (ignore) return;
        setCompanies(cachedCompanies);
        setActiveSubscriptions(SUBSCRIPTIONS_ENABLED ? cachedSubscriptions : []);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function requestGeolocation() {
    setGeoStatus("requesting");
    try {
      const position = await getGeolocationPosition({ enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 });
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
      });
      setNearMeFocusKey((value) => value + 1);
      setGeoStatus("ready");
    } catch (error) {
      setGeoStatus(error instanceof Error && error.message === "geolocation-unavailable" ? "unavailable" : "denied");
    }
  }

  const categories = useMemo(() => {
    const bySlug = new Map<string, ReturnType<typeof uniqueCompanyCategories>[number]>();
    for (const company of companies) {
      for (const category of uniqueCompanyCategories(company)) bySlug.set(category.slug, category);
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [companies]);

  const filteredPartners = useMemo(() => {
    const rows = selectedCategory
      ? companies.filter((company) => uniqueCompanyCategories(company).some((category) => category.slug === selectedCategory))
      : companies;
    return [...rows].sort((a, b) => {
      if (sortMode === "points") return b.points.balance - a.points.balance;
      if (sortMode === "branches") return b.locations.length - a.locations.length;
      return a.name.localeCompare(b.name);
    });
  }, [companies, selectedCategory, sortMode]);

  const activeCompanyIds = useMemo(() => {
    const ids = new Set<number>();
    for (const company of companies) {
      if (activeSubscriptions.some((subscription) => activeSubscriptionMatchesCompany(subscription, company))) {
        ids.add(company.id);
      }
    }
    return ids;
  }, [activeSubscriptions, companies]);

  const filteredLocationPoints = useMemo(
    () =>
      filteredPartners
        .flatMap((company) =>
          company.locations.map((location) => ({
            id: `${company.id}:${location.uuid}`,
            company,
            location,
          })),
        )
        .filter((point) => {
          if (pointMode === "main") return point.location.isMain;
          if (pointMode === "visited") return point.company.points.totalEarnedPoints > 0 || point.company.points.balance > 0;
          if (pointMode === "open") return isLocationOpenNow(point.location);
          if (pointMode === "subscriptions") return activeCompanyIds.has(point.company.id);
          return true;
        }),
    [activeCompanyIds, filteredPartners, pointMode],
  );

  const searchMatches = useMemo(
    () => filteredLocationPoints.filter((point) => pointMatchesQuery(point, searchQuery, t)),
    [filteredLocationPoints, searchQuery, t],
  );

  const locationPoints = useMemo(
    () => {
      const rows = searchQuery.trim() ? searchMatches : filteredLocationPoints;
      const nearbyRows =
        nearMeOnly && userLocation
          ? rows.filter((point) => {
              const distance = distanceKm(userLocation, point.location);
              return distance != null && distance <= 8;
            })
          : rows;
      const sortedRows =
        nearMeOnly && userLocation
          ? [...nearbyRows].sort(
              (a, b) =>
                (distanceKm(userLocation, a.location) ?? Number.POSITIVE_INFINITY) -
                (distanceKm(userLocation, b.location) ?? Number.POSITIVE_INFINITY),
            )
          : nearbyRows;
      return sortedRows.length > 0 ? sortedRows : rows;
    },
    [filteredLocationPoints, nearMeOnly, searchMatches, searchQuery, userLocation],
  );

  const requestedPoint = useMemo(
    () =>
      requestedCompany && requestedLocation
        ? locationPoints.find(
            (point) => String(point.company.id) === requestedCompany && point.location.uuid === requestedLocation,
          ) ?? null
        : null,
    [locationPoints, requestedCompany, requestedLocation],
  );
  const effectiveSelectedPointId = selectedPointId ?? requestedPoint?.id ?? null;
  const selectedPoint = effectiveSelectedPointId
    ? locationPoints.find((point) => point.id === effectiveSelectedPointId) ?? null
    : null;
  const selectedPartner = selectedPoint?.company ?? null;
  useEffect(() => {
    if (!full || !selectedPartner?.slug) return;

    let ignore = false;
    const slug = selectedPartner.slug;
    void fetch(`/api/public/company-media/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<MapCompanyMedia>) : null))
      .then((payload) => {
        if (!ignore && payload) setSelectedCompanyMedia({ slug, payload });
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [full, selectedPartner?.slug]);
  const selectedMediaItems = buildSelectedMediaItems(
    selectedPartner,
    selectedCompanyMedia?.slug === selectedPartner?.slug ? (selectedCompanyMedia?.payload ?? null) : null,
  );
  const selectedLogoUrl = selectedMediaItems.find((item) => item.kind === "logo")?.url ?? null;
  const selectedGalleryMediaItems = selectedMediaItems.filter((item) => item.kind === "image");
  const selectedCategoryData = selectedCategory ? categories.find((category) => category.slug === selectedCategory) : null;
  const selectedDistance = selectedPoint ? distanceKm(userLocation, selectedPoint.location) : null;
  const nearestSameCompany = useMemo(() => {
    if (!selectedPoint) return [];
    return selectedPoint.company.locations
      .filter((location) => location.uuid !== selectedPoint.location.uuid)
      .map((location) => ({ location, distance: distanceKm(userLocation, location) }))
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
      .slice(0, 3);
  }, [selectedPoint, userLocation]);

  const hasActiveMapFilters =
    pointMode !== "all" || selectedCategory !== null || nearMeOnly || searchQuery.trim().length > 0;

  function resetMapFilters() {
    setPointMode("all");
    setSelectedCategory(null);
    setNearMeOnly(false);
    setSearchQuery("");
    setSelectedPointId("");
    setClusterPreviewPoints([]);
  }
  const mapOverlay = (
    <div className="pointer-events-auto absolute right-3 top-3 z-30 flex items-center gap-2">
      {!full && (
        <Button
          asChild
          size="icon"
          className="h-11 w-11 rounded-full border border-white/15 bg-slate-950/88 text-white shadow-[0_16px_38px_rgba(0,0,0,0.42)] backdrop-blur-xl hover:bg-slate-900"
          aria-label={t("client.map.expand")}
        >
          <Link href={fullMapHref}>
            <Maximize2 className="h-5 w-5" />
          </Link>
        </Button>
      )}
    </div>
  );
  const selectedPreview = selectedPartner && selectedPoint ? (
    <motion.div
      key={selectedPoint.id}
      initial={{ y: 24, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", bounce: 0.22, duration: 0.42 }}
      className="rounded-[1.25rem] border border-white/15 bg-slate-950/94 p-2.5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.52)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex shrink-0 items-center justify-center overflow-hidden bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/25",
            full ? "h-14 w-14 rounded-2xl bg-white/[0.06]" : "h-9 w-9 rounded-xl",
          )}
        >
          {full && selectedLogoUrl ? (
            <img
              src={selectedLogoUrl}
              alt={selectedPartner.name}
              className="h-full w-full object-contain p-1"
              loading="lazy"
              draggable={false}
            />
          ) : (
            <CategoryIcon iconName={categoryIconName(selectedPoint)} className={full ? "h-6 w-6" : "h-4 w-4"} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{selectedPartner.name}</p>
              <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-white/68">{selectedPoint.location.address}</p>
              {selectedPartner.description && (
                <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-white/45">
                  {selectedPartner.description}
                </p>
              )}
            </div>
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 transition hover:bg-white/12 hover:text-white"
              aria-label={t("client.map.closePartnerMenu")}
              onClick={() => {
                setSelectedPointId("");
                setClusterPreviewPoints([]);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
      {full && selectedGalleryMediaItems.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {selectedGalleryMediaItems.map((item, index) => (
            <div
              key={`${item.kind}-${item.url}`}
              className="relative h-20 w-32 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]"
            >
              <img
                src={item.url}
                alt={`${selectedPartner.name} — фото ${index + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-2.5 flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "h-8 shrink-0 border-white/10 bg-white/[0.06] px-2 text-[10px] text-white/75",
            isLocationOpenNow(selectedPoint.location) && "border-emerald-300/25 bg-emerald-500/10 text-emerald-100",
          )}
        >
          {selectedPoint.location.openTime}-{selectedPoint.location.closeTime}
        </Badge>
        <Badge variant="outline" className="h-8 shrink-0 border-white/10 bg-white/[0.06] px-2 text-[10px] text-white/75">
          {formatDistance(selectedDistance, t)}
        </Badge>
        <Badge variant="outline" className="h-8 shrink-0 border-white/10 bg-white/[0.06] px-2 text-[10px] text-white/75">
          {selectedPartner.points.balance} {t("client.common.pointsShort")}
        </Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button asChild size="sm" variant="secondary" className="h-8 rounded-xl text-xs">
          <a href={routeHref(selectedPoint.location, "auto", userLocation)} target="_blank" rel="noreferrer">
            <Route className="mr-1.5 h-3.5 w-3.5" />
            {t("client.map.route")}
          </a>
        </Button>
        <Button asChild size="sm" className="h-8 rounded-xl text-xs">
          <Link href={`/wallet/${selectedPartner.slug}`}>
            {t("client.map.openCard")}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </motion.div>
  ) : null;

  if (full) {
    const visibleRows = clusterPreviewPoints.length > 0 ? clusterPreviewPoints : locationPoints.slice(0, 8);

    const fullMapOverlay = (
      <div className="pointer-events-none absolute inset-0 z-30">
        <div className="pointer-events-auto absolute left-0 right-0 top-0 z-40 bg-gradient-to-b from-black/82 via-black/42 to-transparent px-4 pb-10 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="mx-auto max-w-[560px]">
            <div className="flex items-start gap-3">
              <Button asChild size="icon" className="mt-0.5 h-12 w-12 shrink-0 rounded-full bg-black/62 text-white shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur-xl hover:bg-black/76">
                <Link href={smallMapHref} aria-label={t("client.map.back")}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 pr-1">
                    <h1 className="text-[1.7rem] font-black leading-none tracking-tight text-white drop-shadow">{t("client.map.fullTitle")}</h1>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-11 w-11 rounded-full border border-white/12 bg-black/62 text-white shadow-[0_14px_34px_rgba(0,0,0,0.38)] backdrop-blur-xl hover:bg-black/76"
                      onClick={requestGeolocation}
                      disabled={geoStatus === "requesting"}
                      aria-label={geoStatus === "requesting" ? t("client.map.locating") : t("client.map.locate")}
                    >
                      <Crosshair className="h-4 w-4" />
                    </Button>
                    <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
                      <SheetTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-11 w-11 rounded-full border border-white/12 bg-black/62 text-white shadow-[0_14px_34px_rgba(0,0,0,0.38)] backdrop-blur-xl hover:bg-black/76"
                          aria-label={t("client.common.categories")}
                        >
                          <Filter className="h-4 w-4" />
                        </Button>
                      </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-3xl pb-[env(safe-area-inset-bottom)]">
                      <SheetHeader>
                        <SheetTitle>{t("client.map.filterByCategory")}</SheetTitle>
                      </SheetHeader>
                      <ScrollArea className="mt-4 h-[300px] pr-4">
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(null);
                              setFilterOpen(false);
                            }}
                            className={cn(
                              "rounded-2xl px-4 py-3 text-left font-semibold transition-colors",
                              selectedCategory === null ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
                            )}
                          >
                            {t("client.common.allCategories")}
                          </button>
                          {categories.map((category) => (
                            <button
                              key={category.slug}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(category.slug);
                                setFilterOpen(false);
                              }}
                              className={cn(
                                "rounded-2xl px-4 py-3 text-left font-semibold transition-colors",
                                selectedCategory === category.slug ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
                              )}
                            >
                              <span className="inline-flex items-center gap-2">
                                <CategoryIcon iconName={category.icon ?? "Circle"} className="h-4 w-4" />
                                {categoryName(category, t)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/58" />
                <Input
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setClusterPreviewPoints([]);
                  }}
                  placeholder={t("client.map.searchPlaceholder")}
                  className="h-12 rounded-full border-white/14 bg-black/64 pl-11 text-sm text-white shadow-[0_18px_44px_rgba(0,0,0,0.38)] backdrop-blur-xl placeholder:text-white/56"
                />
                {searchQuery.trim() && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] overflow-hidden rounded-2xl border border-white/12 bg-slate-950/92 shadow-[0_22px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                    {searchMatches.slice(0, 5).map((point) => (
                      <button
                        key={point.id}
                        type="button"
                        className="flex w-full items-center gap-3 border-b border-white/10 px-3 py-2.5 text-left last:border-b-0 hover:bg-white/[0.06]"
                        onClick={() => {
                          setSelectedPointId(point.id);
                          setClusterPreviewPoints([]);
                          setSearchQuery("");
                        }}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white">
                          <CategoryIcon iconName={categoryIconName(point)} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-white">{point.company.name}</span>
                          <span className="block truncate text-xs text-white/54">{point.location.address}</span>
                        </span>
                      </button>
                    ))}
                    {searchMatches.length === 0 && <p className="px-3 py-3 text-sm text-white/60">{t("client.map.noMatchingPoints")}</p>}
                  </div>
                )}
            </div>
          </div>
        </div>

        <motion.div
          initial={{ y: 90, opacity: 0, height: FULL_MAP_SHEET_HEIGHT.peek }}
          animate={{ y: 0, opacity: 1, height: FULL_MAP_SHEET_HEIGHT[fullSheetLevel] }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.46 }}
          drag="y"
          dragControls={fullSheetDragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          onDragStart={() => {
            fullSheetDraggingRef.current = true;
          }}
          onDragEnd={(event, info) => {
            settleFullMapSheet(event, info);
            window.setTimeout(() => {
              fullSheetDraggingRef.current = false;
            }, 0);
          }}
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 overflow-hidden rounded-t-[1.85rem] border border-white/14 bg-slate-950/92 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 text-white shadow-[0_-24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="mx-auto flex h-full max-w-[560px] flex-col">
            <button
              type="button"
              className="mx-auto mb-3 flex h-8 w-24 touch-none items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/80"
              aria-label={t("client.map.pointsTitle")}
              onPointerDown={(event) => {
                fullSheetDragControls.start(event);
              }}
              onClick={() => {
                if (fullSheetDraggingRef.current) return;
                setFullSheetLevel((current) => (current === "expanded" ? "peek" : "expanded"));
              }}
            >
              <span className="h-1.5 w-16 rounded-full bg-white/32 shadow-[0_0_20px_rgba(255,255,255,0.22)]" />
            </button>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black leading-tight">{t("client.map.pointsTitle")}</p>
                <p className="text-xs text-white/58">
                  {interpolate(t("client.map.pointsVisible"), { points: locationPoints.length, partners: filteredPartners.length })}
                </p>
              </div>
              <Badge variant="outline" className="border-white/12 bg-white/[0.06] text-white">
                {nearMeOnly ? t("client.map.near") : selectedCategoryData ? categoryName(selectedCategoryData, t) : t("client.common.all")}
              </Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ["all", t("client.map.allPoints")],
                ["main", t("client.map.mainOnly")],
                ["open", t("client.map.openNow")],
                ["visited", t("client.map.myPoints")],
                ...(SUBSCRIPTIONS_ENABLED ? [["subscriptions", t("client.map.activeSubs")]] : []),
              ].map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={pointMode === key ? "default" : "secondary"}
                  className="h-9 shrink-0 rounded-xl px-3 text-xs"
                  onClick={() => {
                    setPointMode(key as typeof pointMode);
                    setSelectedPointId("");
                    setClusterPreviewPoints([]);
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["name", t("client.map.sortName")],
                ["points", t("client.map.sortPoints")],
                ["branches", t("client.map.sortBranches")],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={sortMode === key ? "outline" : "ghost"}
                  className="h-8 rounded-xl border-white/12 px-3 text-xs text-white hover:bg-white/[0.08]"
                  onClick={() => setSortMode(key as typeof sortMode)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {selectedPreview ? (
                <div className="mt-3">{selectedPreview}</div>
              ) : (
              <ScrollArea className="mt-3 h-full pr-1">
                <div className="space-y-2">
                  {visibleRows.map((point) => (
                    <button
                      key={point.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-left transition hover:bg-white/[0.07]"
                      onClick={() => {
                        setSelectedPointId(point.id);
                        setClusterPreviewPoints([]);
                      }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                        <CategoryIcon iconName={categoryIconName(point)} className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{point.company.name}</span>
                        <span className="block truncate text-xs text-white/54">{point.location.address}</span>
                      </span>
                      <span className="shrink-0 text-xs text-white/48">{formatDistance(distanceKm(userLocation, point.location), t)}</span>
                    </button>
                  ))}
                  {visibleRows.length === 0 && (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center">
                      <p className="text-sm text-white/68">{t("client.map.noSavedLocations")}</p>
                      {hasActiveMapFilters && (
                        <Button type="button" size="sm" variant="secondary" className="mt-4 rounded-xl" onClick={resetMapFilters}>
                          {t("client.common.resetFilters")}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="fixed inset-0 z-[70] h-[100dvh] overflow-hidden bg-black">
        <YandexPartnerMap
          points={locationPoints}
          selectedId={effectiveSelectedPointId}
          onSelect={(point) => {
            setSelectedPointId(point.id);
            setClusterPreviewPoints([]);
          }}
          focusPoint={selectedPoint}
          userLocation={userLocation}
          nearMeFocusKey={nearMeFocusKey}
          onClusterPreview={(points) => setClusterPreviewPoints(points)}
          selectedPreview={null}
          className="h-[100dvh] min-h-[100dvh] rounded-none border-0"
          overlay={fullMapOverlay}
          showDiagnostics={false}
          showFooter={false}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={cn("min-h-full px-4 pb-4 pt-6", full && "min-h-[100dvh] px-3 pt-4")}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {full ? (
            <Button asChild size="icon" variant="secondary" className="h-11 w-11 rounded-full">
              <Link href={smallMapHref} aria-label={t("client.map.back")}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <MapPin className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h1 className={cn("font-semibold", full ? "text-xl" : "text-lg")}>
              {full ? t("client.map.fullTitle") : t("client.map.title")}
            </h1>
            {full && <p className="text-xs text-muted-foreground">{t("client.map.fullSubtitle")}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={geoStatus === "ready" ? "default" : "outline"}
            size="sm"
            className="glass border-white/10"
            onClick={requestGeolocation}
            disabled={geoStatus === "requesting"}
          >
            <Crosshair className="mr-1 h-4 w-4" />
            {geoStatus === "requesting" ? t("client.map.locating") : geoStatus === "ready" ? t("client.map.you") : t("client.map.locate")}
          </Button>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="glass border-white/10">
                <Filter className="mr-1 h-4 w-4" />
                {t("client.common.categories")}
              </Button>
            </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            <SheetHeader>
              <SheetTitle>{t("client.map.filterByCategory")}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="mt-4 h-[240px] pr-4">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setFilterOpen(false);
                  }}
                  className={cn(
                    "rounded-xl px-4 py-3 text-left font-medium transition-colors",
                    selectedCategory === null ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
                  )}
                >
                  {t("client.common.allCategories")}
                </button>
                {categories.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category.slug);
                      setFilterOpen(false);
                    }}
                    className={cn(
                      "rounded-xl px-4 py-3 text-left font-medium transition-colors",
                      selectedCategory === category.slug ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      <CategoryIcon iconName={category.icon ?? "Circle"} className="h-4 w-4" />
                      {categoryName(category, t)}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setClusterPreviewPoints([]);
            }}
            placeholder={t("client.map.searchPlaceholder")}
            className="h-11 rounded-2xl border-white/10 bg-muted/20 pl-9"
          />
        </div>
        {searchQuery.trim() && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
            {searchMatches.slice(0, 8).map((point) => (
              <button
                key={point.id}
                type="button"
                className="flex w-full items-center gap-3 border-b border-white/10 px-3 py-2.5 text-left last:border-b-0 hover:bg-white/[0.05]"
                onClick={() => {
                  setSelectedPointId(point.id);
                  setClusterPreviewPoints([]);
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white"
                >
                  <CategoryIcon iconName={categoryIconName(point)} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{point.company.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{point.location.address}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDistance(distanceKm(userLocation, point.location), t)}</span>
              </button>
            ))}
            {searchMatches.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground">{t("client.map.noMatchingPoints")}</p>
            )}
          </div>
        )}
        {geoStatus === "denied" && (
          <p className="text-xs text-amber-200">{t("client.map.geoBlocked")}</p>
        )}
        {geoStatus === "unavailable" && (
          <p className="text-xs text-amber-200">{t("client.map.geoUnavailable")}</p>
        )}
      </div>

      {selectedCategoryData && (
        <p className="mb-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CategoryIcon iconName={selectedCategoryData.icon ?? "Circle"} className="h-4 w-4 text-primary" />
            {interpolate(t("client.map.showing"), { category: selectedCategoryData.name })}
          </span>
        </p>
      )}

      <div className="mb-3 rounded-2xl border border-white/10 bg-muted/10 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{t("client.map.pointsTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {interpolate(t("client.map.pointsVisible"), { points: locationPoints.length, partners: filteredPartners.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {geoStatus === "ready" && (
              <Button
                size="sm"
                variant={nearMeOnly ? "default" : "outline"}
                className="h-8"
                onClick={() => {
                  setNearMeOnly((value) => !value);
                  setNearMeFocusKey((value) => value + 1);
                  setClusterPreviewPoints([]);
                }}
              >
                <LocateFixed className="mr-1 h-3.5 w-3.5" />
                {t("client.map.nearMe")}
              </Button>
            )}
            <Badge variant="outline">{nearMeOnly ? t("client.map.near") : pointMode}</Badge>
          </div>
        </div>
        <div className="hide-scrollbar flex gap-2 overflow-x-auto overflow-y-hidden pb-1 touch-pan-x">
          {[
            ["all", t("client.map.allPoints")],
            ["main", t("client.map.mainOnly")],
            ["open", t("client.map.openNow")],
            ["visited", t("client.map.myPoints")],
            ...(SUBSCRIPTIONS_ENABLED ? [["subscriptions", t("client.map.activeSubs")]] : []),
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={pointMode === key ? "default" : "secondary"}
              className="shrink-0"
              onClick={() => {
                setPointMode(key as typeof pointMode);
                setSelectedPointId("");
                setClusterPreviewPoints([]);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto overflow-y-hidden pb-1 touch-pan-x">
          {[
            ["name", t("client.map.sortName")],
            ["points", t("client.map.sortPoints")],
            ["branches", t("client.map.sortBranches")],
          ].map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={sortMode === key ? "outline" : "ghost"}
              className="shrink-0"
              onClick={() => setSortMode(key as typeof sortMode)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <YandexPartnerMap
        points={locationPoints}
        selectedId={effectiveSelectedPointId}
        onSelect={(point) => {
          setSelectedPointId(point.id);
          setClusterPreviewPoints([]);
        }}
        focusPoint={selectedPoint}
        userLocation={userLocation}
        nearMeFocusKey={nearMeFocusKey}
        onClusterPreview={(points) => setClusterPreviewPoints(points)}
        selectedPreview={selectedPreview}
        className={full ? "h-[calc(100dvh-330px)] min-h-[540px] rounded-[2rem] border-white/15" : undefined}
        overlay={mapOverlay}
      />

      {clusterPreviewPoints.length > 0 && (
        <Card className="glass mt-3 gap-0 overflow-hidden border-white/10 bg-slate-950/70 py-0">
          <CardContent className="space-y-4 px-4 pb-4 pt-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{t("client.map.clusterAddresses")}</p>
                <p className="text-xs text-muted-foreground">
                  {interpolate(t("client.map.pointsInArea"), { count: clusterPreviewPoints.length })}
                </p>
              </div>
              <Badge variant="outline">{interpolate(t("client.map.firstCount"), { count: Math.min(10, clusterPreviewPoints.length) })}</Badge>
            </div>
            <div className="space-y-3">
              {clusterPreviewPoints.slice(0, 10).map((point) => (
                <button
                  key={point.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                  onClick={() => {
                    setSelectedPointId(point.id);
                    setClusterPreviewPoints([]);
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white"
                  >
                    <CategoryIcon iconName={categoryIconName(point)} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{point.company.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{point.location.address}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDistance(distanceKm(userLocation, point.location), t)}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <AnimatePresence>
        {selectedPartner && selectedPoint && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.3 }}
            className="mt-3"
          >
            <Card className="glass gap-0 overflow-hidden border-white/10 bg-slate-950/70 py-0">
              <CardContent className="space-y-4 px-4 pb-4 pt-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">
                        <CategoryIcon iconName={categoryIconName(selectedPoint)} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{selectedPartner.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{selectedPoint.location.title ?? selectedPoint.location.city ?? t("client.map.partnerLocation")}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                    {uniqueCompanyCategories(selectedPartner).slice(0, 2).map((category) => (
                      <Badge key={category.slug} variant="secondary" className="inline-flex items-center gap-1 text-[10px] font-normal">
                        <CategoryIcon iconName={category.icon ?? "Circle"} className="h-3 w-3" />
                        {categoryName(category, t)}
                      </Badge>
                    ))}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 border-white/10",
                      isLocationOpenNow(selectedPoint.location) && "border-emerald-300/30 bg-emerald-500/10 text-emerald-200",
                    )}
                  >
                    {isLocationOpenNow(selectedPoint.location) ? t("client.map.openNow") : t("client.map.closed")}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="line-clamp-2 text-sm text-foreground">{selectedPoint.location.address}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-background/40 p-2">
                      <p className="text-muted-foreground">{t("client.map.hours")}</p>
                      <p className="mt-0.5 font-semibold">{selectedPoint.location.openTime}-{selectedPoint.location.closeTime}</p>
                    </div>
                    <div className="rounded-xl bg-background/40 p-2">
                      <p className="text-muted-foreground">{t("client.map.distance")}</p>
                      <p className="mt-0.5 font-semibold">{formatDistance(selectedDistance, t)}</p>
                    </div>
                    <div className="rounded-xl bg-background/40 p-2">
                      <p className="text-muted-foreground">{t("client.map.points")}</p>
                      <p className="mt-0.5 font-semibold">{selectedPartner.points.balance} {t("client.common.pointsShort")}</p>
                    </div>
                  </div>
                  {selectedPartner.description && (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{selectedPartner.description}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {ROUTE_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <Button key={mode.key} asChild size="sm" variant="secondary" className="h-10">
                        <a href={routeHref(selectedPoint.location, mode.key, userLocation)} target="_blank" rel="noreferrer">
                          <Icon className="mr-1 h-4 w-4" />
                          {t(mode.labelKey)}
                        </a>
                      </Button>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link href={`/wallet/${selectedPartner.slug}`}>
                      {t("client.map.openCard")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                {nearestSameCompany.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">{t("client.map.nearbyPartnerLocations")}</p>
                    {nearestSameCompany.map(({ location, distance }) => (
                      <Link
                        key={location.uuid}
                        href={`/map?company=${encodeURIComponent(String(selectedPartner.id))}&location=${encodeURIComponent(location.uuid)}`}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs transition-colors hover:bg-white/[0.06]"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{location.title ?? t("client.common.branch")}</span>
                          <span className="block truncate text-muted-foreground">{location.address}</span>
                        </span>
                        <span className="ml-2 shrink-0 text-muted-foreground">{formatDistance(distance, t)}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {locationPoints.length === 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-muted/10 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">{t("client.map.noSavedLocations")}</p>
          {hasActiveMapFilters && (
            <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={resetMapFilters}>
              {t("client.common.resetFilters")}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full px-4 pb-4 pt-6">
          <div className="h-[280px] rounded-2xl border border-white/10 bg-muted/20" />
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  );
}
