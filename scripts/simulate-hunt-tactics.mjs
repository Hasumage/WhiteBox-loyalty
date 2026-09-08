import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  createBattle,
  planAI,
  resolveRound,
  validateOrders,
} from "../src/lib/hunt/tactics.ts";

const strategies = ["balanced", "center", "split", "focus", "defense"];
const names = {
  balanced: "Адаптивная",
  center: "Центр",
  split: "Разделение",
  focus: "Фокус цели",
  defense: "Оборона",
};
const seeds = Number(process.env.SIM_SEEDS || 20);
const skills = !process.argv.includes("--no-skills");
const tag = process.argv.includes("--baseline") ? "baseline" : "abilities";
const totals = Object.fromEntries(
  strategies.map((s) => [
    s,
    {
      wins: 0,
      draws: 0,
      losses: 0,
      score: 0,
      actions: { move: 0, attack: 0, wait: 0, skill: 0 },
    },
  ]),
);
const pairs = [];
let rounds = 0,
  matches = 0,
  mirrorErrors = 0;
for (let a = 0; a < strategies.length; a++)
  for (let c = a + 1; c < strategies.length; c++) {
    const first = strategies[a],
      second = strategies[c];
    const pair = { first, second, wins: 0, draws: 0, losses: 0 };
    for (let seed = 1; seed <= seeds; seed++) {
      const outcomes = [];
      for (const flipped of [false, true]) {
        let b = createBattle();
        const player = flipped ? second : first,
          bot = flipped ? first : second;
        while (!b.winner) {
          const p = planAI(b, "player", {
            strategy: player,
            seed: seed * 1009 + b.round * 37 + (flipped ? 1 : 0),
            skills,
          });
          const ai = planAI(b, "bot", {
            strategy: bot,
            seed: seed * 1009 + b.round * 37 + (flipped ? 0 : 1),
            skills,
          });
          if (
            !validateOrders(b, "player", p.orders, p.bonus) ||
            !validateOrders(b, "bot", ai.orders, ai.bonus)
          )
            throw new Error("Illegal AI plan");
          for (const [strategy, plan] of [
            [player, p],
            [bot, ai],
          ])
            for (const order of plan.orders)
              totals[strategy].actions[order.type]++;
          b = resolveRound(
            b,
            p.orders,
            ai.orders,
            p.bonus,
            ai.bonus,
            (actor, target, turn) =>
              createHash("sha256")
                .update(
                  `${seed}:${turn}:${actor.side === "player" ? player : bot}:${actor.kind}:${target.kind}`,
                )
                .digest()
                .readUInt32BE(0) / 4294967296,
          ).at(-1).battle;
          rounds++;
        }
        const win =
          b.winner === "draw" ? "draw" : b.winner === "player" ? player : bot;
        outcomes.push(win);
        pair[win === "draw" ? "draws" : win === first ? "wins" : "losses"]++;
        for (const [strategy, side] of [
          [player, "player"],
          [bot, "bot"],
        ]) {
          totals[strategy][
            win === "draw" ? "draws" : win === strategy ? "wins" : "losses"
          ]++;
          totals[strategy].score += b.score[side];
        }
        matches++;
      }
      if (outcomes[0] !== outcomes[1]) mirrorErrors++;
    }
    pairs.push(pair);
    console.log(
      `${first} vs ${second}: ${pair.wins}/${pair.draws}/${pair.losses}`,
    );
  }
const result = {
  tag,
  skills,
  seeds,
  matches,
  averageRounds: rounds / matches,
  mirrorErrors,
  totals,
  pairs,
};
const rows = strategies.map((s) => {
  const v = totals[s],
    n = v.wins + v.draws + v.losses;
  return `| ${names[s]} | ${v.wins} | ${v.draws} | ${v.losses} | ${(((v.wins + v.draws / 2) * 100) / n).toFixed(1)}% | ${(v.score / n).toFixed(2)} |`;
});
const report = `# Симуляция тактик: ${tag}\n\n${matches} матчей. ${seeds} воспроизводимых вариантов решений на пару, каждый со сменой сторон. Составы, карта и параметры одинаковые. Способности: ${skills}. Средняя длина: ${(rounds / matches).toFixed(2)} хода. Несовпадений зеркальных исходов: ${mirrorErrors}.\n\n| Стратегия | Победы | Ничьи | Поражения | Результат с половиной очков за ничью | Средний счёт |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${rows.join("\n")}\n\nЭто сравнение заданных эвристик на одной карте, а не оценка winrate людей или доказательство отсутствия доминирующей стратегии. Seed меняет только небольшие предпочтения ИИ, не урон и не правила боя.\n`;
await mkdir("output/hunt-arena", { recursive: true });
await writeFile(
  `output/hunt-arena/balance-${tag}.json`,
  JSON.stringify(result, null, 2),
);
await writeFile(`output/hunt-arena/balance-${tag}.md`, report);
console.log(JSON.stringify(result));
