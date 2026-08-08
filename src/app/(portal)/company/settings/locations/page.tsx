"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Crosshair,
  Globe2,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCcw,
  Save,
  Store,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";
import { getGeolocationPosition } from "@/lib/capacitor/native-permissions";
import {
  companyCreateCompanyLocation,
  companyLocations,
  companyProfile,
  updateCompanyProfile,
  type CompanyLocation,
  type CompanyProfile,
} from "@/lib/api/company-client";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useI18n } from "@/lib/i18n/use-i18n";

type Coordinates = { latitude: number; longitude: number };
type MapStatus = "idle" | "loading" | "ready" | "error";
type WorkMode = "PHYSICAL" | "ONLINE";
type LocationDraft = {
  title: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  openTime: string;
  closeTime: string;
  workingDays: number[];
  isMain: boolean;
};
type PendingPoint = Coordinates & { address: string; city: string };

type YandexV2Api = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>, settings?: Record<string, unknown>) => YandexMapInstance;
  Placemark: new (coords: [number, number], properties?: Record<string, unknown>, options?: Record<string, unknown>) => YandexPlacemark;
  geocode: (coords: [number, number] | string, options?: Record<string, unknown>) => Promise<YandexGeoResult>;
};

type YandexMapInstance = {
  events: { add: (event: string, callback: (event: YandexEvent) => void) => void };
  geoObjects: { add: (object: YandexPlacemark) => void };
  setCenter: (coords: [number, number], zoom?: number, options?: Record<string, unknown>) => void;
  destroy: () => void;
};

type YandexPlacemark = {
  geometry: {
    setCoordinates: (coords: [number, number]) => void;
    getCoordinates: () => [number, number];
  };
  properties: { set: (key: string, value: string) => void };
  events: { add: (event: string, callback: () => void) => void };
};

type YandexEvent = { get: (key: string) => [number, number] };
type YandexGeoObject = {
  getAddressLine?: () => string;
  getLocalities?: () => string[];
  getAdministrativeAreas?: () => string[];
};
type YandexGeoResult = {
  geoObjects: {
    get: (index: number) => YandexGeoObject | undefined;
  };
};

declare global {
  interface Window {
    ymaps?: YandexV2Api;
  }
}

const YANDEX_MAPS_V2_SCRIPT_ID = "nearloy-yandex-maps-v2";
const MOSCOW_CENTER: Coordinates = { latitude: 55.751244, longitude: 37.618423 };
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];
const WEEKDAY_OPTIONS: Array<{ value: number; labelKey: TranslationKey }> = [
  { value: 1, labelKey: "admin.companyDetail.weekdayMon" },
  { value: 2, labelKey: "admin.companyDetail.weekdayTue" },
  { value: 3, labelKey: "admin.companyDetail.weekdayWed" },
  { value: 4, labelKey: "admin.companyDetail.weekdayThu" },
  { value: 5, labelKey: "admin.companyDetail.weekdayFri" },
  { value: 6, labelKey: "admin.companyDetail.weekdaySat" },
  { value: 0, labelKey: "admin.companyDetail.weekdaySun" },
];

