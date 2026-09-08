import { type Battle, type BattleEvent, type Fighter } from "./tactics";

export function cameraForEvents(
  battle: Battle,
  events: BattleEvent[],
  width: number,
  height: number,
  currentScale: number,
) {
  const cells = events.flatMap((event) => {
    if (!["attack", "move", "displace", "skill", "heal"].includes(event.type))
      return [];
    return [
      ...battle.units.filter(
        (u) =>
          (!event.effect && u.id === event.unitId) || u.id === event.targetId,
      ),
      ...(event.path ?? []),
    ];
  });
  if (!cells.length || width <= 0 || height <= 0) return null;
  const xs = cells.map((p) => 96 + p.x * 66),
    ys = cells.map((p) => 96 + p.y * 66);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const minimum = Math.max(width / 720, height / 720);
  const scale = Math.max(
    minimum,
    Math.min(
      currentScale,
      width / (maxX - minX + 120),
      height / (maxY - minY + 140),
    ),
  );
  return {
    scale,
    x: Math.max(
      width - 720 * scale,
      Math.min(0, width / 2 - ((minX + maxX) / 2) * scale),
    ),
    y: Math.max(
      height - 720 * scale,
      Math.min(0, height / 2 - ((minY + maxY) / 2) * scale),
    ),
  };
}

export function effectTiming(
  unit: Fighter,
  effect: Fighter["effects"][number],
) {
  return {
    pending: effect.starts > unit.activeTurn,
    remaining: Math.max(
      0,
      effect.expires - Math.max(unit.activeTurn, effect.starts) + 1,
    ),
  };
}
