"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ArrowLeft, Bus, Car, ChevronRight, Crosshair, Filter, Footprints, LocateFixed, MapPin, Maximize2, Route, Search, X } from "lucide-react";
import { getActiveTwaSubscriptions, getCachedActiveTwaSubscriptions, getCachedTwaCompanies, getTwaCompanies, type TwaCompany, type TwaUserSubscription } from "@/lib/api/twa-client";
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

const YANDEX_MAPS_SCRIPT_ID = "yandex-maps-js-api-v3";
const YANDEX_MAP_CENTER: [number, number] = [37.6176, 55.7558];
const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4, 5, 6];

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
  | { type: "cluster"; id: string; points: PartnerMapPoint[]; longitude: number; latitude: number };

type MapLocationState = {
  center: [number, number];
  zoom: number;
};

type UserMapLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type RouteMode = "auto" | "pedestrian" | "transit";

const ROUTE_MODES: Array<{ key: RouteMode; labelKey: TranslationKey; yandex: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "auto", labelKey: "client.map.routeAuto", yandex: "auto", icon: Car },
  { key: "pedestrian", labelKey: "client.map.routeWalk", yandex: "pd", icon: Footprints },
  { key: "transit", labelKey: "client.map.routeTransit", yandex: "mt", icon: Bus },
];

type FullMapSheetLevel = "peek" | "half" | "expanded";

const FULL_MAP_SHEET_HEIGHT: Record<FullMapSheetLevel, string> = {
  peek: "58px",
  half: "42dvh",
  expanded: "78dvh",
};

declare global {
  interface Window {
    ymaps3?: YMaps3Api;
  }
}

function uniqueCompanyCategories(company: TwaCompany) {
  const bySlug = new Map([company.category, ...company.categories].filter(Boolean).map((category) => [category.slug, category]));
  return [...bySlug.values()];
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

function clusterCellSize(zoom: number, pointsCount: number) {
  if (zoom >= 14) return 0;
  if (zoom >= 13) return pointsCount >= 20 ? 0.012 : 0.008;
  if (zoom >= 12) return 0.018;
  if (zoom >= 11) return 0.04;
  if (zoom >= 10) return 0.075;
  return 0.14;
}

function buildMarkerItems(points: PartnerMapPoint[], selectedId: string | null, zoom = 11): MarkerItem[] {
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

function loadYandexMaps(apiKey: string): Promise<YMaps3Api> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser is required."));
  if (window.ymaps3) return window.ymaps3.ready.then(() => window.ymaps3 as YMaps3Api);

  const existingScript = document.getElementById(YANDEX_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript) {
    return new Promise((resolve, reject) => {
      const resolveWhenReady = () => {
        if (!window.ymaps3) {
          reject(new Error("Yandex Maps script loaded, but ymaps3 is not available. Check API key restrictions."));
          return;
        }
        void window.ymaps3.ready.then(() => resolve(window.ymaps3 as YMaps3Api)).catch(reject);
      };

      if (existingScript.dataset.loaded === "true") {
        resolveWhenReady();
        return;
      }

      existingScript.addEventListener("load", () => {
        existingScript.dataset.loaded = "true";
        resolveWhenReady();
      });
      existingScript.addEventListener("error", () => reject(new Error("Yandex Maps script failed to load.")));
    });
  }

  return new Promise((resolve, reject) => {
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
        cleanupDiagnostics();
        reject(new Error(`Yandex Maps script loaded, but ymaps3 is not available.${lastClientError ? ` Browser detail: ${lastClientError}` : ""}`));
        return;
      }
      void window.ymaps3.ready
        .then(() => resolve(window.ymaps3 as YMaps3Api))
        .catch((error: unknown) => {
          reject(error);
        })
        .finally(cleanupDiagnostics);
    };
    script.onerror = (event) => {
      cleanupDiagnostics();
      reject(new Error(`Yandex Maps script failed to load. ${describeScriptError(script.src, event)}`));
    };
    document.head.appendChild(script);
  });
}

