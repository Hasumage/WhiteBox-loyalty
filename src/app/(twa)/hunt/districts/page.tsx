"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { getHuntFeed, type HuntPost } from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";
import { huntInteractiveClass } from "../_components/hunt-ui";

const MOSCOW_CENTER: [number, number] = [55.751244, 37.618423];
const YANDEX_MAPS_V2_SCRIPT_ID = "nearloy-yandex-maps-v2";

type District = {
  slug: string;
  name: string;
  title: string;
  color: string;
  fill: string;
  polygon: Array<[number, number]>;
  center: [number, number];
  fallbackPath: string;
};

type DistrictStat = District & {
  likes: number;
  posts: number;
  players: number;
};

type YandexV2Api = {
  ready: (callback: () => void) => void;
  Map: new (
    element: HTMLElement,
    options: Record<string, unknown>,
    settings?: Record<string, unknown>,
  ) => YandexMapInstance;
  Polygon: new (
    geometry: Array<Array<[number, number]>>,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => YandexPolygon;
};

type YandexMapInstance = {
  geoObjects: { add: (object: YandexPolygon) => void };
  destroy: () => void;
};

type YandexPolygon = {
  events: { add: (event: string, callback: () => void) => void };
  options: { set: (key: string, value: unknown) => void };
};

const TILE_CENTER = { latitude: 55.751, longitude: 37.617 };
const TILE_LAT_SCALE = 0.118;
const TILE_LON_SCALE = 0.22;
const SVG_TILE_CENTER = { x: 310, y: 280 };
const SVG_TILE_SCALE = { x: 118, y: 98 };

type LocalPoint = [number, number];
type TileKey = "center" | "north" | "northEast" | "east" | "southEast" | "southWest" | "west";

const innerTile: LocalPoint[] = [
  [0.0, -0.36],
  [0.33, -0.19],
  [0.35, 0.21],
  [-0.05, 0.39],
  [-0.36, 0.17],
  [-0.31, -0.22],
];

const outerTile: LocalPoint[] = [
  [0.0, -2.35],
  [2.08, -1.2],
  [2.1, 1.22],
  [0.02, 2.36],
  [-2.08, 1.12],
  [-2.02, -1.24],
];

const tilePoints: Record<TileKey, LocalPoint[]> = {
  center: innerTile,
  northEast: [innerTile[0], outerTile[0], outerTile[1], innerTile[1]],
  east: [innerTile[1], outerTile[1], outerTile[2], innerTile[2]],
  southEast: [innerTile[2], outerTile[2], outerTile[3], innerTile[3]],
  southWest: [innerTile[3], outerTile[3], outerTile[4], innerTile[4]],
  west: [innerTile[4], outerTile[4], outerTile[5], innerTile[5]],
  north: [innerTile[5], outerTile[5], outerTile[0], innerTile[0]],
};

function localToGeo([x, y]: LocalPoint): [number, number] {
  return [
    TILE_CENTER.latitude - y * TILE_LAT_SCALE,
    TILE_CENTER.longitude + x * TILE_LON_SCALE,
  ];
}

function localToSvg([x, y]: LocalPoint) {
  return {
    x: SVG_TILE_CENTER.x + x * SVG_TILE_SCALE.x,
    y: SVG_TILE_CENTER.y + y * SVG_TILE_SCALE.y,
  };
}

function tilePolygon(key: TileKey): Array<[number, number]> {
  return tilePoints[key].map(localToGeo);
}

function tileCenter(key: TileKey): [number, number] {
  const points = tilePoints[key];
  const [x, y] = points.reduce(
    ([sumX, sumY], point) => [sumX + point[0], sumY + point[1]],
    [0, 0],
  );
  return localToGeo([x / points.length, y / points.length]);
}

function tilePath(key: TileKey) {
  return (
    tilePoints[key]
      .map((point, index) => {
        const { x, y } = localToSvg(point);
        return `${index === 0 ? "M" : "L"}${Math.round(x)} ${Math.round(y)}`;
      })
      .join(" ") + " Z"
  );
}

const districts: District[] = [
  {
    slug: "spark-core",
    name: "Сердце Искр",
    title: "Центр карты",
    color: "#67e8f9",
    fill: "rgba(103,232,249,0.34)",
    center: tileCenter("center"),
    polygon: tilePolygon("center"),
    fallbackPath: tilePath("center"),
  },
  {
    slug: "crystal-north",
    name: "Лунный предел",
    title: "Северная зона",
    color: "#93c5fd",
    fill: "rgba(147,197,253,0.28)",
    center: tileCenter("north"),
    polygon: tilePolygon("north"),
    fallbackPath: tilePath("north"),
  },
  {
    slug: "neon-east",
    name: "Звёздная Завеса",
    title: "Восточная зона",
    color: "#22d3ee",
    fill: "rgba(34,211,238,0.25)",
    center: tileCenter("east"),
    polygon: tilePolygon("east"),
    fallbackPath: tilePath("east"),
  },
  {
    slug: "ember-south",
    name: "Сад Созвездий",
    title: "Южная зона",
    color: "#fbbf24",
    fill: "rgba(251,191,36,0.26)",
    center: tileCenter("southEast"),
    polygon: tilePolygon("southEast"),
    fallbackPath: tilePath("southEast"),
  },
  {
    slug: "wind-west",
    name: "Орбита Туманов",
    title: "Западная зона",
    color: "#a7f3d0",
    fill: "rgba(167,243,208,0.25)",
    center: tileCenter("west"),
    polygon: tilePolygon("west"),
    fallbackPath: tilePath("west"),
  },
  {
    slug: "violet-ring",
    name: "Кометный предел",
    title: "Юго-восточная зона",
    color: "#c084fc",
    fill: "rgba(192,132,252,0.26)",
    center: tileCenter("southWest"),
    polygon: tilePolygon("southWest"),
    fallbackPath: tilePath("southWest"),
  },
  {
    slug: "leaf-gate",
    name: "Астральный Порог",
    title: "Северо-восточная зона",
    color: "#bef264",
    fill: "rgba(190,242,100,0.25)",
    center: tileCenter("northEast"),
    polygon: tilePolygon("northEast"),
    fallbackPath: tilePath("northEast"),
  },
];

const demoPosts: HuntPost[] = [];

function loadYandexMapsV2(apiKey: string): Promise<YandexV2Api> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Browser is required."));
  const yandexWindow = window as Window & { ymaps?: YandexV2Api };
  if (yandexWindow.ymaps)
    return new Promise((resolve) =>
      yandexWindow.ymaps?.ready(() => resolve(yandexWindow.ymaps as YandexV2Api)),
    );

  const existing = document.getElementById(
    YANDEX_MAPS_V2_SCRIPT_ID,
  ) as HTMLScriptElement | null;
  if (existing)
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () =>
        yandexWindow.ymaps?.ready(() =>
          resolve(yandexWindow.ymaps as YandexV2Api),
        ),
      );
      existing.addEventListener("error", () =>
        reject(new Error("Yandex Maps script failed to load.")),
      );
      if (existing.dataset.loaded === "true" && yandexWindow.ymaps)
        yandexWindow.ymaps.ready(() =>
          resolve(yandexWindow.ymaps as YandexV2Api),
        );
    });

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = YANDEX_MAPS_V2_SCRIPT_ID;
    script.async = true;
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    script.onload = () => {
      script.dataset.loaded = "true";
      if (!yandexWindow.ymaps) {
        reject(new Error("Yandex Maps loaded, but ymaps is not available."));
        return;
      }
      yandexWindow.ymaps.ready(() =>
        resolve(yandexWindow.ymaps as YandexV2Api),
      );
    };
    script.onerror = () => reject(new Error("Yandex Maps script failed to load."));
    document.head.appendChild(script);
  });
}

