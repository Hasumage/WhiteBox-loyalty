"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Coffee, Dumbbell, HeartPulse, ImagePlus, ListFilter, LocateFixed, Map, MapPin, Music, Navigation, PenLine, Send, ShoppingBag, Sparkles, Tag, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createHuntPost, geocodeHuntAddress, uploadHuntMedia } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils";
import { huntInteractiveClass, mediaSrc, NearloyStars } from "../_components/hunt-ui";

const MAX_PHOTOS = 3;
const MAX_ACCEPTED_LOCATION_ACCURACY_METERS = 5000;
const MOSCOW_CENTER = { latitude: 55.751244, longitude: 37.618423 };
const YANDEX_MAPS_V2_SCRIPT_ID = "nearloy-yandex-maps-v2";

type Coordinates = { latitude: number; longitude: number };
type AttachedPosition = Coordinates & { accuracy?: number; source: "browser" | "map" };
type MapStatus = "idle" | "loading" | "ready" | "error";
type YandexV2Api = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: Record<string, unknown>, settings?: Record<string, unknown>) => YandexMapInstance;
  Placemark: new (coords: [number, number], properties?: Record<string, unknown>, options?: Record<string, unknown>) => YandexPlacemark;
  geocode: (coords: [number, number] | string, options?: Record<string, unknown>) => Promise<YandexGeoResult>;
};
type YandexMapInstance = {
  container: { fitToViewport: () => void };
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
  events: { add: (event: string, callback: () => void) => void };
};
type YandexEvent = { get: (key: string) => [number, number] };
type YandexGeoObject = { getAddressLine?: () => string };
type YandexGeoResult = { geoObjects: { get: (index: number) => YandexGeoObject | undefined } };

const categoryOptions = [
  { slug: "coffee", icon: Coffee, labelKey: "client.categoryName.coffee" },
  { slug: "food", icon: UtensilsCrossed, labelKey: "client.categoryName.food" },
  { slug: "fitness", icon: Dumbbell, labelKey: "client.categoryName.fitness" },
  { slug: "beauty", icon: Sparkles, labelKey: "client.categoryName.beauty" },
  { slug: "retail", icon: ShoppingBag, labelKey: "client.categoryName.retail" },
  { slug: "health", icon: HeartPulse, labelKey: "client.categoryName.health" },
  { slug: "entertainment", icon: Music, labelKey: "client.categoryName.entertainment" },
] satisfies Array<{ slug: string; icon: typeof Coffee; labelKey: TranslationKey }>;

const steps = [
  { id: 0, icon: MapPin, labelKey: "client.hunt.create.stepPlace", titleKey: "client.hunt.create.placeTitle", subtitleKey: "client.hunt.create.placeSubtitle" },
  { id: 1, icon: ImagePlus, labelKey: "client.hunt.create.stepMedia", titleKey: "client.hunt.create.mediaTitle", subtitleKey: "client.hunt.create.mediaSubtitle" },
  { id: 2, icon: PenLine, labelKey: "client.hunt.create.stepStory", titleKey: "client.hunt.create.storyTitle", subtitleKey: "client.hunt.create.storySubtitle" },
] satisfies Array<{ id: number; icon: typeof MapPin; labelKey: TranslationKey; titleKey: TranslationKey; subtitleKey: TranslationKey }>;

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

function splitList(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean);
}

