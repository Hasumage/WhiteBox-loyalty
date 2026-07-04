"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgePercent,
  Camera,
  CheckCircle2,
  Crop,
  ImageIcon,
  Images,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  companyMedia,
  createCompanySpecialOffer,
  deleteCompanyMediaAsset,
  deleteCompanySpecialOffer,
  uploadCompanyMediaAsset,
  type CompanyMediaAsset,
  type CompanyMediaState,
  type CompanySpecialOffer,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

type MediaKind = "LOGO" | "HERO" | "GALLERY";
type Target = {
  key: "logo" | "hero" | "gallery" | "offer";
  kind?: MediaKind;
  title: string;
  description: string;
  width: number;
  height: number;
  ratio: string;
};

type CropDraft = {
  target: Target;
  file: File;
  dataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
  title: string;
  description: string;
  code: string;
};

const TARGETS: Target[] = [
  {
    key: "logo",
    kind: "LOGO",
    title: "Логотип",
    description: "Квадратная иконка компании в карточках и шапке.",
    width: 512,
    height: 512,
    ratio: "1:1",
  },
  {
    key: "hero",
    kind: "HERO",
    title: "Шапка",
    description: "Главная обложка публичной карточки.",
    width: 960,
    height: 420,
    ratio: "16:7",
  },
  {
    key: "gallery",
    kind: "GALLERY",
    title: "Галерея",
    description: "Фото атмосферы, товаров, интерьера и команды. До 10 штук.",
    width: 900,
    height: 675,
    ratio: "4:3",
  },
  {
    key: "offer",
    title: "Акция",
    description: "Красивая карточка предложения и промокода для постоянных клиентов.",
    width: 900,
    height: 506,
    ratio: "16:9",
  },
];

function targetFor(key: Target["key"]) {
  return TARGETS.find((target) => target.key === key)!;
}

function formatBytes(value: number | null | undefined) {
  if (!value) return "—";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function loadImage(file: File) {
  return new Promise<CropDraft>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => reject(new Error("Не удалось открыть изображение."));
      image.onload = () =>
        resolve({
          target: targetFor("gallery"),
          file,
          dataUrl,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          zoom: 1,
          offsetX: 0,
          offsetY: 0,
          title: "",
          description: "",
          code: "",
        });
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function cropToFile(draft: CropDraft) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Не удалось подготовить изображение."));
    img.onload = () => resolve(img);
    img.src = draft.dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = draft.target.width;
  canvas.height = draft.target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas недоступен.");
  context.fillStyle = "#03060a";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const coverScale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight) * draft.zoom;
  const drawWidth = image.naturalWidth * coverScale;
  const drawHeight = image.naturalHeight * coverScale;
  const extraX = Math.max(0, drawWidth - canvas.width);
  const extraY = Math.max(0, drawHeight - canvas.height);
  const x = (canvas.width - drawWidth) / 2 + (draft.offsetX / 100) * extraX;
  const y = (canvas.height - drawHeight) / 2 + (draft.offsetY / 100) * extraY;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, x, y, drawWidth, drawHeight);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Не удалось сохранить кроп."))), "image/webp", 0.9),
  );
  return new File([blob], `${draft.target.key}-${Date.now()}.webp`, { type: "image/webp" });
}

