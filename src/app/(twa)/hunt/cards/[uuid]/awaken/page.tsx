"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Info, Lock, RefreshCw, Sparkles, Star, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { awakenHuntCard, getHuntCard, type HuntBattleClass, type HuntCard, type HuntElement } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";
import { elementMeta, huntCreatureImageClass, huntInteractiveClass, huntSpeciesName, mediaSrc } from "../../../_components/hunt-ui";

const MAX_FUSION_RANK = 5;
const DUPLICATES_BY_TARGET_RANK: Record<number, number> = {
  2: 1,
  3: 1,
  4: 2,
  5: 3,
};

const battleClassMeta: Record<HuntBattleClass, { label: string; accent: string; effects: Record<number, { title: string; body: string; phrase: string }> }> = {
  GUARDIAN: {
    label: "Защитник",
    accent: "from-cyan-300 to-blue-500",
    effects: {
      2: { title: "Прочная основа", body: "Максимальное здоровье +8%.", phrase: "Стойкость начинается до первого удара." },
      3: { title: "Первый щит", body: "Первый раз за бой после получения урона получает щит на 12% от максимального здоровья.", phrase: "Щит появляется там, где команда верит." },
      4: { title: "Защитный импульс", body: "Активная способность дополнительно даёт себе и ближайшему союзнику щит на 10% от максимального здоровья Защитника.", phrase: "Защита сильнее, когда рядом есть кто-то свой." },
      5: { title: "Перехват беды", body: "Один раз за бой принимает на себя 50% смертельного урона, который должен был получить соседний союзник.", phrase: "Иногда победа держится на одном шаге вперёд." },
    },
  },
  DUELIST: {
    label: "Дуэлянт",
    accent: "from-sky-300 to-violet-500",
    effects: {
      2: { title: "Острый темп", body: "Атака +6%.", phrase: "Один точный удар громче толпы." },
      3: { title: "Честный бой", body: "Наносит на 12% больше урона цели, если рядом с ней нет других врагов.", phrase: "Когда поле пустеет, решает мастерство." },
      4: { title: "Удар после шага", body: "После перемещения следующая атака наносит на 15% больше урона.", phrase: "Лучший удар начинается с правильной позиции." },
      5: { title: "Второй выпад", body: "После успешной атаки получает 35% шанс на дополнительный ход.", phrase: "Настоящая дуэль редко заканчивается первым касанием." },
    },
  },
  FINISHER: {
    label: "Добиватель",
    accent: "from-orange-300 to-rose-500",
    effects: {
      2: { title: "Острый край", body: "Атака +7%.", phrase: "Финальный удар готовится заранее." },
      3: { title: "Охота на слабость", body: "Наносит на 18% больше урона врагам ниже 40% здоровья.", phrase: "Слабое место видно тому, кто не моргает." },
      4: { title: "Закрывающий приём", body: "Активная способность наносит на 22% больше урона по целям ниже 40% здоровья.", phrase: "Когда враг качнулся, бой уже почти решён." },
      5: { title: "Темп победы", body: "После добивания врага команда получает 1 резонанс, а Добиватель получает +12% атаки до конца боя.", phrase: "Одна победа тянет за собой следующую." },
    },
  },
  HEALER: {
    label: "Лекарь",
    accent: "from-emerald-300 to-cyan-500",
    effects: {
      2: { title: "Мягкое восстановление", body: "Эффективность лечения +8%.", phrase: "Силы возвращаются тихо." },
      3: { title: "Ближняя помощь", body: "В конце хода лечит самого раненого союзника рядом на 10% от максимального здоровья Лекаря.", phrase: "Рядом значит вовремя." },
      4: { title: "Глубокий отклик", body: "Активная способность дополнительно лечит цель на 15% от максимального здоровья Лекаря.", phrase: "Резонанс слышит тех, кто ещё держится." },
      5: { title: "Возвращение", body: "Один раз за бой воскрешает павшего союзника в зоне активной способности с 25% максимального здоровья. Эффект не тратит ход.", phrase: "Пока команда помнит тебя, бой не закончен." },
    },
  },
  CONTROLLER: {
    label: "Контроллер",
    accent: "from-violet-300 to-fuchsia-500",
    effects: {
      2: { title: "Точная помеха", body: "Шанс наложения контроля +8%.", phrase: "План врага ломается с маленькой задержки." },
      3: { title: "Сбитый шаг", body: "Атаки с 25% шансом снижают дальность перемещения врага на следующий ход.", phrase: "Если темп сбит, удар опаздывает." },
      4: { title: "Край точки", body: "Если Контроллер стоит рядом с точкой резонанса, он может захватить её без входа на центральную клетку точки.", phrase: "Контроль начинается за шаг до центра." },
      5: { title: "Срыв команды", body: "Первый успешный контроль в бою снимает у врага 1 действие и снижает его текущий резонанс на 20%.", phrase: "Лучший ход врага тот, которого не случилось." },
    },
  },
  CAPTOR: {
    label: "Захватчик",
    accent: "from-lime-300 to-emerald-500",
    effects: {
      2: { title: "Быстрый захват", body: "Скорость захвата точки +10%.", phrase: "Точка любит тех, кто приходит первым." },
      3: { title: "Удержание", body: "Если стоит на точке резонанса, в конце хода получает щит на 10% от максимального здоровья.", phrase: "Позиция защищает того, кто её заслужил." },
      4: { title: "Флаг резонанса", body: "При захвате точки ставит флаг. Флаг продолжает добывать резонанс после ухода персонажа с точки.", phrase: "След остаётся даже после шага вперёд." },
      5: { title: "Командный рывок", body: "Первая захваченная точка в бою даёт всей команде +8% к атаке до конца следующего хода.", phrase: "Карта отвечает тем, кто берёт инициативу." },
    },
  },
  BATTERY: {
    label: "Батарейка",
    accent: "from-cyan-300 to-fuchsia-500",
    effects: {
      2: { title: "Первый заряд", body: "Стартовый резонанс команды +10%.", phrase: "Большой ход начинается с малого заряда." },
      3: { title: "Возврат энергии", body: "Первый раз за бой после использования способности возвращает 50% её стоимости резонансом.", phrase: "Хороший импульс не пропадает." },
      4: { title: "Экономный разряд", body: "Активная способность стоит на 25% дешевле, минимальная стоимость сохраняется.", phrase: "Сила важна, но темп важнее." },
      5: { title: "Командный запуск", body: "В начале боя команда получает 1 резонанс, если Батарейка находится в отряде.", phrase: "Команда включается с первой искры." },
    },
  },
  SNIPER: {
    label: "Снайпер",
    accent: "from-blue-300 to-indigo-500",
    effects: {
      2: { title: "Дальний фокус", body: "Дальний урон +7%.", phrase: "Расстояние делает удар чище." },
      3: { title: "Тихая позиция", body: "Если персонаж не двигался перед атакой, наносит на 14% больше урона.", phrase: "Иногда лучший шаг — не шагать." },
      4: { title: "Расширенный прицел", body: "Активная способность получает +20% к радиусу действия.", phrase: "Граница атаки уходит дальше." },
      5: { title: "Метка цели", body: "Первый дальний удар в бою помечает цель. Следующая атака по помеченной цели наносит на 20% больше урона.", phrase: "Отмеченная цель уже чувствует следующий удар." },
    },
  },
  PROVOKER: {
    label: "Провокатор",
    accent: "from-amber-300 to-red-500",
    effects: {
      2: { title: "Крепкая выдержка", body: "Максимальное здоровье +7%.", phrase: "Чтобы отвлечь удар, нужно выдержать взгляд." },
      3: { title: "Сбитый фокус", body: "Первый враг, ударивший Провокатора, получает штраф -15% к следующей атаке.", phrase: "Злость редко помогает целиться." },
      4: { title: "Метка раздражения", body: "Активная способность помечает врага. Следующий удар помеченного врага по другой цели наносит на 20% меньше урона.", phrase: "Пусть смотрит туда, где ему неудобно." },
      5: { title: "Ответ команды", body: "Первый раз за бой после получения урона Провокатор даёт команде 1 дополнительное действие.", phrase: "Иногда удар по тебе двигает всю команду." },
    },
  },
  SCOUT: {
    label: "Разведчик",
    accent: "from-teal-200 to-sky-500",
    effects: {
      2: { title: "Лёгкий след", body: "Уклонение +8%.", phrase: "Быстрый силуэт трудно поймать." },
      3: { title: "Первый маршрут", body: "В первый ход получает +25% к дальности перемещения.", phrase: "Кто видит путь первым, диктует карту." },
      4: { title: "Безопасный вход", body: "После входа на точку резонанса получает защитный бонус -15% входящего урона до конца следующего хода.", phrase: "Разведка возвращается, когда умеет прикрыться." },
      5: { title: "Тактическое окно", body: "Один раз за бой открывает тактическое окно. Следующее перемещение команды не тратит лимит действий.", phrase: "Верный маршрут двигает не одного, а всех." },
    },
  },
};