function loadYandexMapsV2(apiKey: string, lang: "ru_RU" | "en_US"): Promise<YandexV2Api> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser is required."));
  const yandexWindow = window as Window & { ymaps?: YandexV2Api };
  if (yandexWindow.ymaps) {
    return new Promise((resolve) => yandexWindow.ymaps?.ready(() => resolve(yandexWindow.ymaps as YandexV2Api)));
  }

  const existing = document.getElementById(YANDEX_MAPS_V2_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => yandexWindow.ymaps?.ready(() => resolve(yandexWindow.ymaps as YandexV2Api)));
      existing.addEventListener("error", () => reject(new Error("Yandex Maps script failed to load.")));
      if (existing.dataset.loaded === "true" && yandexWindow.ymaps) yandexWindow.ymaps.ready(() => resolve(yandexWindow.ymaps as YandexV2Api));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = YANDEX_MAPS_V2_SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=${lang}`;
    script.onload = () => {
      script.dataset.loaded = "true";
      if (!yandexWindow.ymaps) {
        reject(new Error("Yandex Maps loaded, but ymaps is not available."));
        return;
      }
      yandexWindow.ymaps.ready(() => resolve(yandexWindow.ymaps as YandexV2Api));
    };
    script.onerror = () => reject(new Error("Yandex Maps script failed to load."));
    document.head.appendChild(script);
  });
}

export default function HuntCreatePage() {
  const { t, locale } = useI18n("ru");
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapStatus, setMapStatus] = useState<MapStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["coffee"]);
  const [position, setPosition] = useState<AttachedPosition | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState<{ input: string; address: string; latitude: number; longitude: number; precision: string | null } | null>(null);
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const ymapsRef = useRef<YandexV2Api | null>(null);
  const yandexMapRef = useRef<YandexMapInstance | null>(null);
  const yandexPlacemarkRef = useRef<YandexPlacemark | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    placeName: "",
    address: "",
    rating: "5",
    caption: "",
    vibeTags: "уютно, полезно",
  });

  const currentStep = steps[step];
  const StepIcon = currentStep.icon;
  const categoryLabel = selectedCategories.length
    ? selectedCategories.map((slug) => t(categoryOptions.find((category) => category.slug === slug)?.labelKey ?? "client.hunt.create.category")).join(", ")
    : t("client.hunt.create.noCategories");
  const addressNeedsCheck = form.address.trim().length > 0 && geocodedAddress?.input !== form.address.trim();
  const canGoNext = step === 0 ? !addressNeedsCheck : step === 1 ? photos.length > 0 : form.caption.trim().length >= 12;

  async function applyMapPosition(coords: Coordinates, reverseGeocode = true) {
    setPosition({ ...coords, accuracy: 25, source: "map" });
    setGeocodedAddress(null);
    yandexPlacemarkRef.current?.geometry.setCoordinates([coords.latitude, coords.longitude]);
    yandexMapRef.current?.setCenter([coords.latitude, coords.longitude], 16, { duration: 250 });

    if (!reverseGeocode || !ymapsRef.current) {
      setNotice(t("client.hunt.create.mapPointSelected"));
      return;
    }

    try {
      const result = await ymapsRef.current.geocode([coords.latitude, coords.longitude], { results: 1 });
      const address = result.geoObjects.get(0)?.getAddressLine?.();
      if (address) {
        setForm((current) => ({ ...current, address }));
        setGeocodedAddress({ input: address, address, latitude: coords.latitude, longitude: coords.longitude, precision: "exact" });
      }
      setNotice(t("client.hunt.create.mapPointSelected"));
    } catch {
      setNotice(t("client.hunt.create.mapPointSelected"));
    }
  }

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
    const node = mapHostRef.current;
    if (!apiKey) {
      setMapStatus("error");
      return;
    }
    if (!node || yandexMapRef.current) return;

    let disposed = false;
    setMapStatus("loading");
    void loadYandexMapsV2(apiKey, locale === "ru" ? "ru_RU" : "en_US")
      .then((ymaps) => {
        if (disposed || yandexMapRef.current) return;
        ymapsRef.current = ymaps;
        const start = position ?? MOSCOW_CENTER;
        const map = new ymaps.Map(node, {
          center: [start.latitude, start.longitude],
          zoom: 12,
          controls: ["zoomControl", "geolocationControl"],
        });
        const marker = new ymaps.Placemark(
          [start.latitude, start.longitude],
          {},
          { draggable: true, preset: "islands#circleDotIcon", iconColor: "#9ff6ff" },
        );
        map.geoObjects.add(marker);
        map.events.add("click", (event) => {
          const [latitude, longitude] = event.get("coords");
          void applyMapPosition({ latitude, longitude });
        });
        marker.events.add("dragend", () => {
          const [latitude, longitude] = marker.geometry.getCoordinates();
          void applyMapPosition({ latitude, longitude });
        });
        yandexMapRef.current = map;
        yandexPlacemarkRef.current = marker;
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("error"));

    return () => {
      disposed = true;
      yandexMapRef.current?.destroy();
      yandexMapRef.current = null;
      yandexPlacemarkRef.current = null;
      ymapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (!mapOpen) return;
    window.setTimeout(() => yandexMapRef.current?.container.fitToViewport(), 60);
  }, [mapOpen]);

  function updateAddress(address: string) {
    setForm((current) => ({ ...current, address }));
    setGeocodedAddress(null);
  }

  function toggleCategory(slug: string) {
    setSelectedCategories((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  }

  async function attachLocation() {
    setNotice(null);
    if (!("geolocation" in navigator)) {
      setNotice(t("client.hunt.create.geoUnavailable"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (value) => {
        const accuracy = Math.round(value.coords.accuracy);
        if (!Number.isFinite(accuracy) || accuracy > MAX_ACCEPTED_LOCATION_ACCURACY_METERS) {
          setPosition(null);
          setNotice(fill(t("client.hunt.create.geoTooRough"), { accuracy: Number.isFinite(accuracy) ? accuracy : "?" }));
          setLocating(false);
          return;
        }
        const nextPosition = { latitude: value.coords.latitude, longitude: value.coords.longitude, accuracy, source: "browser" as const };
        setPosition(nextPosition);
        yandexPlacemarkRef.current?.geometry.setCoordinates([nextPosition.latitude, nextPosition.longitude]);
        yandexMapRef.current?.setCenter([nextPosition.latitude, nextPosition.longitude], 16, { duration: 250 });
        setNotice(t("client.hunt.create.geoAttached"));
        setLocating(false);
      },
      () => {
        setNotice(t("client.hunt.create.geoFailed"));
        setPosition(null);
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 8000 },
    );
  }

  async function checkAddress() {
    const address = form.address.trim();
    if (!address) return;
    setGeocoding(true);
    setNotice(null);
    const result = await geocodeHuntAddress({ address });
    if (result.ok) {
      setForm((current) => ({ ...current, address: result.data.address }));
      setGeocodedAddress({ input: result.data.address, address: result.data.address, latitude: result.data.latitude, longitude: result.data.longitude, precision: result.data.precision });
      setNotice(t("client.hunt.create.geocoded"));
    } else {
      setGeocodedAddress(null);
      setNotice(result.message);
    }
    setGeocoding(false);
  }

  async function uploadMedia(files: FileList | null) {
    const queue = Array.from(files ?? []).slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    if (queue.length === 0) return;
    setUploadingMedia(true);
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
        setPhotos((current) => [...current, result.data.url].slice(0, MAX_PHOTOS));
      } else {
        setNotice(result.message);
        break;
      }
    }
    setUploadingMedia(false);
  }

  async function submitPost() {
    if (busy) return;
    if (photos.length === 0) {
      setNotice(t("client.hunt.create.photoRequired"));
      setStep(1);
      return;
    }
    setBusy(true);
    setNotice(null);
    const resolvedLatitude = geocodedAddress?.latitude ?? position?.latitude;
    const resolvedLongitude = geocodedAddress?.longitude ?? position?.longitude;
    const result = await createHuntPost({
      placeName: form.placeName.trim() || undefined,
      address: form.address.trim() || undefined,
      categorySlug: selectedCategories[0],
      caption: form.caption,
      photoUrl: photos[0],
      mediaUrls: photos,
      rating: Number(form.rating) || undefined,
      tags: selectedCategories,
      moodTags: splitList(form.vibeTags),
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
      locationAccuracy: geocodedAddress ? undefined : position?.accuracy,
    });
    if (result.ok) {
      setNotice(fill(t("client.hunt.create.published"), { reward: 35 }));
      setForm((current) => ({ ...current, caption: "" }));
      setPhotos([]);
    } else {
      setNotice(result.message);
    }
    setBusy(false);
  }

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/hunt" className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/70", huntInteractiveClass)}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">{t("client.hunt.createPost")}</Badge>
      </header>

      <section className="mb-4 rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(8,13,22,0.94),rgba(15,23,42,0.72))] p-4">
        <div className="grid grid-cols-3 gap-2">
          {steps.map(({ id, icon: Icon, labelKey }) => (
            <button key={id} type="button" onClick={() => setStep(id)} className={cn("rounded-2xl border px-2 py-3 text-xs font-semibold", huntInteractiveClass, step === id ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-white/60")}>
              <Icon className="mx-auto mb-1 h-4 w-4" />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>

      {notice && <div className="mb-4 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-sm text-cyan-50">{notice}</div>}

      <Card className="border-white/10 bg-slate-950/70 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <StepIcon className="h-4 w-4 text-cyan-200" />
            {t(currentStep.labelKey)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="hunt-place-name" className="text-xs text-white/58">{t("client.hunt.create.placeNameOptional")}</Label>
                <Input id="hunt-place-name" placeholder={t("client.hunt.create.placeNamePlaceholder")} value={form.placeName} onChange={(event) => setForm({ ...form, placeName: event.target.value })} className="bg-white/[0.04]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hunt-address" className="text-xs text-white/58">{t("client.hunt.create.addressLabel")}</Label>
                <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                  <Input id="hunt-address" placeholder={t("client.hunt.create.address")} value={form.address} onChange={(event) => updateAddress(event.target.value)} className="bg-white/[0.04]" />
                  <Button type="button" variant="outline" disabled={!form.address.trim() || geocoding} onClick={checkAddress} className={cn("rounded-2xl border-cyan-200/20 bg-cyan-200/10 px-3 text-cyan-50 hover:bg-cyan-200/15", huntInteractiveClass)}>
                    {geocoding ? <Navigation className="h-4 w-4 animate-pulse" /> : geocodedAddress ? <CheckCircle2 className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMapOpen(true)} className={cn("rounded-2xl border-white/10 bg-white/[0.04] px-3 text-white/70 hover:bg-white/[0.07]", huntInteractiveClass)} aria-label={t("client.hunt.create.openMap")}>
                    <Map className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setCategoryOpen(true)} className={cn("w-full justify-between rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]", huntInteractiveClass)}>
                <span className="flex min-w-0 items-center gap-2">
                  <ListFilter className="h-4 w-4 text-cyan-200" />
                  <span className="truncate">{t("client.hunt.create.chooseCategories")}</span>
                </span>
                <span className="max-w-[48%] truncate text-xs text-white/52">{categoryLabel}</span>
              </Button>
              <Button type="button" variant="outline" onClick={attachLocation} disabled={locating} className={cn("w-full justify-between rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]", huntInteractiveClass, position && "border-cyan-200/25 bg-cyan-200/10 text-cyan-50")}>
                <span className="flex items-center gap-2">
                  <LocateFixed className="h-4 w-4 text-cyan-200" />
                  {position ? (position.source === "map" ? t("client.hunt.create.mapPointAttached") : t("client.hunt.create.geoAttached")) : locating ? t("client.hunt.create.geoLocating") : t("client.hunt.create.attachGeo")}
                </span>
                {position?.accuracy && position.source === "browser" ? <span className="text-xs text-white/52">~{position.accuracy}m</span> : <Navigation className="h-4 w-4 text-white/35" />}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
                <NearloyStars value={Number(form.rating)} onChange={(rating) => setForm({ ...form, rating: String(rating) })} ariaLabel={t("client.hunt.create.rating")} />
              </div>
              <input ref={fileInputRef} multiple type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { void uploadMedia(event.target.files); event.currentTarget.value = ""; }} />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia || photos.length >= MAX_PHOTOS} className={cn("w-full rounded-2xl border-cyan-200/20 bg-cyan-200/10 text-cyan-50 hover:bg-cyan-200/15", huntInteractiveClass)}>
                <Camera className="mr-2 h-4 w-4" />
                {uploadingMedia ? t("client.hunt.create.uploading") : fill(t("client.hunt.create.addPhotos"), { count: photos.length, max: MAX_PHOTOS })}
              </Button>
              {photos.length === 0 && <p className="text-xs text-white/48">{t("client.hunt.create.photoRequired")}</p>}
              <div className="grid gap-2">
                {photos.map((photo, index) => (
                  <div key={photo} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                    <img src={mediaSrc(photo) ?? ""} alt="" className="h-36 w-full object-cover" />
                    <button type="button" onClick={() => setPhotos((current) => current.filter((item) => item !== photo))} className={cn("absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white", huntInteractiveClass)} aria-label={t("client.hunt.create.removePhoto")}>
                      <span className="text-xs">{index + 1}</span>
                      <Trash2 className="ml-1 h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Textarea placeholder={t("client.hunt.create.caption")} value={form.caption} onChange={(event) => setForm({ ...form, caption: event.target.value })} className="min-h-32 bg-white/[0.04]" />
              <div className="space-y-2">
                <Label htmlFor="hunt-vibe" className="flex items-center gap-2 text-xs text-white/58">
                  <Tag className="h-4 w-4 text-cyan-200" />
                  {t("client.hunt.create.vibeLabel")}
                </Label>
                <Input id="hunt-vibe" placeholder={t("client.hunt.create.vibePlaceholder")} value={form.vibeTags} onChange={(event) => setForm({ ...form, vibeTags: event.target.value })} className="bg-white/[0.04]" />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button type="button" variant="secondary" className={cn("rounded-2xl", huntInteractiveClass)} disabled={step === 0 || busy} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("client.hunt.create.back")}
            </Button>
            {step < steps.length - 1 ? (
              <Button type="button" className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} disabled={!canGoNext} onClick={() => setStep((current) => current + 1)}>
                {t("client.hunt.create.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} disabled={!canGoNext || busy} onClick={submitPost}>
                {busy ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {t("client.hunt.create.publish")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListFilter className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.create.categoriesTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {categoryOptions.map((category) => {
              const Icon = category.icon;
              const active = selectedCategories.includes(category.slug);
              return (
                <button key={category.slug} type="button" onClick={() => toggleCategory(category.slug)} className={cn("flex items-center justify-between rounded-2xl border px-3 py-3 text-left text-sm", huntInteractiveClass, active ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/[0.04] text-white/74")}>
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t(category.labelKey)}
                  </span>
                  {active ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4 text-white/25" />}
                </button>
              );
            })}
          </div>
          <Button type="button" onClick={() => setCategoryOpen(false)} className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>{t("client.hunt.create.categoriesDone")}</Button>
        </DialogContent>
      </Dialog>

      <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 backdrop-blur transition", mapOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")} aria-hidden={!mapOpen}>
        <div className="w-full max-w-[640px] rounded-3xl border border-white/10 bg-slate-950 p-4 text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Map className="h-5 w-5 text-cyan-200" />
              {t("client.hunt.create.mapTitle")}
            </h2>
            <button type="button" onClick={() => setMapOpen(false)} className={cn("flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60", huntInteractiveClass)} aria-label={t("client.hunt.create.back")}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
            <div ref={mapHostRef} className="absolute inset-0" />
            {mapStatus !== "ready" && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/58">
                {mapStatus === "loading" ? t("client.hunt.create.mapLoading") : t("client.hunt.create.mapUnavailable")}
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" onClick={() => setMapOpen(false)} className={cn("rounded-2xl", huntInteractiveClass)}>
              {t("client.hunt.create.back")}
            </Button>
            <Button type="button" onClick={() => setMapOpen(false)} className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
              <Check className="mr-2 h-4 w-4" />
              {t("client.hunt.create.useMapPoint")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