async function loadYandexReactifiedMaps(apiKey: string): Promise<YandexReactifiedMaps> {
  const ymaps3 = await loadYandexMaps(apiKey);
  const { reactify } = await ymaps3.import<YandexReactifyPackage>("@yandex/ymaps3-reactify");
  const boundReactify = reactify.bindTo(React, ReactDOM);
  return { ...boundReactify.module(ymaps3), reactify: boundReactify };
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
  const animationFrameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<MapStatus>(() =>
    apiKey
      ? { state: "loading", message: t("client.map.yandexLoading") }
      : { state: "missing-key", message: t("client.map.yandexMissing") },
  );
  const markerItems = useMemo(() => buildMarkerItems(points, selectedId, mapLocation.zoom), [points, selectedId, mapLocation.zoom]);

  function stopMapAnimation() {
    if (animationFrameRef.current == null) return;
    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }

  function animateMapLocation(target: MapLocationState, duration = 560) {
    stopMapAnimation();
    const start = mapLocation;
    const startedAt = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setMapLocation(interpolateLocation(start, target, easeInOutCubic(progress)));
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
        setStatus({ state: "ready", message: interpolate(t("client.map.yandexReady"), { count: points.length }) });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setMaps(null);
          setStatus({
            state: "fallback",
            message: t("client.map.yandexFailed"),
            details: stringifyUnknownError(error),
          });
        }
      });

    return () => {
      disposed = true;
      stopMapAnimation();
    };
  }, [apiKey, points.length]);

  useEffect(() => {
    stopMapAnimation();
    if (!focusPoint) return;
    setMapLocation({
      center: [focusPoint.location.longitude, focusPoint.location.latitude],
      zoom: 15,
    });
  }, [focusPoint?.id]);

  useEffect(() => {
    if (!userLocation || nearMeFocusKey === 0) return;
    animateMapLocation(
      {
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 13,
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
      <div className={cn("relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/10 bg-muted/30", className)}>
        <YMap location={location} mode="vector">
          <YMapDefaultSchemeLayer />
          <YMapDefaultFeaturesLayer />
          <YMapListener
            onUpdate={(event) => {
              const nextCenter = event.location?.center;
              const nextZoom = event.location?.zoom;
              if (!nextCenter || typeof nextZoom !== "number") return;
              setMapLocation((prev) => {
                if (
                  Math.abs(prev.zoom - nextZoom) < 0.01 &&
                  Math.abs(prev.center[0] - nextCenter[0]) < 0.000001 &&
                  Math.abs(prev.center[1] - nextCenter[1]) < 0.000001
                ) {
                  return prev;
                }
                return { center: nextCenter, zoom: nextZoom };
              });
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
            if (item.type === "cluster") {
              return (
                <YMapMarker key={item.id} coordinates={[item.longitude, item.latitude]}>
                  <button
                    type="button"
                    onClick={() => {
                      onClusterPreview(item.points);
                      animateMapLocation({
                        center: [item.longitude, item.latitude],
                        zoom: Math.max(mapLocation.zoom + 2, 14),
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
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg bg-background/80 px-2 py-1.5 text-[10px] text-muted-foreground backdrop-blur">
            {interpolate(t("client.map.yandexFooter"), { count: points.length })}
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
  const [fullSheetLevel, setFullSheetLevel] = useState<FullMapSheetLevel>("peek");
  const fullSheetDragControls = useDragControls();
  const fullSheetDraggingRef = useRef(false);

  const settleFullMapSheet = (_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) => {
    const shouldExpand = info.offset.y < -38 || info.velocity.y < -420;
    const shouldCollapse = info.offset.y > 38 || info.velocity.y > 420;
    if (!shouldExpand && !shouldCollapse) return;

    setFullSheetLevel((current) => {
      if (shouldExpand) return current === "peek" ? "half" : "expanded";
      return current === "expanded" ? "half" : "peek";
    });
  };

  useEffect(() => {
    let ignore = false;
    const cachedCompanies = getCachedTwaCompanies();
    const cachedSubscriptions = getCachedActiveTwaSubscriptions();
    if (cachedCompanies.length) setCompanies(cachedCompanies);
    if (SUBSCRIPTIONS_ENABLED && cachedSubscriptions.length) setActiveSubscriptions(cachedSubscriptions);
    const requests = SUBSCRIPTIONS_ENABLED
      ? Promise.all([getTwaCompanies(), getActiveTwaSubscriptions()] as const)
      : Promise.all([getTwaCompanies(), Promise.resolve([] as TwaUserSubscription[])] as const);

    void requests.then(([data, subscriptions]) => {
      if (ignore) return;
      setCompanies(data);
      setActiveSubscriptions(subscriptions);
    });
    return () => {
      ignore = true;
    };
  }, []);

  function requestGeolocation() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      return;
    }
    setGeoStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
        setGeoStatus("ready");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
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
          <Link href="/map/full">
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/25">
          <CategoryIcon iconName={categoryIconName(selectedPoint)} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight">{selectedPartner.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-white/55">
                {selectedPoint.location.title ?? selectedPoint.location.city ?? t("client.map.partnerLocation")}
              </p>
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
          <p className="line-clamp-1 text-[11px] leading-relaxed text-white/68">{selectedPoint.location.address}</p>
          {selectedPartner.description && (
            <p className="line-clamp-1 text-[11px] leading-relaxed text-white/45">{selectedPartner.description}</p>
          )}
        </div>
      </div>
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
          <Link href={`/wallet/${selectedPartner.id}`}>
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
                <Link href="/map" aria-label={t("client.map.back")}>
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
          initial={{ y: 90, opacity: 0, height: FULL_MAP_SHEET_HEIGHT.half }}
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
                setFullSheetLevel((current) => (current === "expanded" ? "half" : current === "half" ? "peek" : "half"));
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
              <Link href="/map" aria-label={t("client.map.back")}>
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
                    <Link href={`/wallet/${selectedPartner.id}`}>
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
