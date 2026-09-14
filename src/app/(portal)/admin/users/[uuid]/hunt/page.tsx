"use client";

import { useEffect, useMemo, useState } from "react";
import { Gift, RefreshCw, Sparkles, Trash2, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  adminAdjustUserHuntCurrency,
  adminCancelUserHuntGift,
  adminCreateUserHuntGift,
  adminDeleteUserHuntCard,
  adminGetUserHunt,
  type AdminUserHuntResponse,
} from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";
import { UserPageShellHeader, UserPageState, useAdminUserProfile } from "../_components/user-detail";

const rarities = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];

function speciesName(species: { name: string; nameRu: string | null; nameEn: string | null }) {
  return species.nameRu ?? species.nameEn ?? species.name;
}

function StatTile({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AdminUserHuntPage() {
  const { userUuid, user, loading, error, setError } = useAdminUserProfile();
  const [data, setData] = useState<AdminUserHuntResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currencyAmount, setCurrencyAmount] = useState("");
  const [currencyNote, setCurrencyNote] = useState("");
  const [giftSpeciesId, setGiftSpeciesId] = useState("");
  const [giftRarity, setGiftRarity] = useState("");
  const [giftLevel, setGiftLevel] = useState("1");
  const [giftNote, setGiftNote] = useState("");

  async function loadHunt() {
    if (!userUuid) return;
    setBusy(true);
    const result = await adminGetUserHunt(userUuid);
    setBusy(false);
    if (!result.ok) {
      setError(String(result.message));
      return;
    }
    setError(null);
    setData(result.data);
    if (!giftSpeciesId) setGiftSpeciesId(result.data.species[0]?.id ?? "");
  }

  useEffect(() => {
    void loadHunt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userUuid]);

  const pendingGifts = useMemo(() => data?.gifts.filter((gift) => gift.status === "PENDING") ?? [], [data]);

  async function applyCurrency() {
    if (!userUuid) return;
    const amount = Number(currencyAmount);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Введите целое число NearCoin, не равное нулю.");
      return;
    }
    setBusy(true);
    const result = await adminAdjustUserHuntCurrency(userUuid, { amount, note: currencyNote });
    setBusy(false);
    if (!result.ok) {
      setError(String(result.message));
      return;
    }
    setError(null);
    setNotice("Баланс NearCoin обновлён.");
    setCurrencyAmount("");
    setCurrencyNote("");
    setData(result.data);
  }

  async function createGift() {
    if (!userUuid || !giftSpeciesId) return;
    setBusy(true);
    const result = await adminCreateUserHuntGift(userUuid, {
      speciesId: giftSpeciesId,
      rarity: giftRarity || undefined,
      level: Number(giftLevel) || 1,
      note: giftNote,
    });
    setBusy(false);
    if (!result.ok) {
      setError(String(result.message));
      return;
    }
    setError(null);
    setNotice("Подарок создан. Пользователь увидит его при входе в Hunt.");
    setGiftNote("");
    setData(result.data);
  }

  async function cancelGift(giftUuid: string) {
    if (!userUuid) return;
    setBusy(true);
    const result = await adminCancelUserHuntGift(userUuid, giftUuid);
    setBusy(false);
    if (!result.ok) {
      setError(String(result.message));
      return;
    }
    setError(null);
    setNotice("Подарок отменён.");
    setData(result.data);
  }

  async function deleteCard(cardUuid: string, name: string) {
    if (!userUuid) return;
    if (!window.confirm(`Удалить карту «${name}» из коллекции пользователя?`)) return;
    setBusy(true);
    const result = await adminDeleteUserHuntCard(userUuid, cardUuid);
    setBusy(false);
    if (!result.ok) {
      setError(String(result.message));
      return;
    }
    setError(null);
    setNotice("Карта удалена из коллекции.");
    setData(result.data);
  }

  const state = <UserPageState loading={loading} error={error && !user ? error : null} />;
  if (loading || !user) return state;

  return (
    <div className="space-y-5 pb-8">
      <UserPageShellHeader user={user} active="hunt" />

      {(error || notice) && (
        <Card className="glass border-white/10">
          <CardContent className="py-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {notice && <p className="text-sm text-emerald-300">{notice}</p>}
          </CardContent>
        </Card>
      )}

      {!data && !busy && (
        <p className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-50">
          Не удалось загрузить Hunt-слой пользователя.
        </p>
      )}

      {data && (
        <>
          <section className="grid gap-3 md:grid-cols-5">
            <StatTile title="NearCoin" value={data.profile.influenceBalance} />
            <StatTile title="Всего получено" value={data.profile.lifetimeInfluence} />
            <StatTile title="Уровень" value={`${data.profile.level} · ${data.profile.xp} xp`} />
            <StatTile title="Карты" value={data.cards.length} />
            <StatTile title="Подарки" value={pendingGifts.length} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="glass border-cyan-200/15">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-cyan-100" /> Валюта
                </CardTitle>
                <CardDescription>Положительное число начисляет NearCoin, отрицательное списывает.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={currencyAmount} onChange={(event) => setCurrencyAmount(event.target.value)} placeholder="+100 или -50" />
                <Textarea value={currencyNote} onChange={(event) => setCurrencyNote(event.target.value)} placeholder="Комментарий для истории" rows={3} />
                <Button onClick={() => void applyCurrency()} disabled={busy || !currencyAmount.trim()}>
                  <WalletCards className="h-4 w-4" /> Применить
                </Button>
              </CardContent>
            </Card>

            <Card className="glass border-cyan-200/15">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-cyan-100" /> Подарок персонажа
                </CardTitle>
                <CardDescription>Карта появится у пользователя только после принятия подарка в Hunt.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[1.2fr_0.7fr_0.45fr]">
                <SelectField value={giftSpeciesId} onChange={(event) => setGiftSpeciesId(event.target.value)}>
                  {data.species.map((item) => (
                    <option key={item.id} value={item.id}>
                      {speciesName(item)} · {item.baseRarity} · {item.element}
                    </option>
                  ))}
                </SelectField>
                <SelectField value={giftRarity} onChange={(event) => setGiftRarity(event.target.value)}>
                  <option value="">Редкость персонажа</option>
                  {rarities.map((rarity) => <option key={rarity} value={rarity}>{rarity}</option>)}
                </SelectField>
                <Input value={giftLevel} onChange={(event) => setGiftLevel(event.target.value)} placeholder="ур." />
                <Textarea className="md:col-span-3" value={giftNote} onChange={(event) => setGiftNote(event.target.value)} placeholder="Подпись к подарку" rows={3} />
                <div className="md:col-span-3">
                  <Button onClick={() => void createGift()} disabled={busy || !giftSpeciesId}>
                    <Gift className="h-4 w-4" /> Создать подарок
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card className="glass border-white/10">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Подарки</CardTitle>
                <CardDescription>Pending-подарки ждут принятия пользователем.</CardDescription>
              </div>
              <Button variant="secondary" onClick={() => void loadHunt()} disabled={busy}>
                <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Обновить
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.gifts.map((gift) => (
                <div key={gift.uuid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-start gap-3">
                    {gift.species.imageUrl && <img src={gift.species.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{speciesName(gift.species)}</p>
                      <p className="text-xs text-muted-foreground">{gift.rarity ?? gift.species.baseRarity} · ур. {gift.level}</p>
                      <Badge className="mt-2" variant={gift.status === "PENDING" ? "default" : "secondary"}>{gift.status}</Badge>
                    </div>
                  </div>
                  {gift.note && <p className="mt-3 text-sm text-muted-foreground">{gift.note}</p>}
                  {gift.status === "PENDING" && (
                    <Button className="mt-3" size="sm" variant="secondary" onClick={() => void cancelGift(gift.uuid)} disabled={busy}>
                      Отменить
                    </Button>
                  )}
                </div>
              ))}
              {data.gifts.length === 0 && <p className="text-sm text-muted-foreground">Подарков пока нет.</p>}
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle>Коллекция</CardTitle>
              <CardDescription>Просмотр и удаление карточек пользователя.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.cards.map((card) => {
                const name = speciesName(card.species);
                return (
                  <div key={card.uuid} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    {card.species.imageUrl && <img src={card.species.imageUrl} alt="" className="aspect-square w-full rounded-xl object-cover" />}
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{name}</p>
                        <p className="text-xs text-muted-foreground">{card.rarity} · {card.element} · ур. {card.level} · рез. {card.fusionRank}</p>
                      </div>
                      <Button size="icon" variant="destructive" onClick={() => void deleteCard(card.uuid, name)} disabled={busy || card.isLocked}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs text-muted-foreground">
                      <span>HP {card.stats.health ?? 0}</span>
                      <span>ATK {card.stats.attack ?? 0}</span>
                      <span>LCK {card.stats.luck ?? 0}</span>
                      <span>EVA {card.stats.evasion ?? 0}</span>
                    </div>
                  </div>
                );
              })}
              {data.cards.length === 0 && <p className="text-sm text-muted-foreground">Коллекция пуста.</p>}
            </CardContent>
          </Card>

          <Card className="glass border-white/10">
            <CardHeader>
              <CardTitle>История NearCoin</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-4">Дата</th>
                    <th className="py-2 pr-4">Сумма</th>
                    <th className="py-2 pr-4">Причина</th>
                    <th className="py-2">Баланс</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ledger.map((row) => (
                    <tr key={row.uuid} className="border-b border-white/5">
                      <td className="py-2 pr-4">{new Date(row.createdAt).toLocaleString("ru-RU")}</td>
                      <td className={cn("py-2 pr-4 font-semibold", row.amount >= 0 ? "text-emerald-300" : "text-rose-300")}>{row.amount > 0 ? `+${row.amount}` : row.amount}</td>
                      <td className="py-2 pr-4">{row.reason}</td>
                      <td className="py-2">{row.balanceAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
