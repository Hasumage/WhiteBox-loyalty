"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgePercent,
  Crop,
  ImageIcon,
  Megaphone,
  Loader2,
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
  deleteCompanySpecialOffer,
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
    title: "Р›РѕРіРѕС‚РёРї",
    description: "РљРІР°РґСЂР°С‚РЅР°СЏ РёРєРѕРЅРєР° РєРѕРјРїР°РЅРёРё РІ РєР°СЂС‚РѕС‡РєР°С… Рё С€Р°РїРєРµ.",
    width: 512,
    height: 512,
    ratio: "1:1",
  },
  {
    key: "hero",
    kind: "HERO",
    title: "РЁР°РїРєР°",
    description: "Р“Р»Р°РІРЅР°СЏ РѕР±Р»РѕР¶РєР° РїСѓР±Р»РёС‡РЅРѕР№ РєР°СЂС‚РѕС‡РєРё.",
    width: 960,
    height: 420,
    ratio: "16:7",
  },
  {
    key: "gallery",
    kind: "GALLERY",
    title: "Р“Р°Р»РµСЂРµСЏ",
    description: "Р¤РѕС‚Рѕ Р°С‚РјРѕСЃС„РµСЂС‹, С‚РѕРІР°СЂРѕРІ, РёРЅС‚РµСЂСЊРµСЂР° Рё РєРѕРјР°РЅРґС‹. Р”Рѕ 10 С€С‚СѓРє.",
    width: 900,
    height: 675,
    ratio: "4:3",
  },
  {
    key: "offer",
    title: "РђРєС†РёСЏ",
    description: "РљСЂР°СЃРёРІР°СЏ РєР°СЂС‚РѕС‡РєР° РїСЂРµРґР»РѕР¶РµРЅРёСЏ Рё РїСЂРѕРјРѕРєРѕРґР° РґР»СЏ РїРѕСЃС‚РѕСЏРЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ.",
    width: 900,
    height: 506,
    ratio: "16:9",
  },
];

function targetFor(key: Target["key"]) {
  return TARGETS.find((target) => target.key === key)!;
}

