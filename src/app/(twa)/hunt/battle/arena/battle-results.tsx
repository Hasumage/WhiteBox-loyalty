"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { stats, type Battle } from "@/lib/hunt/tactics";
import styles from "./arena.module.css";

export function BattleResults({ battle }: { battle: Battle }) {
  const { t, locale } = useI18n("ru");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return (
    <div className={styles.battleResults}>
      {(["player", "bot"] as const).map((side) => (
        <table key={side}>
          <caption>{t(side === "player" ? "arena.you" : "arena.bot")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("arena.character")}</th>
              {["damageTotal", "healingTotal", "shield", "controlTotal"].map(
                (key) => (
                  <th key={key} scope="col">
                    {t(`arena.${key}` as TranslationKey)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {battle.units
              .filter((u) => u.side === side)
              .map((u) => {
                const total = battle.statistics[u.id];
                return (
                  <tr key={u.id}>
                    <th scope="row">
                      <Image
                        src={stats(u).image}
                        width={24}
                        height={24}
                        alt=""
                      />
                      <span>
                        {(locale === "ru"
                          ? u.profile?.nameRu
                          : u.profile?.nameEn) ||
                          t(`arena.${stats(u).key}` as TranslationKey)}
                      </span>
                    </th>
                    {[
                      total.damage,
                      total.healing,
                      total.absorbed,
                      total.control,
                    ].map((value, i) => (
                      <td key={i}>{number.format(value)}</td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      ))}
    </div>
  );
}
