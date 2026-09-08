"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Boxes, CheckCircle2, Plus, RefreshCw, Save, Search, ShieldQuestion, Sparkles, Tags, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminCreateHuntBoxConfig, adminDeleteHuntBoxConfig, adminGetHuntBoxes, adminRunHuntBoxSimulation, adminUpdateHuntBoxConfig, type AdminHuntBoxConfig, type AdminHuntBoxSimulationResponse, type AdminHuntBoxesResponse } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";
import { ElementBadge, huntInteractiveClass, rarityBadgeClass } from "@/app/(twa)/hunt/_components/hunt-ui";
import { HuntAdminTabs } from "../_components/hunt-admin-tabs";

type DraftBox = AdminHuntBoxConfig;

const rarityLabels: Record<string, string> = {
  COMMON: "Обыч.",
  UNCOMMON: "Необыч.",
  RARE: "Редк.",
  EPIC: "Эпик",
  LEGENDARY: "Легенд.",
};

const verdictLabels: Record<string, { label: string; className: string }> = {
  free: { label: "Бесплатно", className: "border-cyan-200/25 bg-cyan-200/10 text-cyan-50" },
  low: { label: "Цена завышена", className: "border-amber-200/25 bg-amber-200/10 text-amber-50" },
  ok: { label: "Баланс ок", className: "border-emerald-200/25 bg-emerald-200/10 text-emerald-50" },
  high: { label: "Слишком щедро", className: "border-rose-200/25 bg-rose-200/10 text-rose-50" },
};

