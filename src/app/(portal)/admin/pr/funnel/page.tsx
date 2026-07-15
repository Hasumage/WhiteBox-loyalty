"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, GripVertical, Plus, RefreshCcw, Save, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type PipelineStatus = "LEAD" | "NEGOTIATION" | "TRIAL" | "CONNECTED" | "REVENUE_ACTIVE" | "LOST";

type FunnelItem = {
  uuid: string;
  name: string;
  description: string | null;
  status: PipelineStatus;
  source: string | null;
  contact: string | null;
  position: number;
  updatedAt: string;
  owner: {
    uuid: string;
    name: string | null;
    email: string;
  };
};

type FunnelDraft = {
  name: string;
  description: string;
  source: string;
  contact: string;
  status: PipelineStatus;
};

const emptyDraft: FunnelDraft = {
  name: "",
  description: "",
  source: "",
  contact: "",
  status: "LEAD",
};

const columns: Array<{
  status: PipelineStatus;
  title: string;
  hint: string;
  tone: string;
}> = [
  { status: "LEAD", title: "Новый лид", hint: "Только нашли компанию", tone: "from-sky-400/18 to-cyan-300/5" },
  { status: "NEGOTIATION", title: "Переговоры", hint: "Есть контакт и интерес", tone: "from-violet-400/18 to-fuchsia-300/5" },
  { status: "TRIAL", title: "Тест", hint: "Демо, созвон, условия", tone: "from-amber-300/18 to-orange-300/5" },
  { status: "CONNECTED", title: "Договорились", hint: "Готовим подключение", tone: "from-emerald-300/18 to-teal-300/5" },
  { status: "REVENUE_ACTIVE", title: "Приносит прибыль", hint: "Компания уже даёт оборот", tone: "from-lime-300/20 to-emerald-300/5" },
  { status: "LOST", title: "Отказ", hint: "Закрыто без сделки", tone: "from-red-300/18 to-rose-300/5" },
];

function normalizeDraft(item: FunnelItem): FunnelDraft {
  return {
    name: item.name,
    description: item.description ?? "",
    source: item.source ?? "",
    contact: item.contact ?? "",
    status: item.status,
  };
}

