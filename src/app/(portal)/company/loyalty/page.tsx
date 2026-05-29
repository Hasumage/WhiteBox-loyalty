"use client";

import { useEffect, useState } from "react";
import { Coins, Percent, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { companyProfile, updateCompanyLoyaltySettings } from "@/lib/api/company-client";

type SubscriptionSpendPolicy = "EXCLUDE" | "INCLUDE_NO_BONUS" | "INCLUDE_WITH_BONUS";
type LevelRule = { levelName: string; minTotalSpend: string; cashbackPercent: string };

const policyOptions: Array<{ value: SubscriptionSpendPolicy; title: string; detail: string }> = [
  { value: "EXCLUDE", title: "Не учитывать подписки", detail: "Подписки не влияют на уровень клиента и не начисляют баллы." },
  { value: "INCLUDE_NO_BONUS", title: "Учитывать в уровне", detail: "Стоимость подписки повышает уровень, но не начисляет баллы." },
  { value: "INCLUDE_WITH_BONUS", title: "Уровень и бонусы", detail: "Стоимость подписки повышает уровень и начисляет баллы." },
];

export default function CompanyLoyaltyPage() {
  const [canManage, setCanManage] = useState(false);
  const [policy, setPolicy] = useState<SubscriptionSpendPolicy>("EXCLUDE");
  const [levels, setLevels] = useState<LevelRule[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const profile = await companyProfile();
      setCanManage(profile.member.role !== "CASHIER");
      setPolicy(profile.company.subscriptionSpendPolicy);
      setLevels(profile.company.levels.map((level) => ({
        levelName: level.name,
        minTotalSpend: String(level.minimumSpend),
        cashbackPercent: String(level.cashbackPercent),
      })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить программу уровней.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    const normalized = levels
      .filter((level) => level.levelName.trim())
      .map((level) => ({
        levelName: level.levelName.trim(),
        minTotalSpend: Number(level.minTotalSpend),
        cashbackPercent: Number(level.cashbackPercent),
      }))
      .sort((a, b) => a.minTotalSpend - b.minTotalSpend);
    if (!normalized.length) {
      setError("Добавьте хотя бы один уровень лояльности.");
      return;
    }
    if (normalized.some((level) => !Number.isFinite(level.minTotalSpend) || level.minTotalSpend < 0 || !Number.isFinite(level.cashbackPercent) || level.cashbackPercent < 0 || level.cashbackPercent > 100)) {
      setError("Порог должен быть положительным, а начисление баллов - от 0 до 100% стоимости покупки.");
      return;
    }
    if (normalized.some((level, index) => index > 0 && level.cashbackPercent < normalized[index - 1].cashbackPercent)) {
      setError("Уровень с большим порогом не может начислять меньше баллов за покупку.");
      return;
    }
    try {
      setError("");
      await updateCompanyLoyaltySettings({ subscriptionSpendPolicy: policy, levelRules: normalized });
      setMessage("Программа уровней и начисление баллов сохранены.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить уровни.");
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">Лояльность</p>
        <h1 className="text-3xl font-semibold">Уровни и баллы</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Настройте пороги покупок и процент начисления баллов. Кассир будет видеть рассчитанный уровень на экране обслуживания клиента.
        </p>
      </header>
      {(error || message) && (
        <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>
          {error || message}
        </div>
      )}
      <Card className="glass border-white/10 py-0">
        <CardContent className="space-y-6 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><SlidersHorizontal className="h-4 w-4 text-cyan-100" /> Покупки подписок и уровень</h2>
            <p className="mt-1 text-sm text-muted-foreground">Отдельно выберите, влияют ли оплаты подписок на программу баллов.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {policyOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={!canManage}
                onClick={() => setPolicy(option.value)}
                className={`rounded-2xl border p-4 text-left transition ${policy === option.value ? "border-cyan-200/35 bg-cyan-200/[0.08]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.045]"}`}
              >
                <p className="font-semibold">{option.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.detail}</p>
              </button>
            ))}
          </div>
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Coins className="h-4 w-4 text-cyan-100" /> Уровни клиентов</h2>
            <p className="mt-1 text-sm text-muted-foreground">Чем выше уровень клиента, тем больше его сумма покупок и не меньше процент начисляемых баллов.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="hidden grid-cols-[1fr_190px_180px_52px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:grid">
              <span>Название уровня</span><span>Покупки от, ₽</span><span>Начислять баллов, %</span><span />
            </div>
            <div className="space-y-3 p-3">
              {levels.map((level, index) => (
                <div key={`${index}-${level.levelName}`} className="grid gap-2 rounded-xl bg-white/[0.02] p-2 sm:grid-cols-[1fr_190px_180px_52px] sm:items-center">
                  <Input disabled={!canManage} value={level.levelName} onChange={(event) => setLevels((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, levelName: event.target.value } : row))} placeholder="Например, Серебро" className="h-11 rounded-xl" />
                  <Input disabled={!canManage} type="number" min={0} value={level.minTotalSpend} onChange={(event) => setLevels((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, minTotalSpend: event.target.value } : row))} className="h-11 rounded-xl" />
                  <div className="space-y-1">
                    <Input disabled={!canManage} type="number" min={0} max={100} value={level.cashbackPercent} onChange={(event) => setLevels((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cashbackPercent: event.target.value } : row))} className="h-11 rounded-xl" />
                    {canManage && <div className="flex gap-1">{[1, 5, 10].map((value) => <button key={value} type="button" onClick={() => setLevels((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, cashbackPercent: String(value) } : row))} className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{value}%</button>)}</div>}
                  </div>
                  {canManage && <Button type="button" size="icon" variant="ghost" onClick={() => setLevels((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} className="text-red-200 hover:bg-red-300/10 hover:text-red-100"><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
          {canManage && <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setLevels((rows) => [...rows, { levelName: `Уровень ${rows.length + 1}`, minTotalSpend: "0", cashbackPercent: "0" }])}><Plus /> Добавить уровень</Button><Button onClick={() => void save()}><Percent /> Сохранить уровни</Button></div>}
        </CardContent>
      </Card>
    </div>
  );
}
