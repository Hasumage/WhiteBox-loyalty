"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminListCategories,
  adminUpdateCategory,
  type AdminCategory,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

type CategoryDraft = {
  slug: string;
  name: string;
  description: string;
  icon: string;
};

const emptyDraft: CategoryDraft = { slug: "", name: "", description: "", icon: "Circle" };

export default function AdminCategoriesPage() {
  const { t } = useI18n("ru");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [draft, setDraft] = useState<CategoryDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => {
      return (
        cat.slug.toLowerCase().includes(q) ||
        cat.name.toLowerCase().includes(q) ||
        (cat.description ?? "").toLowerCase().includes(q) ||
        cat.icon.toLowerCase().includes(q)
      );
    });
  }, [categories, query]);

  async function load() {
    setCategories(await adminListCategories());
  }

  useEffect(() => {
    let ignore = false;
    void (async () => {
      const list = await adminListCategories();
      if (!ignore) setCategories(list);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  async function createCategory() {
    const res = await adminCreateCategory({
      slug: draft.slug,
      name: draft.name,
      description: draft.description || undefined,
      icon: draft.icon,
    });
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setDraft(emptyDraft);
    setError(null);
    await load();
  }

  async function updateCategory(id: number, patch: Partial<AdminCategory>) {
    setSavingId(id);
    const res = await adminUpdateCategory(id, patch);
    setSavingId(null);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    await load();
  }

  async function removeCategory(id: number) {
    const res = await adminDeleteCategory(id);
    if (!res.ok) {
      setError(String(res.message));
      return;
    }
    setError(null);
    await load();
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("admin.categories.title")}</h1>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.categories.createTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Input placeholder={t("admin.categories.slug")} value={draft.slug} onChange={(e) => setDraft((p) => ({ ...p, slug: e.target.value }))} />
          <Input placeholder={t("admin.categories.name")} value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
          <Input placeholder={t("admin.categories.description")} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
          <Input placeholder={t("admin.categories.iconName")} value={draft.icon} onChange={(e) => setDraft((p) => ({ ...p, icon: e.target.value }))} />
          <Button onClick={() => void createCategory()} disabled={!draft.slug || !draft.name || !draft.icon}>
            {t("admin.categories.create")}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">{t("admin.categories.crudTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("admin.categories.searchPlaceholder")}
              className="pl-9"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t("admin.categories.showing")} {filteredCategories.length} {t("admin.categories.of")} {categories.length} {t("admin.categories.categories")}
          </p>

          {filteredCategories.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-white/10 bg-muted/10 p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-primary/15 p-1.5">
                  <CategoryIcon iconName={cat.icon} className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold">{cat.name}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                <Input value={cat.slug} onChange={(e) => setCategories((prev) => prev.map((p) => p.id === cat.id ? { ...p, slug: e.target.value } : p))} />
                <Input value={cat.name} onChange={(e) => setCategories((prev) => prev.map((p) => p.id === cat.id ? { ...p, name: e.target.value } : p))} />
                <Input value={cat.description ?? ""} onChange={(e) => setCategories((prev) => prev.map((p) => p.id === cat.id ? { ...p, description: e.target.value } : p))} />
                <Input value={cat.icon} onChange={(e) => setCategories((prev) => prev.map((p) => p.id === cat.id ? { ...p, icon: e.target.value } : p))} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => void updateCategory(cat.id, { slug: cat.slug, name: cat.name, description: cat.description, icon: cat.icon })} disabled={savingId === cat.id}>
                  {t("admin.categories.save")}
                </Button>
                <Button variant="destructive" onClick={() => void removeCategory(cat.id)}>
                  {t("admin.categories.delete")}
                </Button>
              </div>
            </div>
          ))}
          {filteredCategories.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              {t("admin.categories.empty")}
            </div>
          )}
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