function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminPrFunnelPage() {
  const [items, setItems] = useState<FunnelItem[]>([]);
  const [edits, setEdits] = useState<Record<string, FunnelDraft>>({});
  const [draft, setDraft] = useState<FunnelDraft>(emptyDraft);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggingUuid, setDraggingUuid] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/funnel", { cache: "no-store" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось загрузить воронку.");
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { items: FunnelItem[] };
    setItems(data.items);
    setEdits(Object.fromEntries(data.items.map((item) => [item.uuid, normalizeDraft(item)])));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) =>
      [item.name, item.description, item.source, item.contact, item.owner.name, item.owner.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [items, query]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.status,
          filteredItems
            .filter((item) => item.status === column.status)
            .sort((left, right) => left.position - right.position || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()),
        ]),
      ) as Record<PipelineStatus, FunnelItem[]>,
    [filteredItems],
  );

  async function createItem() {
    if (!draft.name.trim()) {
      setError("Введите название компании.");
      return;
    }
    setSaving("new");
    setError("");
    setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось создать карточку.");
      setSaving("");
      return;
    }
    const item = (await response.json()) as FunnelItem;
    setItems((current) => [item, ...current]);
    setEdits((current) => ({ ...current, [item.uuid]: normalizeDraft(item) }));
    setDraft(emptyDraft);
    setNotice("Карточка добавлена в воронку.");
    setSaving("");
  }

  async function updateItem(uuid: string, patch?: Partial<FunnelDraft>) {
    const next = { ...(edits[uuid] ?? emptyDraft), ...(patch ?? {}) };
    if (!next.name.trim()) {
      setError("Название компании не может быть пустым.");
      return;
    }
    setSaving(uuid);
    setError("");
    setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/funnel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid, ...next }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось сохранить карточку.");
      setSaving("");
      return;
    }
    const item = (await response.json()) as FunnelItem;
    setItems((current) => current.map((currentItem) => (currentItem.uuid === uuid ? item : currentItem)));
    setEdits((current) => ({ ...current, [uuid]: normalizeDraft(item) }));
    setNotice("Карточка обновлена.");
    setSaving("");
  }

  async function deleteItem(uuid: string) {
    if (!window.confirm("Удалить карточку из воронки?")) return;
    setSaving(uuid);
    setError("");
    const response = await fetchWithAuthRecovery(`/api/admin/pr/funnel?uuid=${encodeURIComponent(uuid)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось удалить карточку.");
      setSaving("");
      return;
    }
    setItems((current) => current.filter((item) => item.uuid !== uuid));
    setEdits((current) => {
      const next = { ...current };
      delete next[uuid];
      return next;
    });
    setSaving("");
  }

  function setEdit(uuid: string, patch: Partial<FunnelDraft>) {
    setEdits((current) => ({ ...current, [uuid]: { ...(current[uuid] ?? emptyDraft), ...patch } }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_10%_0%,rgba(103,232,249,0.14),transparent_34%),rgba(255,255,255,0.035)] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <Building2 className="h-3.5 w-3.5" /> PR CRM
            </Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Воронка компаний</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Черновые компании без аккаунта в NearLoy: ведите контакт от первого интереса до прибыли или отказа.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </section>

      <Card className="border-white/10 bg-white/[0.035] p-4">
        <div className="grid gap-3 xl:grid-cols-[1.1fr_1.4fr_0.8fr_0.8fr_180px] xl:items-end">
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            maxLength={160}
            placeholder="Название компании"
          />
          <Input
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
            maxLength={4000}
            placeholder="Короткое описание или что пообещали"
          />
          <Input
            value={draft.contact}
            onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))}
            maxLength={160}
            placeholder="Контакт"
          />
          <SelectField value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as PipelineStatus }))}>
            {columns.map((column) => (
              <option key={column.status} value={column.status}>{column.title}</option>
            ))}
          </SelectField>
          <Button onClick={() => void createItem()} disabled={saving === "new"}>
            <Plus className="h-4 w-4" />
            Добавить
          </Button>
        </div>
      </Card>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-11"
          placeholder="Поиск по названию, описанию, контакту..."
        />
      </div>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      <div className="overflow-x-auto pb-3 pr-1 [scrollbar-color:rgba(103,232,249,.45)_rgba(255,255,255,.06)] [scrollbar-width:thin]">
        <div className="grid min-w-[1380px] grid-cols-6 gap-3">
          {columns.map((column) => (
            <section
              key={column.status}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggingUuid) void updateItem(draggingUuid, { status: column.status });
                setDraggingUuid("");
              }}
              className={cn(
                "min-h-[520px] rounded-[1.75rem] border border-white/10 bg-gradient-to-b p-3",
                column.tone,
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{column.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{column.hint}</p>
                </div>
                <Badge variant="outline" className="border-white/10 bg-black/25">{grouped[column.status].length}</Badge>
              </div>

              <div className="space-y-3">
                {grouped[column.status].map((item) => {
                  const edit = edits[item.uuid] ?? normalizeDraft(item);
                  return (
                    <article
                      key={item.uuid}
                      draggable
                      onDragStart={() => setDraggingUuid(item.uuid)}
                      onDragEnd={() => setDraggingUuid("")}
                      className="rounded-3xl border border-white/10 bg-black/35 p-3 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-200/25"
                    >
                      <div className="mb-3 flex items-start gap-2">
                        <GripVertical className="mt-2 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                        <Input
                          value={edit.name}
                          onChange={(event) => setEdit(item.uuid, { name: event.target.value })}
                          maxLength={160}
                          className="h-10 border-white/10 bg-white/[0.04] font-semibold"
                        />
                      </div>
                      <Textarea
                        value={edit.description}
                        onChange={(event) => setEdit(item.uuid, { description: event.target.value })}
                        maxLength={4000}
                        className="min-h-20 border-white/10 bg-white/[0.035] text-sm"
                        placeholder="Описание, договорённости, следующий шаг"
                      />
                      <div className="mt-3 grid gap-2">
                        <Input
                          value={edit.contact}
                          onChange={(event) => setEdit(item.uuid, { contact: event.target.value })}
                          maxLength={160}
                          className="h-9 border-white/10 bg-white/[0.035]"
                          placeholder="Контакт"
                        />
                        <Input
                          value={edit.source}
                          onChange={(event) => setEdit(item.uuid, { source: event.target.value })}
                          maxLength={120}
                          className="h-9 border-white/10 bg-white/[0.035]"
                          placeholder="Источник"
                        />
                        <SelectField
                          value={edit.status}
                          onChange={(event) => {
                            const status = event.target.value as PipelineStatus;
                            setEdit(item.uuid, { status });
                            void updateItem(item.uuid, { status });
                          }}
                          className="border-white/10 bg-white/[0.035]"
                        >
                          {columns.map((option) => (
                            <option key={option.status} value={option.status}>{option.title}</option>
                          ))}
                        </SelectField>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">Обновлено: {date(item.updatedAt)}</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => void updateItem(item.uuid)} disabled={saving === item.uuid}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void deleteItem(item.uuid)} disabled={saving === item.uuid}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!grouped[column.status].length && (
                  <div className="rounded-3xl border border-dashed border-white/15 p-5 text-sm text-muted-foreground">
                    Пусто. Перетащите карточку сюда или создайте новую.
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
