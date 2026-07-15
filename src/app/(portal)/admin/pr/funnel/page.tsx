"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, GripVertical, Plus, RefreshCcw, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type PipelineStatus = "LEAD" | "NEGOTIATION" | "TRIAL" | "CONNECTED" | "REVENUE_ACTIVE" | "LOST";
type FunnelModalMode = "create" | "edit";

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

function makeDraft(status: PipelineStatus): FunnelDraft {
  return { ...emptyDraft, status };
}

export default function AdminPrFunnelPage() {
  const [items, setItems] = useState<FunnelItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggingUuid, setDraggingUuid] = useState("");
  const [modalMode, setModalMode] = useState<FunnelModalMode | null>(null);
  const [modalDraft, setModalDraft] = useState<FunnelDraft>(makeDraft("LEAD"));
  const [activeUuid, setActiveUuid] = useState("");

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

  const modalColumn = columns.find((column) => column.status === modalDraft.status) ?? columns[0];
  const modalSaving = saving === "modal" || saving === activeUuid;

  function closeModal() {
    setModalMode(null);
    setActiveUuid("");
    setModalDraft(makeDraft("LEAD"));
  }

  function openCreate(status: PipelineStatus) {
    setError("");
    setNotice("");
    setActiveUuid("");
    setModalDraft(makeDraft(status));
    setModalMode("create");
  }

  function openEdit(item: FunnelItem) {
    setError("");
    setNotice("");
    setActiveUuid(item.uuid);
    setModalDraft(normalizeDraft(item));
    setModalMode("edit");
  }

  async function createItem(nextDraft: FunnelDraft) {
    if (!nextDraft.name.trim()) {
      setError("Введите название компании.");
      return false;
    }
    setSaving("modal");
    setError("");
    setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextDraft),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось создать карточку.");
      setSaving("");
      return false;
    }
    const item = (await response.json()) as FunnelItem;
    setItems((current) => [item, ...current]);
    setNotice("Карточка добавлена в воронку.");
    setSaving("");
    closeModal();
    return true;
  }

  async function updateItem(uuid: string, patch?: Partial<FunnelDraft>, options?: { closeModal?: boolean; silent?: boolean }) {
    const currentItem = items.find((item) => item.uuid === uuid);
    const next = { ...(currentItem ? normalizeDraft(currentItem) : makeDraft("LEAD")), ...(patch ?? {}) };
    if (!next.name.trim()) {
      setError("Название компании не может быть пустым.");
      return false;
    }
    setSaving(uuid);
    setError("");
    if (!options?.silent) setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/funnel", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid, ...next }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось сохранить карточку.");
      setSaving("");
      return false;
    }
    const item = (await response.json()) as FunnelItem;
    setItems((current) => current.map((currentItem) => (currentItem.uuid === uuid ? item : currentItem)));
    if (!options?.silent) setNotice("Карточка обновлена.");
    setSaving("");
    if (options?.closeModal) closeModal();
    return true;
  }

  async function saveModal() {
    if (modalMode === "create") {
      await createItem(modalDraft);
      return;
    }
    if (modalMode === "edit" && activeUuid) {
      await updateItem(activeUuid, modalDraft, { closeModal: true });
    }
  }

  async function deleteItem(uuid: string, options?: { closeModal?: boolean }) {
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
    setSaving("");
    if (options?.closeModal) closeModal();
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
                if (draggingUuid) void updateItem(draggingUuid, { status: column.status }, { silent: true });
                setDraggingUuid("");
              }}
              className={cn(
                "min-h-[520px] rounded-[1.75rem] border border-white/10 bg-gradient-to-b p-3",
                column.tone,
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{column.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{column.hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="border-white/10 bg-black/25">{grouped[column.status].length}</Badge>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="secondary"
                    className="rounded-full border border-white/10 bg-white/10 hover:bg-white/15"
                    aria-label={`Добавить компанию в этап ${column.title}`}
                    onClick={() => openCreate(column.status)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {grouped[column.status].map((item) => (
                  <article
                    key={item.uuid}
                    draggable
                    role="button"
                    tabIndex={0}
                    onClick={() => openEdit(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") openEdit(item);
                    }}
                    onDragStart={() => setDraggingUuid(item.uuid)}
                    onDragEnd={() => setDraggingUuid("")}
                    className="group flex cursor-pointer items-center gap-3 rounded-3xl border border-white/10 bg-black/35 p-3 shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-cyan-200/25 hover:bg-black/45 focus:outline-none focus:ring-2 focus:ring-cyan-200/30"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground transition group-hover:text-cyan-100" />
                    <p className="min-w-0 truncate font-semibold">{item.name}</p>
                  </article>
                ))}
                {!grouped[column.status].length && (
                  <button
                    type="button"
                    onClick={() => openCreate(column.status)}
                    className="flex min-h-28 w-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 p-5 text-sm text-muted-foreground transition hover:border-cyan-200/30 hover:bg-white/[0.03] hover:text-cyan-100"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25">
                      <Plus className="h-4 w-4" />
                    </span>
                    <span>Добавить компанию на этот этап</span>
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Dialog open={Boolean(modalMode)} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="nearloy-scrollbar max-h-[92vh] max-w-3xl overflow-y-auto rounded-[2rem] border-cyan-300/15 bg-[#070b10] p-0 shadow-2xl shadow-black/50">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_0%_0%,rgba(103,232,249,0.16),transparent_40%),rgba(255,255,255,0.025)] p-5">
            <DialogHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
                  {modalColumn.title}
                </Badge>
                <Badge variant="outline" className="border-white/10 bg-black/25">
                  {modalMode === "create" ? "Новая компания" : "Редактирование"}
                </Badge>
              </div>
              <DialogTitle className="text-2xl">
                {modalMode === "create" ? "Добавить компанию в воронку" : modalDraft.name || "Карточка компании"}
              </DialogTitle>
              <DialogDescription>
                На доске показываем только название. Контакт, источник и договорённости храним здесь.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-4 p-5">
            <label className="grid gap-2 text-sm font-medium">
              Название компании
              <Input
                value={modalDraft.name}
                onChange={(event) => setModalDraft((current) => ({ ...current, name: event.target.value }))}
                maxLength={160}
                placeholder="Например, Aurora Coffee"
              />
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Комментарий
              <Textarea
                value={modalDraft.description}
                onChange={(event) => setModalDraft((current) => ({ ...current, description: event.target.value }))}
                maxLength={4000}
                className="min-h-[220px] resize-y"
                placeholder="Описание, договорённости, следующий шаг, важные детали общения..."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Контакт
                <Input
                  value={modalDraft.contact}
                  onChange={(event) => setModalDraft((current) => ({ ...current, contact: event.target.value }))}
                  maxLength={160}
                  placeholder="Телефон, Telegram, email"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Источник
                <Input
                  value={modalDraft.source}
                  onChange={(event) => setModalDraft((current) => ({ ...current, source: event.target.value }))}
                  maxLength={120}
                  placeholder="Лендинг, рекомендация, холодный контакт"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Этап
              <SelectField
                value={modalDraft.status}
                onChange={(event) => setModalDraft((current) => ({ ...current, status: event.target.value as PipelineStatus }))}
              >
                {columns.map((column) => (
                  <option key={column.status} value={column.status}>{column.title}</option>
                ))}
              </SelectField>
            </label>
          </div>

          <DialogFooter className="border-t border-white/10 p-5">
            {modalMode === "edit" && activeUuid && (
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => void deleteItem(activeUuid, { closeModal: true })}
                disabled={modalSaving}
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={closeModal} disabled={modalSaving}>
              Отмена
            </Button>
            <Button type="button" onClick={() => void saveModal()} disabled={modalSaving}>
              {modalSaving ? "Сохраняю..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
