"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Skull, Sparkles, Heart, Shield, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { stats, type Fighter } from "@/lib/hunt/tactics";
import { effectTiming } from "@/lib/hunt/presentation";
import styles from "./arena.module.css";

export function FighterDetails({
  unit,
  onClose,
}: {
  unit: Fighter;
  onClose: () => void;
}) {
  const { t, locale } = useI18n("ru");
  const reduced = useReducedMotion();
  const tr = (key: string) => t(`arena.${key}` as TranslationKey);
  return (
    <motion.section
      className={styles.fighterDetails}
      aria-label={tr("characterState")}
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : 8 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <header>
        <Image src={stats(unit).image} alt="" width={36} height={36} />
        <div>
          <strong>
            {(locale === "ru" ? unit.profile?.nameRu : unit.profile?.nameEn) ||
              tr(stats(unit).key)}
          </strong>
          <small>{tr(unit.side === "player" ? "you" : "bot")}</small>
        </div>
        <button aria-label={tr("closeState")} onClick={onClose}>
          <X size={19} />
        </button>
      </header>
      <div className={styles.stateNumbers}>
        <span>
          <Heart size={14} /> {unit.hp}/{stats(unit).hp}
        </span>
        <span>
          <Shield size={14} /> {unit.shield}
        </span>
        {unit.hp <= 0 && <span>{tr("targetDown")}</span>}
      </div>
      <div className={styles.stateEffects}>
        {unit.shield > 0 && (
          <p>
            <Shield size={14} />
            <b>
              {tr("shield")} {unit.shield}
            </b>
            <small>
              {Math.max(
                1,
                (unit.shieldExpires ?? unit.activeTurn) - unit.activeTurn + 1,
              )}{" "}
              {tr("turnsLeft")}
            </small>
          </p>
        )}
        {unit.effects.map((effect, i) => {
          const timing = effectTiming(unit, effect);
          const Icon =
            effect.type === "burn"
              ? Flame
              : effect.type === "poison"
                ? Skull
                : Sparkles;
          return (
            <p key={`${effect.type}-${effect.stat ?? i}`}>
              <Icon size={14} />
              <b>
                {tr(effect.type === "buff" ? effect.stat! : effect.type)}{" "}
                {effect.type === "buff" ? "+" : "−"}
                {effect.amount}
              </b>
              <small>
                {timing.pending
                  ? `${tr("startsIn")} ${effect.starts - unit.activeTurn} ${tr("turnsShort")} · `
                  : ""}
                {timing.remaining} {tr("turnsLeft")}
              </small>
            </p>
          );
        })}
        {!unit.effects.length && !unit.shield && (
          <small>{tr("noEffects")}</small>
        )}
      </div>
    </motion.section>
  );
}