function isInsideDistrict(post: HuntPost, district: District) {
  if (post.latitude == null || post.longitude == null) return false;
  const x = post.longitude;
  const y = post.latitude;
  let inside = false;
  for (
    let i = 0, j = district.polygon.length - 1;
    i < district.polygon.length;
    j = i++
  ) {
    const yi = district.polygon[i][0];
    const xi = district.polygon[i][1];
    const yj = district.polygon[j][0];
    const xj = district.polygon[j][1];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildStats(posts: HuntPost[]) {
  return districts
    .map((district) => {
      const districtPosts = posts.filter((post) => isInsideDistrict(post, district));
      return {
        ...district,
        likes: districtPosts.reduce((sum, post) => sum + post.likeCount, 0),
        posts: districtPosts.length,
        players: new Set(districtPosts.map((post) => post.author.uuid)).size,
      };
    })
    .sort((a, b) => b.likes - a.likes || b.posts - a.posts || a.name.localeCompare(b.name));
}

function selectedTone(index: number) {
  if (index === 0) return "border-amber-200/42 bg-amber-200/10 text-amber-100";
  if (index === 1) return "border-cyan-200/32 bg-cyan-200/10 text-cyan-100";
  return "border-white/10 bg-white/[0.045] text-white/72";
}

function DistrictFallbackMap({
  stats,
  selected,
  onSelect,
}: {
  stats: DistrictStat[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const maxLikes = Math.max(1, ...stats.map((district) => district.likes));
  const bySlug = new Map(stats.map((district) => [district.slug, district]));
  return (
    <div className="relative h-[430px] overflow-hidden rounded-[32px] border border-cyan-200/16 bg-[radial-gradient(circle_at_50%_40%,rgba(103,232,249,0.14),transparent_34%),linear-gradient(160deg,rgba(8,13,22,0.96),rgba(2,6,14,0.98))]">
      <svg viewBox="0 0 620 560" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="districtGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d="M40 420 C180 326 210 240 314 174 C405 115 516 108 590 42" stroke="rgba(125,211,252,0.18)" strokeWidth="20" fill="none" />
        <path d="M58 458 C205 350 235 270 335 205 C428 145 530 137 598 76" stroke="rgba(34,211,238,0.22)" strokeWidth="6" fill="none" />
        {districts.map((district) => {
          const stat = bySlug.get(district.slug)!;
          const opacity = 0.34 + (stat.likes / maxLikes) * 0.34;
          const active = selected === district.slug;
          return (
            <path
              key={district.slug}
              d={district.fallbackPath}
              fill={district.color}
              fillOpacity={opacity}
              stroke={district.color}
              strokeWidth={active ? 5 : 3}
              filter={active ? "url(#districtGlow)" : undefined}
              className="cursor-pointer transition"
              onClick={() => onSelect(district.slug)}
            />
          );
        })}
      </svg>
      {stats.map((district) => (
        <button
          key={district.slug}
          type="button"
          onClick={() => onSelect(district.slug)}
          className={cn(
            "absolute rounded-full border px-2.5 py-1 text-xs font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.34)] backdrop-blur",
            selected === district.slug
              ? "border-cyan-100 bg-slate-950 text-cyan-50"
              : "border-white/10 bg-slate-950/70 text-white/62",
          )}
          style={{
            left: `${18 + districts.findIndex((item) => item.slug === district.slug) * 9}%`,
            top: `${18 + (districts.findIndex((item) => item.slug === district.slug) % 4) * 14}%`,
          }}
        >
          {district.name}
        </button>
      ))}
      <div className="absolute bottom-3 left-3 right-3 rounded-[24px] border border-white/10 bg-slate-950/86 p-3 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">
          Схема районов
        </p>
        <p className="mt-1 text-sm leading-5 text-white/66">
          Яндекс Карта включится при доступном ключе. Зоны уже считаются по тем же полигонам.
        </p>
      </div>
    </div>
  );
}

function YandexDistrictMap({
  stats,
  selected,
  onSelect,
}: {
  stats: DistrictStat[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMapInstance | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !apiKey || mapRef.current) {
      if (!apiKey) {
        setFailed(true);
        setLoading(false);
      }
      return;
    }

    let disposed = false;
    setLoading(true);
    void loadYandexMapsV2(apiKey)
      .then((ymaps) => {
        if (disposed || mapRef.current || !nodeRef.current) return;
        const map = new ymaps.Map(
          nodeRef.current,
          {
            center: MOSCOW_CENTER,
            zoom: 9,
            controls: ["zoomControl"],
          },
          { suppressMapOpenBlock: true },
        );
        mapRef.current = map;
        const maxLikes = Math.max(1, ...statsRef.current.map((district) => district.likes));
        for (const district of statsRef.current) {
          const glowPolygon = new ymaps.Polygon(
            [district.polygon],
            {},
            {
              fillColor: district.color,
              strokeColor: district.color,
              strokeWidth: selected === district.slug ? 10 : 7,
              fillOpacity: 0,
              strokeOpacity: selected === district.slug ? 0.42 : 0.28,
              interactivityModel: "default#transparent",
            },
          );
          const polygon = new ymaps.Polygon(
            [district.polygon],
            {
              hintContent: `${district.name}: ${district.likes} лайков`,
            },
            {
              fillColor: district.fill,
              strokeColor: district.color,
              strokeWidth: selected === district.slug ? 5 : 3,
              fillOpacity: 0.36 + (district.likes / maxLikes) * 0.34,
              strokeOpacity: selected === district.slug ? 1 : 0.92,
              interactivityModel: "default#geoObject",
            },
          );
          polygon.events.add("click", () => onSelect(district.slug));
          map.geoObjects.add(glowPolygon);
          map.geoObjects.add(polygon);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [apiKey, onSelect, selected]);

  if (failed)
    return <DistrictFallbackMap stats={stats} selected={selected} onSelect={onSelect} />;

  return (
    <div className="relative h-[430px] overflow-hidden rounded-[32px] border border-cyan-200/16 bg-slate-950">
      <div ref={nodeRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-slate-950/80 text-cyan-100">
          <div className="flex items-center gap-2 rounded-full border border-cyan-200/18 bg-cyan-200/10 px-4 py-2 text-sm font-semibold">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаем карту
          </div>
        </div>
      )}
    </div>
  );
}

export default function HuntDistrictsPage() {
  const [posts, setPosts] = useState<HuntPost[]>(demoPosts);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState(districts[0].slug);

  useEffect(() => {
    let disposed = false;
    void getHuntFeed(true)
      .then((feed) => {
        if (!disposed) setPosts(feed);
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const stats = useMemo(() => buildStats(posts), [posts]);
  const selected = stats.find((district) => district.slug === selectedSlug) ?? stats[0];
  const totalLikes = stats.reduce((sum, district) => sum + district.likes, 0);
  const totalPosts = stats.reduce((sum, district) => sum + district.posts, 0);

  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/hunt/sections"
            className={cn(
              "mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white/78",
              huntInteractiveClass,
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Все разделы
          </Link>
          <h1 className="text-[34px] font-semibold leading-none tracking-tight">
            Битва районов
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-5 text-white/54">
            Москва поделена на крупные игровые зоны. Чем больше лайков получают посты внутри зоны, тем выше район в рейтинге.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] border border-cyan-200/18 bg-cyan-200/10 text-cyan-100">
          <MapPin className="h-5 w-5" />
        </div>
      </header>

      <section className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-[22px] border border-cyan-200/14 bg-white/[0.045] p-3">
          <p className="text-[11px] text-white/42">Лайки</p>
          <b className="mt-1 block text-xl text-cyan-50">{totalLikes}</b>
        </div>
        <div className="rounded-[22px] border border-cyan-200/14 bg-white/[0.045] p-3">
          <p className="text-[11px] text-white/42">Посты</p>
          <b className="mt-1 block text-xl text-cyan-50">{totalPosts}</b>
        </div>
        <div className="rounded-[22px] border border-cyan-200/14 bg-white/[0.045] p-3">
          <p className="text-[11px] text-white/42">Зоны</p>
          <b className="mt-1 block text-xl text-cyan-50">{districts.length}</b>
        </div>
      </section>

      <section className="relative mb-5">
        <YandexDistrictMap
          stats={stats}
          selected={selected.slug}
          onSelect={setSelectedSlug}
        />
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-[22px] border border-cyan-200/16 bg-slate-950/72 p-3 shadow-[0_18px_50px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/58">
                Выбрана зона
              </p>
              <h2 className="mt-1 text-lg font-semibold">{selected.name}</h2>
              <p className="mt-0.5 text-xs text-white/56">{selected.title}</p>
            </div>
            <span className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1 text-sm font-semibold text-cyan-50">
              {selected.likes} лайков
            </span>
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-[30px] border border-cyan-200/14 bg-slate-950/74 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Топ районов</h2>
            <p className="mt-1 text-sm text-white/46">
              Сортировка по сумме лайков у постов зоны.
            </p>
          </div>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-cyan-100/70" />}
        </div>

        <div className="grid gap-2">
          {stats.map((district, index) => (
            <button
              key={district.slug}
              type="button"
              onClick={() => setSelectedSlug(district.slug)}
              className={cn(
                "flex items-center gap-3 rounded-[22px] border p-3 text-left transition",
                selected.slug === district.slug
                  ? "border-cyan-200/42 bg-cyan-200/10"
                  : "border-white/10 bg-white/[0.035]",
                huntInteractiveClass,
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold",
                  selectedTone(index),
                )}
              >
                {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">
                  {district.name}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/48">
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5 text-rose-200" />
                    {district.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5 text-cyan-100" />
                    {district.posts}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="h-3.5 w-3.5 text-emerald-100" />
                    {district.players}
                  </span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/34" />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-cyan-200/14 bg-[radial-gradient(circle_at_10%_0%,rgba(103,232,249,0.12),transparent_36%),rgba(255,255,255,0.04)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-200/10 text-cyan-100">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Правило MVP</h2>
            <p className="mt-1 text-sm leading-5 text-white/52">
              В рейтинг идут только лайки постов с координатами внутри зоны. Позже сюда можно добавить сезонные награды, бафы района и задания на удержание территории.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