function loadImage(file: File) {
  return new Promise<CropDraft>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ С„Р°Р№Р»."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const image = new Image();
      image.onerror = () => reject(new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РєСЂС‹С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ."));
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
    img.onerror = () => reject(new Error("РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРіРѕС‚РѕРІРёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ."));
    img.onload = () => resolve(img);
    img.src = draft.dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = draft.target.width;
  canvas.height = draft.target.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas РЅРµРґРѕСЃС‚СѓРїРµРЅ.");
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
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РєСЂРѕРї."))), "image/webp", 0.9),
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

export default function CompanyOffersSettingsPage() {
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
      setError(reason instanceof Error ? reason.message : "РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РјРµРґРёР°.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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
        if (!draft.title.trim()) throw new Error("РЈРєР°Р¶РёС‚Рµ РЅР°Р·РІР°РЅРёРµ Р°РєС†РёРё.");
        await createCompanySpecialOffer(form);
        setMessage("РђРєС†РёСЏ РґРѕР±Р°РІР»РµРЅР°.");
      } else {
        throw new Error("Выберите изображение акции.");
      }
      setDraft(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "РќРµ СѓРґР°Р»РѕСЃСЊ СЃРѕС…СЂР°РЅРёС‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ.");
    } finally {
      setSaving(false);
    }
  }

  async function removeOffer(offer: CompanySpecialOffer) {
    if (!window.confirm("РЈРґР°Р»РёС‚СЊ Р°РєС†РёСЋ?")) return;
    await deleteCompanySpecialOffer(offer.id);
    setMessage("РђРєС†РёСЏ СѓРґР°Р»РµРЅР°.");
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
            <Megaphone className="h-4 w-4" /> Р’РёС‚СЂРёРЅР° РєРѕРјРїР°РЅРёРё
          </p>
          <h1 className="text-3xl font-semibold">Р¤РѕС‚Рѕ, РѕР±Р»РѕР¶РєР° Рё Р°РєС†РёРё</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            РџРѕРґРіРѕС‚РѕРІСЊС‚Рµ РїСѓР±Р»РёС‡РЅСѓСЋ РєР°СЂС‚РѕС‡РєСѓ: Р»РѕРіРѕС‚РёРї, С€Р°РїРєСѓ, РіР°Р»РµСЂРµСЋ РґРѕ 10 С„РѕС‚Рѕ Рё СЃРїРµС†РёР°Р»СЊРЅС‹Рµ РїСЂРµРґР»РѕР¶РµРЅРёСЏ. Р’СЃРµ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ РїСЂРёРІРѕРґСЏС‚СЃСЏ Рє СЃС‚Р°РЅРґР°СЂС‚Р°Рј NearLoy РїРµСЂРµРґ Р·Р°РіСЂСѓР·РєРѕР№.
          </p>
        </div>
        <Button asChild variant="secondary" className="rounded-xl">
          <Link href="/company/settings">РќР°Р·Р°Рґ Рє РїСЂРѕС„РёР»СЋ</Link>
        </Button>
      </header>

      {(error || message) && (
        <div className={cn("rounded-2xl border p-4 text-sm", error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50")}>
          {error || message}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-white/10 p-8 text-muted-foreground">Р—Р°РіСЂСѓР¶Р°РµРј РјРµРґРёР°вЂ¦</div>
      ) : (
        <>
          <Card className="glass border-white/10 py-0">
            <CardContent className="space-y-5 p-5">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-semibold"><BadgePercent className="h-5 w-5 text-fuchsia-200" /> РЎРїРµС†РёР°Р»СЊРЅС‹Рµ Р°РєС†РёРё Рё РїСЂРѕРјРѕРєРѕРґС‹</h2>
                <p className="mt-1 text-sm text-muted-foreground">РџСЂРµРґР»РѕР¶РµРЅРёСЏ РґР»СЏ РєР»РёРµРЅС‚РѕРІ NearLoy: РїРѕРЅСЏС‚РЅС‹Р№ Р·Р°РіРѕР»РѕРІРѕРє, РєСЂР°СЃРёРІРѕРµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ Рё РєРѕСЂРѕС‚РєРёР№ РєРѕРґ РґР»СЏ РїСЂРёРјРµРЅРµРЅРёСЏ РїСЂРё РІРёР·РёС‚Рµ.</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px]">
                <Input value={offerTitle} onChange={(event) => setOfferTitle(event.target.value)} placeholder="РќР°РїСЂРёРјРµСЂ, РЎРєРёРґРєР° РЅР° РїРµСЂРІС‹Р№ РґРµСЃРµСЂС‚" className="h-12 rounded-xl" />
                <Input value={offerCode} onChange={(event) => setOfferCode(event.target.value.toUpperCase())} placeholder="РџСЂРѕРјРѕРєРѕРґ, РЅР°РїСЂРёРјРµСЂ WELCOME10" className="h-12 rounded-xl font-mono" />
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
                    <Upload className="h-4 w-4" /> РљР°СЂС‚РёРЅРєР° Р°РєС†РёРё
                  </span>
                </label>
              </div>
              <Textarea value={offerDescription} onChange={(event) => setOfferDescription(event.target.value)} placeholder="РљРѕСЂРѕС‚РєРѕ РѕР±СЉСЏСЃРЅРёС‚Рµ, С‡С‚Рѕ РїРѕР»СѓС‡Р°РµС‚ РєР»РёРµРЅС‚ Рё РєР°Рє РІРѕСЃРїРѕР»СЊР·РѕРІР°С‚СЊСЃСЏ РїСЂРµРґР»РѕР¶РµРЅРёРµРј." className="min-h-24 rounded-xl" />
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
                {!state?.offers.length && <div className="rounded-3xl border border-dashed border-white/15 p-8 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">РђРєС†РёР№ РїРѕРєР° РЅРµС‚. Р—Р°РїРѕР»РЅРёС‚Рµ РїРѕР»СЏ Рё Р·Р°РіСЂСѓР·РёС‚Рµ РєР°СЂС‚РёРЅРєСѓ.</div>}
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
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100"><Crop className="h-4 w-4" /> Р РµРґР°РєС‚РѕСЂ РёР·РѕР±СЂР°Р¶РµРЅРёСЏ</p>
                <h2 className="mt-2 text-2xl font-semibold">{draft.target.title}: {draft.target.width}Г—{draft.target.height}</h2>
                <p className="mt-1 text-sm text-muted-foreground">РџРѕРґРІРёРЅСЊС‚Рµ РёР·РѕР±СЂР°Р¶РµРЅРёРµ Рё РјР°СЃС€С‚Р°Р±, С‡С‚РѕР±С‹ РѕРЅРѕ Р°РєРєСѓСЂР°С‚РЅРѕ РїРѕРїР°Р»Рѕ РІ СЃС‚Р°РЅРґР°СЂС‚ РїСЂРёР»РѕР¶РµРЅРёСЏ.</p>
              </div>
              <Button variant="ghost" className="rounded-xl" onClick={() => setDraft(null)}>Р—Р°РєСЂС‹С‚СЊ</Button>
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
                  РСЃС…РѕРґРЅРёРє: <span className="text-foreground">{draft.naturalWidth}Г—{draft.naturalHeight}</span><br />
                  РС‚РѕРі: <span className="font-mono text-cyan-100">{draft.target.width}Г—{draft.target.height} WEBP</span>
                </div>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">РќР°Р·РІР°РЅРёРµ</span>
                  <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="rounded-xl" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">РћРїРёСЃР°РЅРёРµ</span>
                  <Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="min-h-24 rounded-xl" />
                </label>
                {draft.target.key === "offer" && (
                  <label className="space-y-2 block">
                    <span className="text-sm font-semibold">РџСЂРѕРјРѕРєРѕРґ</span>
                    <Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} className="rounded-xl font-mono" />
                  </label>
                )}
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">РњР°СЃС€С‚Р°Р±: {draft.zoom.toFixed(2)}Г—</span>
                  <input type="range" min="1" max="2.5" step="0.01" value={draft.zoom} onChange={(event) => setDraft({ ...draft, zoom: Number(event.target.value) })} className="w-full" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">РЎРґРІРёРі РїРѕ РіРѕСЂРёР·РѕРЅС‚Р°Р»Рё</span>
                  <input type="range" min="-50" max="50" value={draft.offsetX} onChange={(event) => setDraft({ ...draft, offsetX: Number(event.target.value) })} className="w-full" />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-semibold">РЎРґРІРёРі РїРѕ РІРµСЂС‚РёРєР°Р»Рё</span>
                  <input type="range" min="-50" max="50" value={draft.offsetY} onChange={(event) => setDraft({ ...draft, offsetY: Number(event.target.value) })} className="w-full" />
                </label>
                <Button className="w-full rounded-xl" disabled={saving} onClick={() => void saveDraft()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  РЎРѕС…СЂР°РЅРёС‚СЊ РІ СЃС‚Р°РЅРґР°СЂС‚ NearLoy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