function loadYandexMapsV2(apiKey: string, lang: "ru_RU" | "en_US"): Promise<YandexV2Api> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser is required."));
  if (window.ymaps) {
    return new Promise((resolve) => window.ymaps?.ready(() => resolve(window.ymaps as YandexV2Api)));
  }

  const existing = document.getElementById(YANDEX_MAPS_V2_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => window.ymaps?.ready(() => resolve(window.ymaps as YandexV2Api)));
      existing.addEventListener("error", () => reject(new Error("Yandex Maps script failed to load.")));
      if (existing.dataset.loaded === "true" && window.ymaps) window.ymaps.ready(() => resolve(window.ymaps as YandexV2Api));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = YANDEX_MAPS_V2_SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=${lang}`;
    script.onload = () => {
      script.dataset.loaded = "true";
      if (!window.ymaps) {
        reject(new Error("Yandex Maps loaded, but ymaps is not available."));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps as YandexV2Api));
    };
    script.onerror = () => reject(new Error("Yandex Maps script failed to load."));
    document.head.appendChild(script);
  });
}

function locationCoords(location?: CompanyLocation | null): Coordinates | null {
  if (!location) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function toggleWeekday(days: number[], day: number) {
  const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
  return next.length ? next.sort((a, b) => a - b) : days;
}

function initialDraft(center: Coordinates): LocationDraft {
  return {
    title: "",
    city: "",
    address: "",
    latitude: center.latitude,
    longitude: center.longitude,
    openTime: "09:00",
    closeTime: "21:00",
    workingDays: DEFAULT_WORKING_DAYS,
    isMain: false,
  };
}

export default function CompanyLocationMapPage() {
  const { t, locale } = useI18n("ru");
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [locations, setLocations] = useState<CompanyLocation[]>([]);
  const [draft, setDraft] = useState<LocationDraft>(() => initialDraft(MOSCOW_CENTER));
  const [mapStatus, setMapStatus] = useState<MapStatus>("idle");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [modeSaving, setModeSaving] = useState<WorkMode | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("PHYSICAL");
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const ymapsRef = useRef<YandexV2Api | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const mapInitRef = useRef(0);
  const placemarkRef = useRef<YandexPlacemark | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [panelHasMore, setPanelHasMore] = useState(false);

  const mapCenter = useMemo(() => {
    const main = locations.find((location) => location.isMain);
    return locationCoords(main) ?? locationCoords(locations[0]) ?? MOSCOW_CENTER;
  }, [locations]);

  async function loadCompany() {
    try {
      const [profile, nextLocations] = await Promise.all([companyProfile(), companyLocations()]);
      setCompany(profile);
      setWorkMode(profile.company.operatesOnline ? "ONLINE" : "PHYSICAL");
      setLocations(nextLocations);
      const center = locationCoords(nextLocations.find((location) => location.isMain) ?? nextLocations[0]) ?? MOSCOW_CENTER;
      setDraft((prev) => ({ ...prev, latitude: center.latitude, longitude: center.longitude, isMain: nextLocations.length === 0 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.companyMap.loadFailed"));
    }
  }

  async function reverseGeocode(coords: Coordinates) {
    const ymaps = ymapsRef.current;
    if (!ymaps) return;
    setMessage(t("admin.companyMap.detectingAddress"));
    try {
      const result = await ymaps.geocode([coords.latitude, coords.longitude], { results: 1 });
      const geoObject = result.geoObjects.get(0);
      const address = geoObject?.getAddressLine?.() ?? "";
      const city = geoObject?.getLocalities?.()?.[0] ?? geoObject?.getAdministrativeAreas?.()?.[0] ?? "";
      placemarkRef.current?.properties.set("balloonContent", address || t("admin.companyMap.selectedPoint"));
      setPendingPoint({ ...coords, address, city });
      setMessage(address ? t("admin.companyMap.addressDetected") : t("admin.companyMap.pointSelected"));
    } catch (error) {
      setPendingPoint({ ...coords, address: "", city: "" });
      setMessage(error instanceof Error ? error.message : t("admin.companyMap.reverseFailed"));
    }
  }

  function moveMarker(coords: Coordinates, shouldGeocode = true) {
    placemarkRef.current?.geometry.setCoordinates([coords.latitude, coords.longitude]);
    mapRef.current?.setCenter([coords.latitude, coords.longitude], 16, { duration: 300 });
    if (shouldGeocode) void reverseGeocode(coords);
  }

  function confirmPendingPoint() {
    if (!pendingPoint) return;
    setDraft((prev) => ({
      ...prev,
      address: pendingPoint.address || prev.address,
      city: pendingPoint.city || prev.city,
      latitude: pendingPoint.latitude,
      longitude: pendingPoint.longitude,
    }));
    setMessage(t("admin.companyMap.pointConfirmed"));
    setPendingPoint(null);
  }

  function updatePanelScrollHint() {
    const panel = panelRef.current;
    if (!panel) return;
    const threshold = 8;
    setPanelHasMore(panel.scrollTop + panel.clientHeight < panel.scrollHeight - threshold);
  }

  useEffect(() => {
    void loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    const node = mapNodeRef.current;
    if (workMode === "ONLINE") return;
    if (!apiKey) {
      setMapStatus("error");
      setMessage(t("admin.companyMap.missingKey"));
      return;
    }
    if (!node || mapRef.current) return;

    const initId = ++mapInitRef.current;
    let disposed = false;
    setMapStatus("loading");
    void loadYandexMapsV2(apiKey, locale === "ru" ? "ru_RU" : "en_US")
      .then((ymaps) => {
        if (disposed || initId !== mapInitRef.current || mapRef.current) return;
        ymapsRef.current = ymaps;
        node.innerHTML = "";
        const map = new ymaps.Map(node, {
          center: [mapCenter.latitude, mapCenter.longitude],
          zoom: 14,
          controls: ["zoomControl", "geolocationControl", "typeSelector"],
        });
        const marker = new ymaps.Placemark(
          [mapCenter.latitude, mapCenter.longitude],
          { balloonContent: t("admin.companyMap.selectedPoint") },
          { draggable: true, preset: "islands#circleDotIcon", iconColor: "#9ff6ff" },
        );
        map.geoObjects.add(marker);
        map.events.add("click", (event) => {
          const [latitude, longitude] = event.get("coords");
          moveMarker({ latitude, longitude });
        });
        marker.events.add("dragend", () => {
          const [latitude, longitude] = marker.geometry.getCoordinates();
          moveMarker({ latitude, longitude });
        });
        mapRef.current = map;
        placemarkRef.current = marker;
        setMapStatus("ready");
      })
      .catch((error: unknown) => {
        setMapStatus("error");
        setMessage(error instanceof Error ? error.message : t("admin.companyMap.mapFailed"));
      });

    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
      placemarkRef.current = null;
      node.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, workMode]);

  useEffect(() => {
    if (!mapRef.current || !placemarkRef.current) return;
    moveMarker(mapCenter, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapCenter.latitude, mapCenter.longitude]);

  useEffect(() => {
    updatePanelScrollHint();
  }, [locations.length, message, draft.address, draft.workingDays.length, pendingPoint]);

  async function useMyLocation() {
    setMessage(t("admin.companyMap.detectingPosition"));
    try {
      const position = await getGeolocationPosition({ enableHighAccuracy: true, timeout: 10000 });
      moveMarker({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (error) {
      setMessage(error instanceof Error && error.message === "geolocation-unavailable"
        ? t("admin.companyMap.geoUnavailable")
        : t("admin.companyMap.geoDenied"));
    }
  }

  async function saveLocation() {
    if (!draft.address.trim()) {
      setMessage(t("admin.companyDetail.locationAddressRequired"));
      return;
    }
    setSaving(true);
    setMessage("");
    const result = await companyCreateCompanyLocation({
      title: draft.title.trim() || undefined,
      city: draft.city.trim() || undefined,
      address: draft.address.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      openTime: draft.openTime,
      closeTime: draft.closeTime,
      workingDays: draft.workingDays,
      isMain: draft.isMain,
      isActive: true,
    });
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(t("admin.companyMap.saved"));
    setDraft(initialDraft({ latitude: draft.latitude, longitude: draft.longitude }));
    await loadCompany();
  }

  const currentCompany = company?.company;
  const canManage = Boolean(company && company.member.role !== "CASHIER");
  const modeCopy = locale === "ru"
    ? {
        title: "Адреса или онлайн",
        description: "Выберите формат работы: точки на карте или онлайн-компания без публичного адреса.",
        physicalTitle: "Физические точки",
        physicalHint: "Показываем адреса на карте, клиенты строят маршрут и видят часы работы.",
        onlineTitle: "Онлайн-формат",
        onlineHint: "Компания работает без публичной точки: доставка, выездной сервис или digital-услуги.",
        active: "Выбрано",
        saveOnline: "Включить онлайн",
        savePhysical: "Работать по адресам",
        onlineSaved: "Онлайн-формат сохранён. Компания может быть активна без точки на карте.",
        physicalSaved: "Формат с адресами сохранён. Добавьте хотя бы одну точку, чтобы компания появилась на карте.",
        onlineStatusTitle: "Онлайн-позиционирование включено",
        onlineStatusHint: "Физические адреса можно добавить позже. Сейчас клиенты увидят компанию как онлайн-сервис.",
        savedAddresses: "Сохранённые адреса",
        noAddresses: "Адресов пока нет.",
      }
    : {
        title: "Locations or online",
        description: "Choose how the company works: map locations or an online company without a public address.",
        physicalTitle: "Physical locations",
        physicalHint: "Show addresses on the map, routes and working hours.",
        onlineTitle: "Online mode",
        onlineHint: "For delivery, on-site services or digital companies without a public point.",
        active: "Selected",
        saveOnline: "Enable online",
        savePhysical: "Use locations",
        onlineSaved: "Online mode is saved. The company can be active without a map location.",
        physicalSaved: "Location mode is saved. Add at least one point so the company appears on the map.",
        onlineStatusTitle: "Online positioning enabled",
        onlineStatusHint: "Physical addresses can be added later. Customers will see this company as an online service.",
        savedAddresses: "Saved addresses",
        noAddresses: "No addresses yet.",
      };

  async function saveWorkMode(mode: WorkMode) {
    if (!currentCompany || !canManage) return;
    setModeSaving(mode);
    setMessage("");
    try {
      const updated = await updateCompanyProfile({
        name: currentCompany.name,
        slug: currentCompany.slug,
        description: currentCompany.description ?? "",
        operatesOnline: mode === "ONLINE",
        categoryIds: currentCompany.categories.map((category) => category.id),
        isActive: currentCompany.isActive,
      });
      setCompany(updated);
      setWorkMode(mode);
      setMessage(mode === "ONLINE" ? modeCopy.onlineSaved : modeCopy.physicalSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update company mode.");
    } finally {
      setModeSaving(null);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col gap-3 overflow-visible pb-4 xl:overflow-hidden">
      <section className="shrink-0 rounded-[1.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(159,246,255,0.12),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:rounded-3xl sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <Button asChild variant="secondary" className="h-10 shrink-0 rounded-2xl px-3">
              <Link href="/company/settings">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("admin.companyMap.back")}</span>
              </Link>
            </Button>
            <Badge variant="outline" className="shrink-0 border-cyan-200/30 bg-cyan-200/10 text-cyan-50">
              <MapPin className="h-3.5 w-3.5" />
              {t("admin.companyMap.badge")}
            </Badge>
            <Badge variant="secondary" className="min-w-0 gap-2">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate">{currentCompany?.name ?? t("admin.companyDetail.notSet")}</span>
            </Badge>
            <Badge variant="secondary" className="hidden gap-2 sm:inline-flex">
              <Navigation className="h-3.5 w-3.5" />
              {locations.length} {t("admin.companyDetail.savedCount")}
            </Badge>
          </div>
          <Button type="button" variant="secondary" onClick={() => void loadCompany()} className="h-10 shrink-0 rounded-2xl px-3">
            <RefreshCcw className="h-4 w-4" />
            <span className="hidden sm:inline">{t("admin.companyMap.refresh")}</span>
          </Button>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{modeCopy.title}</h1>
            <p className="mt-1 line-clamp-2 max-w-4xl text-xs leading-5 text-muted-foreground sm:text-sm">{modeCopy.description}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 gap-2 sm:hidden">
            <Navigation className="h-3.5 w-3.5" />
            {locations.length}
          </Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
          <button
            type="button"
            disabled={!canManage || modeSaving !== null}
            onClick={() => void saveWorkMode("PHYSICAL")}
            className={cn(
              "group rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-200/[0.07] sm:rounded-3xl sm:p-4",
              workMode === "PHYSICAL" ? "border-cyan-200/35 bg-cyan-200/[0.09]" : "border-white/10 bg-black/20",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-50 sm:h-12 sm:w-12">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <p className="text-sm font-semibold leading-tight sm:text-lg">{modeCopy.physicalTitle}</p>
                  {workMode === "PHYSICAL" && <Badge variant="outline">{modeCopy.active}</Badge>}
                </div>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{modeCopy.physicalHint}</p>
                <span className="mt-3 hidden items-center gap-2 text-sm font-semibold text-cyan-50 sm:inline-flex">
                  {modeSaving === "PHYSICAL" ? t("admin.companyMap.saving") : modeCopy.savePhysical}
                  <Navigation className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
          <button
            type="button"
            disabled={!canManage || modeSaving !== null}
            onClick={() => void saveWorkMode("ONLINE")}
            className={cn(
              "group rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-200/[0.07] sm:rounded-3xl sm:p-4",
              workMode === "ONLINE" ? "border-emerald-300/35 bg-emerald-300/[0.08]" : "border-white/10 bg-black/20",
            )}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/25 bg-emerald-200/10 text-emerald-50 sm:h-12 sm:w-12">
                <Globe2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <p className="text-sm font-semibold leading-tight sm:text-lg">{modeCopy.onlineTitle}</p>
                  {workMode === "ONLINE" && <Badge variant="outline">{modeCopy.active}</Badge>}
                </div>
                <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{modeCopy.onlineHint}</p>
                <span className="mt-3 hidden items-center gap-2 text-sm font-semibold text-emerald-50 sm:inline-flex">
                  {modeSaving === "ONLINE" ? t("admin.companyMap.saving") : modeCopy.saveOnline}
                  <Navigation className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
        </div>
        {workMode === "PHYSICAL" && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="mb-3 grid gap-2 sm:flex sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t("admin.companyMap.formTitle")}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{t("admin.companyMap.formHint")}</p>
            </div>
            <Button type="button" variant="secondary" onClick={useMyLocation} className="h-11 w-full rounded-2xl sm:w-auto">
              <LocateFixed className="h-4 w-4" />
              {t("admin.companyMap.useMyLocation")}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
            <div className="col-span-2 space-y-1 sm:col-span-1 lg:col-span-2">
              <Label htmlFor="map-title">{t("admin.companyDetail.locationLabel")}</Label>
              <Input id="map-title" value={draft.title} maxLength={80} placeholder={t("admin.companyDetail.locationLabelPlaceholder")} onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))} />
            </div>
            <div className="col-span-2 space-y-1 lg:col-span-5">
              <Label htmlFor="map-address">{t("admin.companyDetail.address")}</Label>
              <Input id="map-address" value={draft.address} maxLength={240} placeholder={t("admin.companyDetail.addressPlaceholder")} onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <Label htmlFor="map-city">{t("admin.companyDetail.city")}</Label>
              <Input id="map-city" value={draft.city} readOnly maxLength={80} placeholder={t("admin.companyDetail.cityPlaceholder")} className="cursor-default bg-white/[0.03] text-muted-foreground" />
            </div>
            <div className="space-y-1 lg:col-span-3">
              <Label htmlFor="map-main">{t("admin.companyDetail.mainLocation")}</Label>
              <SelectField id="map-main" value={draft.isMain ? "yes" : "no"} onChange={(event) => setDraft((prev) => ({ ...prev, isMain: event.target.value === "yes" }))}>
                <option value="no">{t("admin.companyMap.notMain")}</option>
                <option value="yes">{t("admin.companyDetail.mainLocationSelected")}</option>
              </SelectField>
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2 lg:col-span-3">
              <div className="space-y-1">
                <Label htmlFor="map-open" className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.openTime")}
                </Label>
                <Input id="map-open" type="time" value={draft.openTime} onChange={(event) => setDraft((prev) => ({ ...prev, openTime: event.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="map-close" className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  {t("admin.companyDetail.closeTime")}
                </Label>
                <Input id="map-close" type="time" value={draft.closeTime} onChange={(event) => setDraft((prev) => ({ ...prev, closeTime: event.target.value }))} />
              </div>
            </div>
            <div className="col-span-2 space-y-1 lg:col-span-6">
              <Label>{t("admin.companyDetail.workingDays")}</Label>
              <div className="flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-black/20 p-2">
                {WEEKDAY_OPTIONS.map((day) => (
                  <Button
                    key={day.value}
                    type="button"
                    size="sm"
                    variant={draft.workingDays.includes(day.value) ? "default" : "secondary"}
                    className="h-8 min-w-9 px-2 text-xs"
                    onClick={() => setDraft((prev) => ({ ...prev, workingDays: toggleWeekday(prev.workingDays, day.value) }))}
                  >
                    {t(day.labelKey)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="col-span-2 flex items-end lg:col-span-3">
              <Button type="button" className="h-11 w-full justify-center rounded-2xl" disabled={saving || !draft.address.trim()} onClick={() => void saveLocation()}>
                <Save className="h-4 w-4" />
                {saving ? t("admin.companyMap.saving") : t("admin.companyMap.savePoint")}
              </Button>
            </div>
          </div>
          {message && (
            <div className={cn("mt-3 rounded-2xl border p-3 text-sm", message.includes("failed") || message.includes("Error") ? "border-red-300/30 bg-red-950/20 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-50")}>{message}</div>
          )}
        </div>
        )}
        {workMode === "ONLINE" && (
          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.16),transparent_34%),rgba(16,185,129,0.05)] p-4 sm:rounded-3xl sm:p-5">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/25 bg-emerald-200/10 text-emerald-50 sm:h-12 sm:w-12">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-base font-semibold sm:text-lg">{modeCopy.onlineStatusTitle}</p>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{modeCopy.onlineStatusHint}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:rounded-3xl sm:p-5">
              <p className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="h-5 w-5 text-primary" />
                {modeCopy.savedAddresses}
              </p>
              <div className="mt-4 space-y-2">
                {locations.length === 0 && <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">{modeCopy.noAddresses}</p>}
                {locations.slice(0, 4).map((location) => (
                  <div key={location.uuid} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{location.title || location.city || t("admin.companyDetail.locationLabel")}</p>
                      {location.isMain && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{location.address}</p>
                  </div>
                ))}
              </div>
            </div>
            {message && (
              <div className={cn("rounded-2xl border p-3 text-sm lg:col-span-2", message.includes("failed") || message.includes("Error") ? "border-red-300/30 bg-red-950/20 text-red-100" : "border-cyan-200/20 bg-cyan-200/10 text-cyan-50")}>{message}</div>
            )}
          </div>
        )}
      </section>

      {workMode === "PHYSICAL" && (
      <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="relative min-h-0 overflow-hidden rounded-[1.5rem] border-white/10 bg-muted/10 sm:rounded-3xl">
          <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 rounded-2xl border border-black/10 bg-black/55 p-3 text-sm shadow-2xl backdrop-blur-xl sm:left-4 sm:right-auto sm:max-w-md">
            <div className="flex items-center gap-2 font-semibold">
              <Crosshair className="h-4 w-4 text-primary" />
              {t("admin.companyMap.mapTitle")}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-white/70">{t("admin.companyMap.mapHint")}</p>
          </div>
          <CardContent className="p-0">
            <div ref={mapNodeRef} className="h-[360px] min-h-[360px] w-full bg-[radial-gradient(circle_at_center,rgba(159,246,255,0.12),transparent_35%),#080b10] sm:h-[460px] sm:min-h-[460px] xl:h-[calc(100vh-330px)] xl:min-h-[560px]" />
            {mapStatus !== "ready" && (
              <div className="absolute bottom-4 left-4 right-4 z-10 rounded-2xl border border-white/10 bg-black/70 p-3 text-sm text-muted-foreground backdrop-blur-xl">
                {mapStatus === "loading" ? t("admin.companyMap.loadingMap") : message || t("admin.companyMap.mapIdle")}
              </div>
            )}
          </CardContent>
          {pendingPoint && (
            <div className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl border border-cyan-200/25 bg-black/82 p-3 shadow-[0_24px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:bottom-4 sm:left-4 sm:right-4 sm:rounded-3xl sm:p-4 md:left-1/2 md:right-auto md:w-[520px] md:-translate-x-1/2">
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">{t("admin.companyMap.selectedAddressLabel")}</p>
              <p className="mt-2 line-clamp-2 text-base font-semibold text-white sm:text-lg">{pendingPoint.address || t("admin.companyMap.addressNotFound")}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {pendingPoint.latitude.toFixed(6)}, {pendingPoint.longitude.toFixed(6)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
                <Button type="button" onClick={confirmPendingPoint} disabled={!pendingPoint.address} className="rounded-2xl">
                  <CheckCircle2 className="h-4 w-4" />
                  {t("admin.companyMap.confirmAddress")}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setPendingPoint(null)} className="rounded-2xl">
                  {t("admin.companyMap.cancelAddress")}
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="relative min-h-0 xl:h-[calc(100vh-330px)] xl:min-h-[560px]">
          <aside
            ref={panelRef}
            onScroll={updatePanelScrollHint}
            className="map-picker-scroll h-full min-h-0 space-y-3 overflow-visible rounded-[1.5rem] border border-white/10 bg-black/20 p-3 xl:space-y-4 xl:overflow-y-auto xl:rounded-3xl"
          >
          <Card className="rounded-2xl border-white/10 bg-muted/10 px-2 py-3 sm:px-4 sm:py-4">
            <CardHeader className="px-3 pb-3 pt-1 sm:pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5 text-primary" />
                {t("admin.companyMap.savedTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3 pt-0 sm:space-y-3">
              {locations.length === 0 && <p className="text-sm text-muted-foreground">{t("admin.companyDetail.noAddresses")}</p>}
              {locations.map((location) => {
                const coords = locationCoords(location);
                return (
                  <button
                    key={location.uuid}
                    type="button"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.07]"
                    onClick={() => coords && moveMarker(coords, false)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{location.title || location.city || t("admin.companyDetail.locationLabel")}</p>
                      {location.isMain && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{location.address}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
          </aside>
          {panelHasMore && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden justify-center rounded-b-3xl bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-16 xl:flex">
              <div className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-50 shadow-[0_0_40px_rgba(159,246,255,0.22)] backdrop-blur-xl">
                {t("admin.companyMap.scrollHint")}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      <style jsx global>{`
        .map-picker-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .map-picker-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