function PreviewImage({ src, title, className }: { src?: string | null; title: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]", className)}>
      {src ? (
        <img src={src} alt={title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-32 items-center justify-center text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
    </div>
  );
}

function AssetCard({
  icon: Icon,
  target,
  asset,
  onSelect,
  onDelete,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  target: Target;
  asset?: CompanyMediaAsset | null;
  onSelect: (target: Target, file: File) => void;
  onDelete?: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <Card className="glass border-white/10 py-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{target.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{target.description}</p>
            </div>
          </div>
          {asset && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />}
        </div>
        <PreviewImage src={asset?.url} title={target.title} className={target.key === "logo" ? "aspect-square max-w-[220px]" : "aspect-[16/7]"} />
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-muted-foreground">
          <p>
            Стандарт: <span className="font-mono text-cyan-100">{target.width}×{target.height}</span> · {target.ratio}
          </p>
          <p className="mt-1">Текущий файл: {asset ? `${asset.width}×${asset.height}, ${formatBytes(asset.size)}` : "не загружен"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) onSelect(target, file);
            }}
          />
          <Button type="button" variant="secondary" className="rounded-xl" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {asset ? "Заменить" : "Загрузить"}
          </Button>
          {asset && (
            <Button type="button" variant="outline" className="rounded-xl border-red-300/25 text-red-100" disabled={disabled} onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CompanyMediaSettingsPage() {
  const [state, setState] = useState<CompanyMediaState | null>(null);
  const [draft, setDraft] = useState<CropDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerCode, setOfferCode] = useState("");

  async function load() {
    try {
      setLoading(true);
      setState(await companyMedia());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить медиа.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const galleryFull = (state?.media.gallery.length ?? 0) >= 10;
  const logoAsset = state?.media.logo ?? null;
  const heroAsset = state?.media.hero ?? null;

  async function openCrop(target: Target, file: File) {
    setError("");
    try {
      if (file.size > 4 * 1024 * 1024) {
        setError("Файл не должен быть больше 4 МБ.");
        return;
      }
      const next = await loadImage(file);
      setDraft({ ...next, target, title: target.key === "gallery" ? "" : target.title });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось открыть изображение.");
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const file = await cropToFile(draft);
      const form = new FormData();
      form.set("file", file);
      form.set("width", String(draft.target.width));
      form.set("height", String(draft.target.height));
      form.set("title", draft.title);
      form.set("description", draft.description);
      if (draft.target.key === "offer") {
        form.set("code", draft.code);
        if (!draft.title.trim()) throw new Error("Укажите название акции.");
        await createCompanySpecialOffer(form);
        setMessage("Акция добавлена.");
      } else {
        form.set("kind", draft.target.kind!);
        await uploadCompanyMediaAsset(form);
        setMessage("Изображение сохранено.");
      }
      setDraft(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить изображение.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAsset(asset: CompanyMediaAsset) {
    if (!window.confirm("Удалить изображение?")) return;
    await deleteCompanyMediaAsset(asset.id);
    setMessage("Изображение удалено.");
    await load();
  }

  async function removeOffer(offer: CompanySpecialOffer) {
    if (!window.confirm("Удалить акцию?")) return;
    await deleteCompanySpecialOffer(offer.id);
    setMessage("Акция удалена.");
    await load();
  }

  const cropPreviewStyle = useMemo(() => {
    if (!draft) return {};
    const scale = 100 * draft.zoom;
    return {
      backgroundImage: `url(${draft.dataUrl})`,
      backgroundSize: `${scale}% auto`,
      backgroundPosition: `${50 + draft.offsetX}% ${50 + draft.offsetY}%`,
    };
  }, [draft]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_34%),rgba(255,255,255,0.035)] p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            <Images className="h-4 w-4" /> Витрина компании
          </p>
          <h1 className="text-3xl font-semibold">Фото, обложка и акции</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Подготовьте публичную карточку: логотип, шапку, галерею до 10 фото и специальные предложения. Все изображения приводятся к стандартам NearLoy перед загрузкой.
          </p>
        </div>
        <Button asChild variant="secondary" className="rounded-xl">
          <Link href="/company/settings">Назад к профилю</Link>
        </Button>
      </header>

      {(error || message) && (
        <div className={cn("rounded-2xl border p-4 text-sm", error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50")}>
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/10 p-8 text-muted-foreground">Загружаем медиа…</div>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <AssetCard icon={Camera} target={targetFor("logo")} asset={logoAsset} onSelect={openCrop} onDelete={logoAsset ? () => void removeAsset(logoAsset) : undefined} />
            <AssetCard icon={ImageIcon} target={targetFor("hero")} asset={heroAsset} onSelect={openCrop} onDelete={heroAsset ? () => void removeAsset(heroAsset) : undefined} />
          </div>

          <Card className="glass border-white/10 py-0">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold"><Images className="h-5 w-5 text-cyan-100" /> Галерея</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Стандарт 900×675, максимум 10 фото. Лучше: интерьер, продукты, команда, атмосфера.</p>
                </div>
                <label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={galleryFull}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void openCrop(targetFor("gallery"), file);
                    }}
                  />
                  <span className={cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-medium", galleryFull && "pointer-events-none opacity-50")}>
                    <Plus className="h-4 w-4" /> Добавить фото ({state?.media.gallery.length ?? 0}/10)
                  </span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {state?.media.gallery.map((asset) => (
                  <div key={asset.id} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
                    <img src={asset.url ?? ""} alt={asset.title ?? "Фото галереи"} className="aspect-[4/3] w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="line-clamp-1 text-sm font-semibold">{asset.title || "Фото галереи"}</p>
                    </div>
                    <Button size="sm" variant="secondary" className="absolute right-2 top-2 h-8 rounded-xl opacity-0 transition group-hover:opacity-100" onClick={() => void removeAsset(asset)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {!state?.media.gallery.length && <div className="rounded-3xl border border-dashed border-white/15 p-8 text-sm text-muted-foreground sm:col-span-2 xl:col-span-5">Галерея пока пустая.</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="glass border-white/10 py-0">
            <CardContent className="space-y-5 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold"><BadgePercent className="h-5 w-5 text-fuchsia-200" /> Специальные акции и промокоды</h2>
                <p className="mt-1 text-sm text-muted-foreground">Предложения для клиентов NearLoy: понятный заголовок, красивое изображение и короткий код для применения при визите.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
                <Input value={offerTitle} onChange={(event) => setOfferTitle(event.target.value)} placeholder="Например, Скидка на первый десерт" className="h-12 rounded-xl" />
                <Input value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} placeholder="Промокод, например WELCOME10" className="h-12 rounded-xl font-mono" />
                <label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) {
                        void loadImage(file).then((loaded) =>
                          setDraft({
                            ...loaded,
                            target: targetFor("offer"),
                            title: offerTitle,
                            description: offerDescription,
                            code: offerCode,
                          }),
                        );
                      }
                    }}
                  />
                  <span className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-secondary px-4 text-sm font-medium">
                    <Upload className="h-4 w-4" /> Картинка акции
                  </span>
                </label>
              </div>
              <Textarea value={offerDescription} onChange={(event) => setOfferDescription(event.target.value)} placeholder="Коротко объясните, что получает клиент и как воспользоваться предложением." className="min-h-24 rounded-xl" />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {state?.offers.map((offer) => (
                  <article key={offer.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
                    <PreviewImage src={offer.imageUrl} title={offer.title} className="aspect-video rounded-none border-0" />
                    <div className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">{offer.title}</h3>
                        <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-xl border-red-300/25 text-red-100" onClick={() => void removeOffer(offer)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {offer.code && <p className="w-fit rounded-xl border border-fuchsia-200/20 bg-fuchsia-400/10 px-3 py-1 font-mono text-sm text-fuchsia-100">{offer.code}</p>}
                      {offer.description && <p className="line-clamp-3 text-sm text-muted-foreground">{offer.description}</p>}
                    </div>
                  </article>
                ))}
                {!state?.offers.length && <div className="rounded-3xl border border-dashed border-white/15 p-8 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">Акций пока нет. Заполните поля и загрузите картинку.</div>}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {draft && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/82 p-4 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[#070b12] p-5 shadow-2xl">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100"><Crop className="h-4 w-4" /> Редактор изображения</p>
                <h2 className="mt-2 text-2xl font-semibold">{draft.target.title}: {draft.target.width}×{draft.target.height}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Подвиньте изображение и масштаб, чтобы оно аккуратно попало в стандарт приложения.</p>
              </div>
              <Button variant="ghost" className="rounded-xl" onClick={() => setDraft(null)}>Закрыть</Button>
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[2rem] border border-white/10 bg-black/35 p-4">
                <div
                  className="mx-auto max-h-[70vh] max-w-full rounded-[1.5rem] border border-cyan-200/20 bg-cover bg-center bg-no-repeat shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                  style={{
                    ...cropPreviewStyle,
                    aspectRatio: `${draft.target.width} / ${draft.target.height}`,
                    width: "min(100%, 760px)",
                  }}
                />
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">
                  Исходник: <span className="text-foreground">{draft.naturalWidth}×{draft.naturalHeight}</span><br />
                  Итог: <span className="font-mono text-cyan-100">{draft.target.width}×{draft.target.height} WEBP</span>
                </div>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Название</span>
                  <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="rounded-xl" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Описание</span>
                  <Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="min-h-24 rounded-xl" />
                </label>
                {draft.target.key === "offer" && (
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">Промокод</span>
                    <Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} className="rounded-xl font-mono" />
                  </label>
                )}
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Масштаб: {draft.zoom.toFixed(2)}×</span>
                  <input type="range" min="1" max="2.5" step="0.01" value={draft.zoom} onChange={(event) => setDraft({ ...draft, zoom: Number(event.target.value) })} className="w-full" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Сдвиг по горизонтали</span>
                  <input type="range" min="-50" max="50" value={draft.offsetX} onChange={(event) => setDraft({ ...draft, offsetX: Number(event.target.value) })} className="w-full" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">Сдвиг по вертикали</span>
                  <input type="range" min="-50" max="50" value={draft.offsetY} onChange={(event) => setDraft({ ...draft, offsetY: Number(event.target.value) })} className="w-full" />
                </label>
                <Button className="w-full rounded-xl" disabled={saving} onClick={() => void saveDraft()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Сохранить в стандарт NearLoy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
