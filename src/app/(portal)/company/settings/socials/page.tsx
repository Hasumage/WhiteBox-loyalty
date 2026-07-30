"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe2, Loader2, MessageCircle, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  companySocialLinks,
  createCompanySocialLink,
  deleteCompanySocialLink,
  updateCompanySocialLink,
  type CompanySocialLink,
  type CompanySocialLinkKind,
  type CompanySocialLinksState,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

const kindOptions: Array<{ value: CompanySocialLinkKind; label: string }> = [
  { value: "OTHER", label: "Обычная ссылка" },
  { value: "WEBSITE", label: "Сайт" },
  { value: "VK", label: "VK" },
  { value: "MAX", label: "MAX" },
];

function LinkIcon({ kind }: { kind: CompanySocialLinkKind }) {
  if (kind === "VK") return <span className="text-sm font-black">VK</span>;
  if (kind === "MAX") return <MessageCircle className="h-5 w-5" />;
  if (kind === "WEBSITE") return <Globe2 className="h-5 w-5" />;
  return <ExternalLink className="h-5 w-5" />;
}

function emptyDraft(): { title: string; url: string; kind: CompanySocialLinkKind } {
  return { title: "", url: "", kind: "OTHER" };
}

export default function CompanySocialLinksPage() {
  const [state, setState] = useState<CompanySocialLinksState | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setState(await companySocialLinks());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить ссылки.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const maxLinks = state?.maxLinks ?? 5;
  const links = state?.links ?? [];
  const limitReached = links.length >= maxLinks;

  async function addLink() {
    if (!draft.url.trim()) {
      setError("Укажите ссылку.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await createCompanySocialLink(draft);
      setDraft(emptyDraft());
      setMessage("Ссылка добавлена.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось добавить ссылку.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(link: CompanySocialLink) {
    setEditingId(link.id);
    setEditingDraft({ title: link.title, url: link.url, kind: link.kind });
    setError("");
    setMessage("");
  }

  async function saveEdit(id: string) {
    try {
      setSaving(true);
      setError("");
      await updateCompanySocialLink(id, editingDraft);
      setEditingId(null);
      setMessage("Ссылка обновлена.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить ссылку.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(id: string) {
    if (!window.confirm("Удалить ссылку из публичной карточки?")) return;
    try {
      setError("");
      await deleteCompanySocialLink(id);
      setMessage("Ссылка удалена.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось удалить ссылку.");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.16),transparent_34%),rgba(255,255,255,0.035)] p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            <ExternalLink className="h-4 w-4" /> Публичные ссылки
          </p>
          <h1 className="text-3xl font-semibold">Сайт и социальные сети</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Добавьте до {maxLinks} ссылок, которые увидят клиенты в публичной карточке компании. Для сайта, VK и MAX показываются отдельные иконки.
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

      <Card className="glass border-white/10 py-0">
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 lg:grid-cols-[180px_1fr_1fr_auto]">
            <select
              value={draft.kind}
              disabled={limitReached || saving}
              onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as CompanySocialLinkKind }))}
              className="h-12 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none"
            >
              {kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <Input disabled={limitReached || saving} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Название, например Instagram или меню" className="h-12 rounded-xl" />
            <Input disabled={limitReached || saving} value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." className="h-12 rounded-xl" />
            <Button type="button" disabled={limitReached || saving} className="h-12 rounded-xl" onClick={() => void addLink()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Использовано {links.length} из {maxLinks}. Поддерживаются только публичные http/https ссылки.</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="rounded-3xl border border-white/10 p-8 text-muted-foreground">Загружаем ссылки…</div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const editing = editingId === link.id;
            return (
              <Card key={link.id} className="glass border-white/10 py-0">
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                      <LinkIcon kind={editing ? editingDraft.kind : link.kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {editing ? (
                        <div className="grid gap-2 lg:grid-cols-[150px_1fr_1fr]">
                          <select value={editingDraft.kind} onChange={(event) => setEditingDraft((current) => ({ ...current, kind: event.target.value as CompanySocialLinkKind }))} className="h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none">
                            {kindOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          <Input value={editingDraft.title} onChange={(event) => setEditingDraft((current) => ({ ...current, title: event.target.value }))} className="h-10 rounded-xl" />
                          <Input value={editingDraft.url} onChange={(event) => setEditingDraft((current) => ({ ...current, url: event.target.value }))} className="h-10 rounded-xl" />
                        </div>
                      ) : (
                        <>
                          <p className="font-semibold">{link.title}</p>
                          <a href={link.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-cyan-100 underline-offset-4 hover:underline">{link.url}</a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {editing ? (
                      <Button type="button" variant="secondary" className="rounded-xl" disabled={saving} onClick={() => void saveEdit(link.id)}>
                        <Save className="h-4 w-4" /> Сохранить
                      </Button>
                    ) : (
                      <Button type="button" variant="outline" className="rounded-xl border-white/10" onClick={() => startEdit(link)}>
                        <Pencil className="h-4 w-4" /> Изменить
                      </Button>
                    )}
                    <Button type="button" variant="outline" className="rounded-xl border-red-300/25 text-red-100" onClick={() => void removeLink(link.id)}>
                      <Trash2 className="h-4 w-4" /> Удалить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!links.length && <div className="rounded-3xl border border-dashed border-white/15 p-8 text-sm text-muted-foreground">Ссылок пока нет. Добавьте сайт, VK, MAX или другую публичную страницу.</div>}
        </div>
      )}
    </div>
  );
}