function mediaSrc(url?: string | null) {
  if (!url) return "/hunt-assets/shop/promo-box.png";
  const [path] = url.split("?");
  if (path.startsWith("/hunt/shop/")) return path.replace("/hunt/shop/", "/hunt-assets/shop/");
  if (path.startsWith("/hunt/cards/")) return path.replace("/hunt/cards/", "/hunt-assets/cards/");
  return path;
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedNumberValue(value: string, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Math.round(numberValue(value, fallback));
  return Math.max(min, Math.min(max, parsed));
}

function normalizeBoxForSave(box: DraftBox): DraftBox {
  const itemCountMin = Math.max(1, Math.min(10, Math.round(box.itemCountMin)));
  const itemCountMax = Math.max(itemCountMin, Math.min(10, Math.round(box.itemCountMax)));
  return {
    ...box,
    cost: Math.max(0, Math.round(box.cost)),
    statusDropChanceBp: Math.max(0, Math.min(10000, Math.round(box.statusDropChanceBp))),
    guaranteedCount: Math.max(0, Math.min(itemCountMax, Math.round(box.guaranteedCount))),
    itemCountMin,
    itemCountMax,
    rarityChances: box.rarityChances.map((item) => ({ ...item, weight: Math.max(0, Math.round(item.weight)) })),
    speciesRules: box.speciesRules.map((item) => ({ ...item, weight: Math.max(0, Math.round(item.weight)) })),
    statusChances: box.statusChances.map((item) => ({
      ...item,
      weight: Math.max(0, Math.round(item.weight)),
      dropChanceBp: Math.max(0, Math.min(10000, Math.round(item.dropChanceBp ?? 0))),
    })),
  };
}

function FieldShell({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-white/78">{label}</span>
      {children}
      {hint && <span className="text-xs leading-5 text-white/42">{hint}</span>}
    </label>
  );
}

export default function AdminHuntBoxesPage() {
  const [data, setData] = useState<AdminHuntBoxesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftBox>>({});
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<AdminHuntBoxSimulationResponse | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await adminGetHuntBoxes();
    setData(response);
    const nextDrafts = Object.fromEntries((response?.configs ?? []).map((box) => [box.uuid, box]));
    setDrafts(nextDrafts);
    setSelectedUuid((current) => current ?? response?.configs[0]?.uuid ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const boxes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = data?.configs ?? [];
    return needle ? rows.filter((box) => [box.title, box.slug, box.type].join(" ").toLowerCase().includes(needle)) : rows;
  }, [data, query]);

  const selected = selectedUuid ? drafts[selectedUuid] ?? null : null;
  const missingTypes = useMemo(() => {
    const used = new Set((data?.configs ?? []).map((box) => box.type));
    return (data?.boxTypes ?? []).filter((type) => !used.has(type));
  }, [data]);

  function patchBox(uuid: string, patch: Partial<DraftBox>) {
    setDrafts((current) => ({ ...current, [uuid]: { ...current[uuid], ...patch } }));
  }

  function patchRarity(uuid: string, rarity: string, patch: Partial<DraftBox["rarityChances"][number]>) {
    const box = drafts[uuid];
    if (!box) return;
    patchBox(uuid, { rarityChances: box.rarityChances.map((item) => (item.rarity === rarity ? { ...item, ...patch } : item)) });
  }

  function patchSpecies(uuid: string, speciesId: string, patch: Partial<DraftBox["speciesRules"][number]>) {
    const box = drafts[uuid];
    const species = data?.species.find((item) => item.id === speciesId);
    if (!box || !species) return;
    const existing = box.speciesRules.find((item) => item.speciesId === speciesId);
    const next = existing
      ? box.speciesRules.map((item) => (item.speciesId === speciesId ? { ...item, ...patch } : item))
      : [...box.speciesRules, { uuid: `${uuid}-${speciesId}`, speciesId, name: species.name, slug: species.slug, imageUrl: species.imageUrl, rarity: species.baseRarity, element: species.element, weight: 100, enabled: true, ...patch }];
    patchBox(uuid, { speciesRules: next });
  }

  function patchStatus(uuid: string, statusId: string, patch: Partial<DraftBox["statusChances"][number]>) {
    const box = drafts[uuid];
    const status = data?.statuses.find((item) => item.id === statusId);
    if (!box || !status) return;
    const existing = box.statusChances.find((item) => item.statusId === statusId);
    const next = existing
      ? box.statusChances.map((item) => (item.statusId === statusId ? { ...item, ...patch } : item))
      : [...box.statusChances, { uuid: `${uuid}-${statusId}`, statusId, title: status.title, rarity: status.rarity, statusRarity: status.rarity, weight: 100, dropChanceBp: 100, enabled: true, ...patch }];
    patchBox(uuid, { statusChances: next });
  }

  async function saveBox(uuid: string) {
    const box = drafts[uuid];
    if (!box) return;
    const normalizedBox = normalizeBoxForSave(box);
    setSaving(uuid);
    const result = await adminUpdateHuntBoxConfig(uuid, {
      ...normalizedBox,
      rarityChances: normalizedBox.rarityChances,
      speciesRules: normalizedBox.speciesRules,
      statusChances: normalizedBox.statusChances,
    });
    if (result.ok) {
      setData((current) => current ? { ...current, configs: current.configs.map((item) => (item.uuid === uuid ? result.data : item)) } : current);
      setDrafts((current) => ({ ...current, [uuid]: result.data }));
      setMessage("Коробка сохранена.");
    } else {
      setMessage(result.message);
    }
    setSaving(null);
  }

  async function createMissingBox() {
    const type = missingTypes[0];
    if (!type) return;
    setSaving("new");
    const result = await adminCreateHuntBoxConfig({ type, title: `${type} box`, description: "Новая серверная коробка Nearloy Hunt." });
    if (result.ok) {
      setData((current) => current ? { ...current, configs: [...current.configs, result.data] } : current);
      setDrafts((current) => ({ ...current, [result.data.uuid]: result.data }));
      setSelectedUuid(result.data.uuid);
      setMessage("Коробка добавлена.");
    } else {
      setMessage(result.message);
    }
    setSaving(null);
  }

  async function deleteBox(uuid: string) {
    const box = drafts[uuid];
    if (!box) return;
    if (!window.confirm(`Удалить коробку "${box.title}"? Настройки шансов тоже будут удалены.`)) return;

    setSaving(uuid);
    const result = await adminDeleteHuntBoxConfig(uuid);
    if (result.ok) {
      const nextConfigs = (data?.configs ?? []).filter((item) => item.uuid !== uuid);
      setData((current) => current ? { ...current, configs: current.configs.filter((item) => item.uuid !== uuid) } : current);
      setDrafts((current) => {
        const next = { ...current };
        delete next[uuid];
        return next;
      });
      setSelectedUuid(nextConfigs[0]?.uuid ?? null);
      setMessage("Коробка удалена.");
    } else {
      setMessage(result.message);
    }
    setSaving(null);
  }

  async function runSimulation() {
    setSimulating(true);
    const result = await adminRunHuntBoxSimulation();
    if (result.ok) {
      setSimulation(result.data);
      setMessage(`Симуляция готова: по ${result.data.boxesPerConfig} коробок.`);
    } else {
      setMessage(result.message);
    }
    setSimulating(false);
  }

  return (
    <div className="min-h-full space-y-4 pb-24 text-white">
      <header className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-white/78">
            <Boxes className="h-4 w-4 text-cyan-100" />
            <span>Коробки Hunt</span>
            <span className="font-semibold text-white">{data?.configs.length ?? 0}</span>
          </div>
          <div className="mt-2 h-1 w-56 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a855f7)]" style={{ width: data?.configs.length ? "100%" : "0%" }} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={loading || missingTypes.length === 0 || saving != null} onClick={() => void createMissingBox()} className={cn("glass rounded-2xl border-white/10", huntInteractiveClass)}>
            <Plus className="h-4 w-4" /> Добавить
          </Button>
          <Button variant="secondary" disabled={simulating} onClick={() => void runSimulation()} className={cn("glass rounded-2xl border-white/10", huntInteractiveClass)}>
            <BarChart3 className={cn("h-4 w-4", simulating && "animate-pulse")} /> Симуляция
          </Button>
          <Button variant="secondary" disabled={loading} onClick={() => void load()} className={cn("glass rounded-2xl border-white/10", huntInteractiveClass)}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Обновить
          </Button>
        </div>
      </header>

      <HuntAdminTabs />

      {simulation && (
        <Card className="border-cyan-200/16 bg-card/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-100" />
              Симуляция баланса: {simulation.boxesPerConfig} коробок
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-2">
            {simulation.results.map((result) => {
              const verdict = verdictLabels[result.verdict] ?? verdictLabels.ok;
              const ratio = result.valueRatio === null ? "—" : `${Math.round(result.valueRatio * 100)}%`;
              const statusTotal = Object.values(result.statusCounts).reduce((sum, count) => sum + count, 0);
              return (
                <div key={result.uuid} className="rounded-3xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{result.title}</p>
                      <p className="mt-1 text-sm text-white/48">{result.type}{result.rotationElement ? ` · ${result.rotationElement}` : ""}</p>
                    </div>
                    <Badge className={verdict.className}>{verdict.label}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-white/45">Стоимость</p>
                      <p className="mt-1 font-semibold">{result.totalCost.toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-white/45">Ценность</p>
                      <p className="mt-1 font-semibold">{result.totalValue.toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-white/45">Value/cost</p>
                      <p className="mt-1 font-semibold">{ratio}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {Object.entries(result.rarityCounts).map(([rarity, count]) => (
                      <div key={rarity} className="grid grid-cols-[82px_1fr_48px] items-center gap-2 text-xs">
                        <span className="text-white/58">{rarityLabels[rarity] ?? rarity}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-white/10">
                          <span className="block h-full rounded-full bg-cyan-200" style={{ width: `${Math.min(100, (count / Math.max(1, result.itemsTotal)) * 100)}%` }} />
                        </span>
                        <span className="text-right font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-white/45">
                    Предметов: {result.itemsTotal}, в среднем {result.averageItemsPerBox} за коробку. Статусы: {statusTotal}.
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
        <Search className="h-4 w-4 text-cyan-100" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, slug или типу" className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/38 focus-visible:ring-0" />
      </div>

      {message && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-cyan-200/25 bg-slate-950/95 px-4 py-3 text-sm text-cyan-50 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">{message}</div>}

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card className="border-white/10 bg-card/70">
          <CardHeader>
            <CardTitle>Список коробок</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {boxes.map((box) => (
              <button
                key={box.uuid}
                type="button"
                onClick={() => setSelectedUuid(box.uuid)}
                className={cn("flex items-center gap-3 rounded-2xl border p-3 text-left transition", huntInteractiveClass, selectedUuid === box.uuid ? "border-cyan-200/40 bg-cyan-200/12" : "border-white/10 bg-white/[0.035]")}
              >
                <Image src={mediaSrc(box.imageUrl)} alt="" width={72} height={72} className="h-16 w-16 rounded-xl object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{box.title}</span>
                  <span className="mt-1 block text-xs text-white/50">{box.type} · {box.itemCountMin === box.itemCountMax ? box.itemCountMin : `${box.itemCountMin}-${box.itemCountMax}`} предмета</span>
                </span>
                {box.isActive && <CheckCircle2 className="h-4 w-4 text-cyan-100" />}
              </button>
            ))}
          </CardContent>
        </Card>

        {selected && (
          <div className="space-y-4">
            <Card className="border-white/10 bg-card/70">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{selected.title}</CardTitle>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" disabled={saving != null} onClick={() => void deleteBox(selected.uuid)} className={cn("rounded-2xl border-rose-200/20 bg-rose-500/10 text-rose-50 hover:bg-rose-500/18", huntInteractiveClass)}>
                    <Trash2 className="h-4 w-4" /> Удалить
                  </Button>
                  <Button disabled={saving != null} onClick={() => void saveBox(selected.uuid)} className={cn("rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}>
                    <Save className="h-4 w-4" /> Сохранить
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <FieldShell label="Название">
                  <Input value={selected.title} onChange={(event) => patchBox(selected.uuid, { title: event.target.value })} placeholder="Название" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                </FieldShell>
                <FieldShell label="Картинка" hint="Путь к ассету коробки, например /hunt-assets/shop/promo-box.png">
                  <Input value={selected.imageUrl ?? ""} onChange={(event) => patchBox(selected.uuid, { imageUrl: event.target.value })} placeholder="Картинка" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                </FieldShell>
                <FieldShell label="Описание">
                  <Textarea value={selected.description} onChange={(event) => patchBox(selected.uuid, { description: event.target.value })} placeholder="Описание" className="min-h-24 rounded-2xl border-white/10 bg-white/[0.04]" />
                </FieldShell>
                <div className="grid gap-3 rounded-3xl border border-white/10 bg-white/[0.025] p-3 sm:grid-cols-2">
                  <FieldShell label="Стоимость" hint="Цена открытия в NearCoin">
                    <Input type="number" min={0} step={1} value={selected.cost} onChange={(event) => patchBox(selected.uuid, { cost: boundedNumberValue(event.target.value) })} placeholder="Стоимость" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                  </FieldShell>
                  <FieldShell label="Шанс статуса" hint="В basis points: 550 = 5.5%">
                    <Input type="number" min={0} max={10000} step={1} value={selected.statusDropChanceBp} onChange={(event) => patchBox(selected.uuid, { statusDropChanceBp: boundedNumberValue(event.target.value, 0, 0, 10000) })} placeholder="Шанс статуса" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                  </FieldShell>
                  <FieldShell label="Гарант редкости" hint="Какая редкость гарантируется">
                    <SelectField value={selected.guaranteedRarity ?? ""} onChange={(event) => patchBox(selected.uuid, { guaranteedRarity: event.target.value || null })} className="rounded-2xl border-white/10 bg-white/[0.04]">
                      <option value="">Без гаранта</option>
                      {(data?.rarities ?? []).map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                    </SelectField>
                  </FieldShell>
                  <FieldShell label="Кол-во гаранта" hint="Сколько предметов из открытия гарантированы">
                    <Input type="number" min={0} max={10} step={1} value={selected.guaranteedCount} onChange={(event) => patchBox(selected.uuid, { guaranteedCount: boundedNumberValue(event.target.value, 0, 0, 10) })} placeholder="Кол-во гаранта" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                  </FieldShell>
                  <FieldShell label="Предметов от" hint="Минимум за одно открытие">
                    <Input type="number" min={1} max={10} step={1} value={selected.itemCountMin} onChange={(event) => patchBox(selected.uuid, { itemCountMin: boundedNumberValue(event.target.value, 1, 1, 10) })} placeholder="От" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                  </FieldShell>
                  <FieldShell label="Предметов до" hint="Максимум за одно открытие">
                    <Input type="number" min={1} max={10} step={1} value={selected.itemCountMax} onChange={(event) => patchBox(selected.uuid, { itemCountMax: boundedNumberValue(event.target.value, 1, 1, 10) })} placeholder="До" className="rounded-2xl border-white/10 bg-white/[0.04]" />
                  </FieldShell>
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm">
                  Активна <Switch checked={selected.isActive} onCheckedChange={(value) => patchBox(selected.uuid, { isActive: value })} />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm">
                  Можно купить <Switch checked={selected.isPurchasable} onCheckedChange={(value) => patchBox(selected.uuid, { isPurchasable: value })} />
                </label>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldQuestion className="h-5 w-5 text-cyan-100" /> Редкости</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {selected.rarityChances.map((chance) => (
                  <div key={chance.rarity} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 md:grid-cols-[180px_1fr_120px_auto] md:items-center">
                    <div className="flex items-center gap-2">
                      <Badge className={cn("w-fit", rarityBadgeClass[chance.rarity as keyof typeof rarityBadgeClass])}>{chance.rarity}</Badge>
                    </div>
                    <div className="grid gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-xs text-white/45">
                        <span>Вес выпадения</span>
                        <span>Шанс: {chance.chance.toFixed(chance.chance < 1 ? 2 : 1)}%</span>
                      </div>
                      <Input type="number" min={0} step={1} value={chance.weight} onChange={(event) => patchRarity(selected.uuid, chance.rarity, { weight: boundedNumberValue(event.target.value) })} className="h-10 rounded-xl border-white/10 bg-black/20" />
                    </div>
                    <div className="text-sm text-white/58 md:text-right">
                      {chance.enabled ? "Включена" : "Выключена"}
                    </div>
                    <Switch checked={chance.enabled} onCheckedChange={(value) => patchRarity(selected.uuid, chance.rarity, { enabled: value })} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-cyan-100" /> Персонажи</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {(data?.species ?? []).map((species) => {
                  const rule = selected.speciesRules.find((item) => item.speciesId === species.id);
                  return (
                    <div key={species.id} className="grid grid-cols-[52px_1fr_96px_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                      <Image src={mediaSrc(species.imageUrl)} alt="" width={56} height={56} className="h-12 w-12 rounded-xl object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{species.name}</p>
                        <ElementBadge element={species.element as never} />
                      </div>
                      <Input type="number" min={0} step={1} value={rule?.weight ?? 100} onChange={(event) => patchSpecies(selected.uuid, species.id, { weight: boundedNumberValue(event.target.value) })} className="h-9 rounded-xl border-white/10 bg-black/20" />
                      <Switch checked={rule?.enabled ?? species.isActive} onCheckedChange={(value) => patchSpecies(selected.uuid, species.id, { enabled: value })} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tags className="h-5 w-5 text-amber-100" /> Статусы Nearloy</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {(data?.statuses ?? []).map((status) => {
                  const rule = selected.statusChances.find((item) => item.statusId === status.id);
                  return (
                    <div key={status.id} className="grid grid-cols-[1fr_90px_90px_auto] items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{status.title}</p>
                        <p className="text-xs text-white/45">{status.rarity}</p>
                      </div>
                      <Input type="number" min={0} step={1} value={rule?.weight ?? 100} onChange={(event) => patchStatus(selected.uuid, status.id, { weight: boundedNumberValue(event.target.value) })} className="h-9 rounded-xl border-white/10 bg-black/20" />
                      <SelectField value={rule?.rarity ?? status.rarity} onChange={(event) => patchStatus(selected.uuid, status.id, { rarity: event.target.value })} className="h-9 rounded-xl border-white/10 bg-black/20">
                        {(data?.statusRarities ?? []).map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                      </SelectField>
                      <Switch checked={rule?.enabled ?? status.isActive} onCheckedChange={(value) => patchStatus(selected.uuid, status.id, { enabled: value })} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
