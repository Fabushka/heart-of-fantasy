// Состояние Ужаса: эффект со счётчиком 1–5 на персонаже = персонаж в зоне ужаса.
import { UNLIMITED, uniq } from "../../core/pf2e.js";

export const MAX_DREAD = 5;
export const IMMUNITY_SLUG = "heart-meltdown-immunity";

// Метки бросков: по ним подсистема узнаёт свои проверки в чате
export const TAG = {
  stifle: "heart-dread:stifle",
  panic: "heart-dread:panic",
  scare: "heart-dread:scare",          // + "heart-dread:scare:<id>"
  escape: "heart-dread:escape",        // + "heart-dread:escape:<id>"
  affliction: "heart-dread:affliction", // + "heart-dread:affliction:<key>"
};

export const getDread = (actor) => actor?.itemTypes?.effect.find((e) => e.slug === "dread") ?? null;
export const dreadValue = (actor) => getDread(actor)?.system.badge?.value ?? 0;
export const isPC = (a) => a?.alliance === "party";
export const isEnemy = (a) => a?.alliance === "opposition";

export function partyInZone(scene) {
  return uniq((scene?.tokens ?? []).map((t) => t.actor).filter((a) => a && isPC(a) && getDread(a)));
}

export async function setDread(actor, value) {
  const eff = getDread(actor);
  if (!eff) return;
  await eff.update({ "system.badge.value": Math.clamp(value, 1, MAX_DREAD) });
}

// Свой бросок: натуральные 2..Ужас — на ступень хуже (как натуральная 1). Ужас 1 — ничего.
const SELF_RANGE = [
  { gt: ["check:total:natural", 1] },
  { or: [2, 3, 4, 5].map((n) => ({ and: [`self:effect:dread:${n}`, { lte: ["check:total:natural", n] }] })) },
];

export function dreadRules() {
  return [
    ...["check", "flat-check"].map((selector) => ({
      key: "AdjustDegreeOfSuccess", selector, adjustment: { all: "one-degree-worse" }, predicate: SELF_RANGE,
    })),
    ...["check", "flat-check"].map((selector) => ({
      key: "Note", selector, predicate: SELF_RANGE,
      title: "Ужас {item|system.badge.value}",
      text: "Натуральный результат не выше Ужаса — как натуральная 1: степень успеха на ступень хуже.",
    })),
  ];
}

export function dreadSource(value = 1) {
  return {
    type: "effect",
    name: "Ужас",
    img: "icons/svg/terror.svg",
    system: {
      slug: "dread",
      description: {
        value:
          "<p>Вы в зоне ужаса. Натуральный результат на d20 не выше вашего Ужаса считается натуральной 1: " +
          "степень успеха на ступень хуже. При Ужасе 1 штрафа нет.</p>" +
          "<p>Ужас всей партии растёт от критических провалов персонажей и критических успехов врагов. " +
          "На Ужасе 5 — Срыв. Минута вне зоны снимает Ужас.</p>",
      },
      badge: { type: "counter", value, min: 1, max: MAX_DREAD },
      duration: UNLIMITED,
      tokenIcon: { show: true },
      rules: dreadRules(),
    },
  };
}

// Обновить правила на уже выданных эффектах и убрать мусор прошлых версий
export async function migrateDread() {
  const actors = uniq([...game.actors.contents, ...(canvas.scene?.tokens ?? []).map((t) => t.actor)]);
  const rules = dreadRules();
  for (const a of actors) {
    const eff = getDread(a);
    if (eff && JSON.stringify(eff._source.system.rules) !== JSON.stringify(rules)) {
      await eff.update({ "system.rules": rules });
    }
  }
  // v0.1: служебный «Ужас цели» для врагов больше не нужен
  const old = game.items.filter((i) => i.getFlag("world", "heartDreadVictim"));
  for (const i of old) await i.delete();
}