function roman(rank: number) {
  return ["I", "II", "III", "IV", "V"][Math.max(0, Math.min(MAX_FUSION_RANK - 1, rank - 1))];
}

function cardImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.12]";
  if (slug === "metro-breeze") return "scale-[1.18]";
  return "scale-[0.98]";
}

function classFor(card: HuntCard) {
  return card.species.battleClass ?? "DUELIST";
}

const elementBackgrounds: Record<HuntElement, string> = {
  FLAME: "/hunt-assets/awaken/element-bg-flame.webp",
  WATER: "/hunt-assets/awaken/element-bg-water.webp",
  NATURE: "/hunt-assets/awaken/element-bg-nature.webp",
  WIND: "/hunt-assets/awaken/element-bg-wind.webp",
  MUSIC: "/hunt-assets/awaken/element-bg-music.webp",
  LIGHT: "/hunt-assets/awaken/element-bg-light.webp",
  SHADOW: "/hunt-assets/awaken/element-bg-shadow.webp",
};

export default function HuntAwakenPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const { locale } = useI18n("ru");
  const [payload, setPayload] = useState<{ card: HuntCard; duplicateCount: number; availableDuplicates: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [awakening, setAwakening] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getHuntCard(uuid)
      .then((next) => {
        if (active) setPayload(next);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uuid]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const card = payload?.card ?? null;
  const image = mediaSrc(card?.species.imageUrl) ?? "/hunt-assets/cards/compass-light.webp";
  const elementBackground = card ? elementBackgrounds[card.element as HuntElement] : elementBackgrounds.NATURE;
  const rank = Math.max(1, Math.min(MAX_FUSION_RANK, card?.fusionRank ?? 1));
  const nextRank = Math.min(MAX_FUSION_RANK, rank + 1);
  const isMax = rank >= MAX_FUSION_RANK;
  const requiredDuplicates = isMax ? 0 : DUPLICATES_BY_TARGET_RANK[nextRank];
  const canAwaken = Boolean(payload && !isMax && payload.availableDuplicates >= requiredDuplicates);
  const classMeta = useMemo(() => card ? battleClassMeta[classFor(card)] : battleClassMeta.DUELIST, [card]);
  const nextEffect = classMeta.effects[nextRank] ?? classMeta.effects[MAX_FUSION_RANK];
  const ElementIcon = card ? elementMeta[card.element as HuntElement].icon : Sparkles;

  async function handleAwaken() {
    if (!card || awakening || isMax || !canAwaken) return;
    setAwakening(true);
    const result = await awakenHuntCard(card.uuid);
    setAwakening(false);

    if (!result.ok) {
      setNotice(result.message);
      return;
    }

    setPayload((current) => current
      ? {
          ...current,
          card: result.data.card,
          duplicateCount: result.data.duplicateCount,
          availableDuplicates: result.data.availableDuplicates,
        }
      : current);
    setConfirmOpen(false);
    setNotice(`Резонанс открыт: ранг ${roman(result.data.card.fusionRank)} / ${roman(MAX_FUSION_RANK)}.`);
  }

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center px-5 pb-24 text-white">
        <div className="rounded-3xl border border-cyan-200/20 bg-white/[0.04] px-5 py-4 text-sm text-white/70">Загружаем резонанс...</div>
      </main>
    );
  }

  if (!card || !payload) {
    return (
      <main className="min-h-full px-4 pb-24 pt-5 text-white">
        <Button asChild variant="outline" className={cn("rounded-2xl border-white/10 bg-white/[0.04] text-white", huntInteractiveClass)}>
          <Link href="/hunt/cards"><ArrowLeft className="mr-2 h-4 w-4" /> Коллекция</Link>
        </Button>
        <section className="mt-6 rounded-[28px] border border-red-300/20 bg-red-300/10 p-5 text-red-50">Не удалось загрузить карточку.</section>
      </main>
    );
  }

  return (
    <main className="relative min-h-full overflow-hidden bg-[#020611] pb-36 text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[610px] overflow-hidden">
        <img src={elementBackground} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.72]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,17,0.74),rgba(2,6,17,0.22)_48%,rgba(2,6,17,0.66)),linear-gradient(180deg,rgba(2,6,17,0.16),rgba(2,6,17,0.48)_58%,#020611_94%)]" />
      </div>

      <header className="relative z-10 flex items-start justify-between gap-3 px-4 pt-4">
        <button type="button" onClick={() => router.back()} className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200/22 bg-slate-950/45 text-white/78 backdrop-blur", huntInteractiveClass)} aria-label="Назад">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[27px] font-semibold leading-tight">Резонанс персонажа</h1>
          <p className="mt-1 text-sm leading-5 text-cyan-50/58">Пробуждайте дубликаты, чтобы раскрыть истинный потенциал.</p>
        </div>
        <button type="button" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-200/22 bg-slate-950/45 text-white/78 backdrop-blur", huntInteractiveClass)} aria-label="Информация">
          <Info className="h-5 w-5" />
        </button>
      </header>

      <section className="relative z-10 px-4 pt-3">
        <div className="grid grid-cols-[minmax(0,0.74fr)_minmax(0,1fr)] items-start gap-2">
          <div className="min-w-0">
            <h2 className="break-words text-[34px] font-semibold leading-none">{huntSpeciesName(card.species, locale)}</h2>
            <div className="mt-5 grid gap-3 border-y border-white/10 py-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 shrink-0 text-cyan-200" />
                <div>
                  <p className="text-xs text-white/45">Ранг резонанса</p>
                  <p className="text-lg font-semibold">{roman(rank)} / {roman(MAX_FUSION_RANK)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RefreshCw className="h-6 w-6 shrink-0 text-cyan-200" />
                <div>
                  <p className="text-xs text-white/45">Дубликатов</p>
                  <p className="text-2xl font-semibold text-cyan-100">{payload.availableDuplicates}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative -mt-10 min-h-[245px] self-start">
            <div className="absolute inset-x-0 bottom-0 h-[72%] rounded-full bg-cyan-300/12 blur-3xl" />
            <img src={image} alt="" className={cn("relative mx-auto h-[270px] w-full object-contain object-bottom drop-shadow-[0_22px_34px_rgba(0,0,0,0.55)]", cardImageScale(card.species.slug), huntCreatureImageClass(card.species.slug))} />
          </div>
        </div>

        <blockquote className="relative -mt-8 mr-auto max-w-[260px] text-left text-sm italic leading-6 text-cyan-50/72">
          <p>«{card.species.awakeningPhrase ?? nextEffect.phrase}»</p>
          <footer className="mt-2 text-xs not-italic text-white/40">— {huntSpeciesName(card.species, locale)}</footer>
        </blockquote>
      </section>

      <section className="relative z-10 mt-3 px-4">
        <div className="rounded-[22px] border border-amber-200/40 bg-slate-950/76 px-4 py-2.5 text-center shadow-[0_0_36px_rgba(251,191,36,0.16)]">
          <p className="text-base font-semibold">✦ Ранг резонанса {roman(rank)} / {roman(MAX_FUSION_RANK)} ✦</p>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-1">
          {Array.from({ length: MAX_FUSION_RANK }, (_, index) => {
            const nodeRank = index + 1;
            const unlocked = nodeRank <= rank;
            const current = nodeRank === nextRank && !isMax;
            return (
              <div key={nodeRank} className="relative text-center">
                {index > 0 && <span className={cn("absolute -left-1/2 top-6 h-px w-full", unlocked ? "bg-cyan-200" : "bg-slate-600")} />}
                <span className={cn(
                  "relative mx-auto flex h-10 w-10 items-center justify-center rounded-full border text-base font-semibold",
                  unlocked && "border-cyan-200 bg-cyan-300/20 text-cyan-50 shadow-[0_0_28px_rgba(103,232,249,0.36)]",
                  current && "border-fuchsia-200 bg-fuchsia-400/18 text-fuchsia-50 shadow-[0_0_34px_rgba(217,70,239,0.42)]",
                  !unlocked && !current && "border-slate-500/55 bg-slate-900/80 text-slate-400",
                )}>
                  {unlocked ? <Sparkles className="h-5 w-5" /> : current ? <Star className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                </span>
                <p className="mt-1.5 text-sm font-semibold">{roman(nodeRank)}</p>
                <p className={cn("mt-1 text-[11px] leading-4", unlocked ? "text-cyan-100" : current ? "text-fuchsia-100" : "text-white/38")}>
                  {unlocked ? "Открыто" : current ? "Следующее" : "Закрыто"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mt-7 px-4">
        <div className="overflow-hidden rounded-[24px] border border-cyan-200/22 bg-slate-950/72 shadow-[0_20px_70px_rgba(0,0,0,0.42)]">
          <div className="flex items-center justify-between gap-3 border-b border-cyan-200/12 px-4 py-3">
            <h3 className="text-xl font-semibold">{isMax ? "Резонанс раскрыт" : "Следующий эффект"}</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-sm text-cyan-50/80">Ранг {roman(nextRank)} / {roman(MAX_FUSION_RANK)}</span>
          </div>
          <div className="grid grid-cols-[86px_1fr] gap-4 p-4">
            <div className={cn("flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br shadow-[0_0_35px_rgba(217,70,239,0.25)]", classMeta.accent)}>
              <Sparkles className="h-9 w-9 text-white" />
            </div>
            <div>
              <p className="text-lg font-semibold">{nextEffect.title}</p>
              <p className="mt-1 text-sm leading-6 text-cyan-50/68">{nextEffect.body}</p>
              <p className="mt-3 text-sm italic text-white/46">«{nextEffect.phrase}»</p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mt-5 px-4">
        <div className="rounded-[24px] border border-cyan-200/18 bg-slate-950/62 p-4">
          <div className="grid grid-cols-[88px_1fr] items-center gap-4">
            <div className="relative h-24 overflow-hidden rounded-2xl border border-white/12 bg-black/30">
              <img src={image} alt="" className={cn("h-full w-full object-contain object-center", cardImageScale(card.species.slug), huntCreatureImageClass(card.species.slug))} />
              <span className="absolute bottom-2 right-2 rounded-xl bg-black/60 px-2 py-1 text-sm font-semibold">x{requiredDuplicates}</span>
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm text-cyan-50/70">
                <RefreshCw className="h-4 w-4 text-cyan-200" />
                {isMax ? "Максимальный ранг открыт" : `Потратить ${requiredDuplicates} ${requiredDuplicates === 1 ? "дубликат" : "дубликата"}`}
              </p>
              <Button
                disabled={isMax || !canAwaken || awakening}
                onClick={() => setConfirmOpen(true)}
                className={cn("mt-3 h-14 w-full rounded-2xl bg-cyan-200 text-lg font-semibold text-slate-950 hover:bg-cyan-100", huntInteractiveClass)}
              >
                <Sparkles className="mr-2 h-5 w-5" />
                {awakening ? "Пробуждаем..." : isMax ? "Пробуждено" : `Пробудить ${roman(nextRank)}`}
              </Button>
              {!canAwaken && !isMax && <p className="mt-2 text-xs text-white/42">Не хватает дубликатов: нужно {requiredDuplicates}, доступно {payload.availableDuplicates}.</p>}
            </div>
          </div>
        </div>
      </section>

      {notice && (
        <div className="fixed bottom-24 left-1/2 z-50 w-[min(430px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-cyan-200/20 bg-slate-950/95 px-4 py-3 text-sm text-cyan-50 shadow-2xl backdrop-blur">
          {notice}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showClose={false} className="w-[calc(100vw-1.5rem)] max-w-[390px] overflow-hidden rounded-[28px] border-cyan-300/45 bg-[#031026] p-0 text-white shadow-[0_0_80px_rgba(14,165,233,0.34)]">
          <div className="relative px-5 pb-5 pt-12">
            <button type="button" onClick={() => setConfirmOpen(false)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" aria-label="Закрыть">
              <X className="h-5 w-5" />
            </button>
            <div className="absolute left-1/2 top-0 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-fuchsia-200/45 bg-fuchsia-500/20 shadow-[0_0_42px_rgba(217,70,239,0.48)]">
              <Sparkles className="h-10 w-10 text-fuchsia-100" />
            </div>
            <DialogTitle className="text-center text-3xl font-semibold">Пробудить {roman(nextRank)}</DialogTitle>
            <p className="mt-2 text-center text-sm text-cyan-50/62">Использовать дубликат и пробудить резонанс?</p>
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-200/45 bg-cyan-300/16">
                  <Sparkles className="h-7 w-7 text-cyan-100" />
                </div>
                <p className="mt-2 font-semibold">Ранг {roman(rank)}</p>
              </div>
              <Zap className="h-7 w-7 text-cyan-200" />
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-fuchsia-200/45 bg-fuchsia-400/16">
                  <Sparkles className="h-7 w-7 text-fuchsia-100" />
                </div>
                <p className="mt-2 font-semibold">Ранг {roman(nextRank)}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-cyan-200/18 bg-slate-950/48 p-3">
              <div className="flex items-center gap-3">
                <img src={image} alt="" className="h-16 w-16 rounded-2xl border border-white/10 bg-black/30 object-contain" />
                <div>
                  <p className="font-semibold">Потратить {requiredDuplicates} дубликат</p>
                  <p className="text-sm text-cyan-50/58">{huntSpeciesName(card.species, locale)}</p>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-3 border-t border-white/10 pt-3">
                <ElementIcon className="mt-1 h-5 w-5 text-cyan-200" />
                <div>
                  <p className="font-semibold">{nextEffect.title}</p>
                  <p className="text-sm leading-5 text-cyan-50/62">{nextEffect.body}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" className={cn("h-12 rounded-2xl border-white/10 bg-white/[0.06] text-white", huntInteractiveClass)} onClick={() => setConfirmOpen(false)}>Отмена</Button>
              <Button disabled={awakening} className={cn("h-12 rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100", huntInteractiveClass)} onClick={handleAwaken}>
                <Check className="mr-2 h-4 w-4" />
                {awakening ? "Пробуждаем..." : "Пробудить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
