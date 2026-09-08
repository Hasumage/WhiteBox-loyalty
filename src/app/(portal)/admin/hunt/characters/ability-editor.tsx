"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Play,
  Loader2,
} from "lucide-react";
import {
  adminReadHuntAbilities,
  adminSaveHuntAbilities,
  type AdminHuntAbility,
} from "@/lib/api/admin-client";
import {
  ABILITY_ICONS,
  EFFECT_TYPES,
  parseAbilityEdit,
  type AbilityConfig,
} from "@/lib/hunt/ability-config";
import { abilityIcons } from "@/lib/hunt/ability-icons";
import type { AbilityEffect } from "@/lib/hunt/tactics";
import styles from "./ability-editor.module.css";

const effectNames: Record<AbilityEffect["type"], string> = {
  damage: "Прямой урон",
  lifesteal: "Похищение жизни",
  heal: "Лечение",
  shield: "Щит",
  burn: "Горение",
  poison: "Отравление",
  buff: "Усиление",
  push: "Отбрасывание",
  pull: "Притягивание",
};
const statNames = {
  hp: "Макс. здоровье",
  attack: "Атака",
  speed: "Скорость",
  luck: "Удача",
};
const iconNames: Record<string, string> = {
  sparkles: "Искры",
  flame: "Пламя",
  shield: "Щит",
  droplets: "Капли",
  waves: "Волны",
  leaf: "Лист",
  skull: "Яд",
  sprout: "Росток",
  swords: "Мечи",
  wind: "Ветер",
  sun: "Солнце",
  moon: "Луна",
  music: "Музыка",
  heart: "Сердце",
};
function newEffect(type: AbilityEffect["type"]): AbilityEffect {
  const power = { stat: "attack" as const, factor: 0.8, flat: 0 };
  if (type === "lifesteal") return { type, power, ratio: 0.5, canCrit: true };
  if (type === "burn" || type === "poison")
    return {
      type,
      power: { ...power, factor: 0.25 },
      duration: 2,
      delay: 1,
      stacking: "refresh",
      healingReduction: type === "poison" ? 0.3 : 0,
    };
  if (type === "buff")
    return {
      type,
      power: { ...power, factor: 0.25 },
      stat: "attack",
      duration: 2,
      delay: 1,
      stacking: "refresh",
    };
  if (type === "shield" || type === "heal")
    return {
      type,
      power: { stat: "hp", factor: 0.3, flat: 0 },
      ...(type === "shield" ? { duration: 0 } : {}),
    };
  if (type === "push" || type === "pull")
    return {
      type,
      power: { stat: "speed", factor: 0.5, flat: 0 },
      maxDistance: 2,
    };
  return { type, power, canCrit: true };
}
function NumberField({
  label,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            onChange(
              Math.max(min, Math.min(max, step === 1 ? Math.round(n) : n)),
            );
        }}
      />
    </label>
  );
}
export function AbilityEditor({
  speciesId,
  onDirty,
}: {
  speciesId: string;
  onDirty: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<AdminHuntAbility[]>([]);
  const [original, setOriginal] = useState<AdminHuntAbility[]>([]);
  const [slot, setSlot] = useState(0);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const dirty = JSON.stringify(rows) !== JSON.stringify(original);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    let active = true;
    adminReadHuntAbilities(speciesId)
      .then((data) => {
        if (active) {
          setRows(data);
          setOriginal(data);
          setFailed(false);
          setMessage("");
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error.message);
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [speciesId, reload]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const current = rows[slot];
  function patch(update: Partial<AdminHuntAbility>) {
    setRows((prev) =>
      prev.map((a, i) => (i === slot ? { ...a, ...update } : a)),
    );
  }
  function config(update: Partial<AbilityConfig>) {
    patch({ config: { ...current.config, ...update } });
  }
  function effect(index: number, update: Partial<AbilityEffect>) {
    config({
      effects: current.config.effects.map((e, i) =>
        i === index ? ({ ...e, ...update } as AbilityEffect) : e,
      ),
    });
  }
  async function save() {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const next = await adminSaveHuntAbilities(
        speciesId,
        rows.map(parseAbilityEdit),
      );
      setRows(next);
      setOriginal(next);
      setMessage("Способности сохранены");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения");
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  function reorder(delta: number) {
    const next = rows.slice(),
      target = slot + delta;
    [next[slot], next[target]] = [next[target], next[slot]];
    setRows(next.map((a, i) => ({ ...a, slot: i })));
    setSlot(target);
  }
  if (!current)
    return (
      <div className={styles.editor}>
        {busy ? (
          <Loader2 className="animate-spin" />
        ) : (
          <div role="alert">
            {message ||
              "Способности не назначены. Примените начальные данные способностей."}
            <button
              onClick={() => {
                setBusy(true);
                setReload((n) => n + 1);
              }}
            >
              <RotateCcw size={16} /> Повторить
            </button>
          </div>
        )}
      </div>
    );
  return (
    <div className={styles.editor}>
      <div className={styles.toolbar}>
        <button
          onClick={() => {
            setRows(original);
            setMessage("");
          }}
          disabled={busy || !dirty}
          aria-label="Сбросить изменения"
          title="Сбросить изменения"
        >
          <RotateCcw size={18} />
        </button>
        <a
          href={`/hunt/battle/arena?species=${encodeURIComponent(speciesId)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Проверить персонажа в бою"
          title="Проверить сохранённые способности в бою"
        >
          <Play size={18} />
        </a>
        <span>{dirty ? "Есть изменения" : "Сохранено"}</span>
        <button
          className={styles.save}
          onClick={() => void save()}
          disabled={busy || !dirty}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}{" "}
          Сохранить
        </button>
      </div>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? styles.error : styles.success}
        >
          {message}
        </p>
      )}
      {failed && (
        <button
          disabled={busy}
          onClick={() => {
            if (
              dirty &&
              !window.confirm(
                "Загрузить настройки с сервера и отменить несохранённые изменения?",
              )
            )
              return;
            setBusy(true);
            setReload((n) => n + 1);
          }}
        >
          <RotateCcw size={16} /> Обновить данные
        </button>
      )}
      <div
        className={styles.slots}
        role="tablist"
        aria-label="Способности персонажа"
      >
        {rows.map((a, i) => {
          const Icon =
            abilityIcons[a.icon as keyof typeof abilityIcons] ??
            abilityIcons.sparkles;
          return (
            <button
              key={a.id}
              role="tab"
              aria-selected={i === slot}
              onClick={() => setSlot(i)}
            >
              <Icon size={18} />
              <span>
                <small>Слот {i + 1}</small>
                {a.nameRu}
              </span>
            </button>
          );
        })}
      </div>
      <fieldset disabled={busy} className={styles.fields}>
        <div className={styles.rowTitle}>
          <strong>{current.nameRu}</strong>
          <span>v{current.revision}</span>
          <button
            onClick={() => reorder(-1)}
            disabled={slot === 0}
            aria-label="Сдвинуть способность влево"
            title="Сдвинуть влево"
          >
            <ArrowLeft size={16} />
          </button>
          <button
            onClick={() => reorder(1)}
            disabled={slot === 2}
            aria-label="Сдвинуть способность вправо"
            title="Сдвинуть вправо"
          >
            <ArrowRight size={16} />
          </button>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={current.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />{" "}
            Включена
          </label>
        </div>
        <div className={styles.grid}>
          <label>
            Название RU
            <input
              value={current.nameRu}
              maxLength={80}
              onChange={(e) => patch({ nameRu: e.target.value })}
            />
          </label>
          <label>
            Название EN
            <input
              value={current.nameEn}
              maxLength={80}
              onChange={(e) => patch({ nameEn: e.target.value })}
            />
          </label>
          <label>
            Иконка
            <select
              value={current.icon}
              onChange={(e) => patch({ icon: e.target.value })}
            >
              {ABILITY_ICONS.map((key) => (
                <option key={key} value={key}>
                  {iconNames[key] ?? key}
                </option>
              ))}
            </select>
          </label>
          <label>
            Описание RU
            <textarea
              value={current.descriptionRu}
              maxLength={1000}
              onChange={(e) => patch({ descriptionRu: e.target.value })}
            />
          </label>
          <label>
            Описание EN
            <textarea
              value={current.descriptionEn}
              maxLength={1000}
              onChange={(e) => patch({ descriptionEn: e.target.value })}
            />
          </label>
          <label>
            Версия для восстановления
            <select
              value=""
              onChange={(e) => {
                const old = current.history.find(
                  (h) => h.revision === Number(e.target.value),
                );
                if (old) {
                  patch({
                    ...old.snapshot,
                    id: current.id,
                    slug: current.slug,
                    slot: current.slot,
                    revision: current.revision,
                    history: current.history,
                  });
                }
              }}
            >
              <option value="">История изменений</option>
              {current.history.map((h) => (
                <option value={h.revision} key={h.revision}>
                  v{h.revision} ·{" "}
                  {new Date(h.createdAt).toLocaleDateString("ru-RU")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section>
          <h3>Применение</h3>
          <div className={styles.grid}>
            <NumberField
              label="Стоимость резонанса"
              value={current.config.cost}
              max={20}
              onChange={(cost) => config({ cost })}
            />
            <NumberField
              label="Перезарядка, ходов"
              value={current.config.cooldown}
              max={10}
              onChange={(cooldown) => config({ cooldown })}
            />
            <label>
              Цель
              <select
                value={current.config.target}
                onChange={(e) =>
                  config({ target: e.target.value as AbilityConfig["target"] })
                }
              >
                <option value="enemy">Противник</option>
                <option value="ally">Союзник</option>
                <option value="self">На себя</option>
              </select>
            </label>
            <label>
              Область
              <select
                value={current.config.radius ? "area" : "single"}
                onChange={(e) =>
                  config({ radius: e.target.value === "area" ? 1 : 0 })
                }
              >
                <option value="single">Одна цель</option>
                <option value="area">По площади</option>
              </select>
            </label>
            {current.config.radius > 0 && (
              <NumberField
                label="Радиус, клеток"
                value={current.config.radius}
                min={1}
                max={4}
                onChange={(radius) => config({ radius })}
              />
            )}
            <NumberField
              label="Максимум целей"
              value={current.config.maxTargets ?? 6}
              min={1}
              max={6}
              onChange={(maxTargets) => config({ maxTargets })}
            />
            <label>
              Дальность
              <select
                value={current.config.range === undefined ? "stat" : "fixed"}
                onChange={(e) =>
                  config({ range: e.target.value === "stat" ? undefined : 3 })
                }
              >
                <option value="stat">От характеристики</option>
                <option value="fixed">Фиксированная</option>
              </select>
            </label>
            {current.config.range === undefined ? (
              <NumberField
                label="Прибавка к дальности"
                value={current.config.rangeBonus}
                min={-8}
                max={8}
                onChange={(rangeBonus) => config({ rangeBonus })}
              />
            ) : (
              <NumberField
                label="Дальность, клеток"
                value={current.config.range}
                max={16}
                onChange={(range) => config({ range })}
              />
            )}
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={current.config.lineOfSight !== false}
                onChange={(e) => config({ lineOfSight: e.target.checked })}
              />{" "}
              Нужна прямая видимость
            </label>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={!!current.config.delayed}
                onChange={(e) => config({ delayed: e.target.checked })}
              />{" "}
              После обычных действий
            </label>
          </div>
        </section>
        <section>
          <div className={styles.rowTitle}>
            <h3>Эффекты</h3>
            <button
              onClick={() =>
                config({
                  effects: [...current.config.effects, newEffect("damage")],
                })
              }
              disabled={current.config.effects.length >= 8}
            >
              <Plus size={16} /> Добавить эффект
            </button>
          </div>
          {current.config.effects.map((e, index) => (
            <div className={styles.effect} key={index}>
              <div className={styles.rowTitle}>
                <span>{index + 1}</span>
                <select
                  aria-label={`Тип эффекта ${index + 1}`}
                  value={e.type}
                  onChange={(event) =>
                    config({
                      effects: current.config.effects.map((old, i) =>
                        i === index
                          ? newEffect(
                              event.target.value as AbilityEffect["type"],
                            )
                          : old,
                      ),
                    })
                  }
                >
                  {EFFECT_TYPES.map((type) => (
                    <option value={type} key={type}>
                      {effectNames[type]}
                    </option>
                  ))}
                </select>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={e.enabled !== false}
                    onChange={(event) =>
                      effect(index, { enabled: event.target.checked })
                    }
                  />{" "}
                  Включён
                </label>
                {[-1, 1].map((delta) => (
                  <button
                    key={delta}
                    aria-label={`${delta < 0 ? "Поднять" : "Опустить"} эффект ${index + 1}`}
                    title={delta < 0 ? "Поднять эффект" : "Опустить эффект"}
                    disabled={
                      index + delta < 0 ||
                      index + delta >= current.config.effects.length
                    }
                    onClick={() => {
                      const effects = current.config.effects.slice();
                      [effects[index], effects[index + delta]] = [
                        effects[index + delta],
                        effects[index],
                      ];
                      config({ effects });
                    }}
                  >
                    {delta < 0 ? (
                      <ArrowUp size={16} />
                    ) : (
                      <ArrowDown size={16} />
                    )}
                  </button>
                ))}
                <button
                  aria-label={`Удалить эффект ${index + 1}`}
                  title="Удалить эффект"
                  disabled={current.config.effects.length === 1}
                  onClick={() =>
                    config({
                      effects: current.config.effects.filter(
                        (_, i) => i !== index,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className={styles.grid}>
                <label>
                  Расчёт силы
                  <select
                    value={e.power.stat}
                    onChange={(event) =>
                      effect(index, {
                        power: {
                          ...e.power,
                          stat: event.target
                            .value as AbilityEffect["power"]["stat"],
                        },
                      })
                    }
                  >
                    {Object.entries(statNames).map(([stat, label]) => (
                      <option key={stat} value={stat}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Доля характеристики, %"
                  value={Math.round(e.power.factor * 100)}
                  max={1000}
                  onChange={(percent) =>
                    effect(index, {
                      power: { ...e.power, factor: percent / 100 },
                    })
                  }
                />
                <NumberField
                  label="Плоская прибавка"
                  value={e.power.flat ?? 0}
                  max={100}
                  onChange={(flat) =>
                    effect(index, { power: { ...e.power, flat } })
                  }
                />
                {(e.type === "damage" || e.type === "lifesteal") && (
                  <>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={e.canCrit !== false}
                        onChange={(event) =>
                          effect(index, { canCrit: event.target.checked })
                        }
                      />{" "}
                      Может критовать
                    </label>
                    <label className={styles.toggle}>
                      <input
                        type="checkbox"
                        checked={!!e.ignoreCover}
                        onChange={(event) =>
                          effect(index, { ignoreCover: event.target.checked })
                        }
                      />{" "}
                      Игнорирует укрытия
                    </label>
                  </>
                )}
                {e.type === "lifesteal" && (
                  <NumberField
                    label="Похищение здоровья, % урона"
                    value={Math.round(e.ratio * 100)}
                    min={1}
                    max={100}
                    onChange={(ratio) => effect(index, { ratio: ratio / 100 })}
                  />
                )}
                {e.type === "shield" && (
                  <NumberField
                    label="Дополнительных ходов щита"
                    value={e.duration ?? 0}
                    max={10}
                    onChange={(duration) => effect(index, { duration })}
                  />
                )}
                {(e.type === "burn" ||
                  e.type === "poison" ||
                  e.type === "buff") && (
                  <>
                    <NumberField
                      label="Длительность, ходов"
                      value={e.duration}
                      min={1}
                      max={10}
                      onChange={(duration) => effect(index, { duration })}
                    />
                    <NumberField
                      label="Начало через, ходов"
                      value={e.delay ?? 1}
                      min={1}
                      max={3}
                      onChange={(delay) => effect(index, { delay })}
                    />
                    <label>
                      Повторное наложение
                      <select
                        value={e.stacking ?? "refresh"}
                        onChange={(event) =>
                          effect(index, {
                            stacking: event.target.value as
                              "refresh" | "replace",
                          })
                        }
                      >
                        <option value="refresh">
                          Продлить и сохранить сильнейший
                        </option>
                        <option value="replace">Заменить новым</option>
                      </select>
                    </label>
                  </>
                )}
                {e.type === "poison" && (
                  <NumberField
                    label="Ослабление лечения, %"
                    value={Math.round((e.healingReduction ?? 0.3) * 100)}
                    max={100}
                    onChange={(percent) =>
                      effect(index, { healingReduction: percent / 100 })
                    }
                  />
                )}
                {e.type === "buff" && (
                  <label>
                    Усиливаемый показатель
                    <select
                      value={e.stat}
                      onChange={(event) =>
                        effect(index, {
                          stat: event.target.value as
                            "attack" | "speed" | "luck",
                        })
                      }
                    >
                      {["attack", "speed", "luck"].map((stat) => (
                        <option key={stat} value={stat}>
                          {statNames[stat as keyof typeof statNames]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(e.type === "push" || e.type === "pull") && (
                  <NumberField
                    label="Предел смещения, клеток"
                    value={e.maxDistance ?? 2}
                    min={1}
                    max={4}
                    onChange={(maxDistance) => effect(index, { maxDistance })}
                  />
                )}
              </div>
            </div>
          ))}
        </section>
      </fieldset>
    </div>
  );
}
