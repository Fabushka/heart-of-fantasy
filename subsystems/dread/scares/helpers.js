// Кирпичики для таблиц Испугов. Всё, что помечено heartScare, снимается, когда Испуги кончаются.
import {
  CONDITION as C, grant, status, makeEffect, addItem, setConditionAtLeast, addPersistent, dealDamage, pick,
} from "../../../core/pf2e.js";
import { TAG } from "../state.js";

export const scareFlags = (extra = {}) => ({ world: { heartScare: true, ...extra } });

// Эффект Испуга. conds: [["slowed", 1], ["blinded"]] — состояния, снять нельзя, пока эффект висит.
export function fx(actor, name, { img = "icons/svg/hazard.svg", duration, conds = [], rules = [], desc = "", flags = {} } = {}) {
  const granted = conds.map(([slug, value]) => grant(C[slug], { value: value ?? null, lock: true }));
  return addItem(actor, makeEffect({
    name: `Испуг: ${name}`,
    img,
    duration,
    rules: [...granted, ...rules],
    desc: `<p>${desc}</p>`,
    flags: scareFlags(flags),
  }));
}

// Обычное состояние PF2e (спадает по своим правилам). Для значения — «не меньше чем».
export const cond = (actor, slug, value = 1) => setConditionAtLeast(actor, slug, value);
export const hurt = (actor, formula, multiplier = 1, flavor = "") => dealDamage(actor, formula, { multiplier, flavor });
export const persistent = (actor, type, formula, dc = 15) => addPersistent(actor, type, formula, dc);
export { status };

export const rollTwiceWorse = (selectors, once) => ({
  key: "RollTwice", selector: selectors, keep: "lower", removeAfterRoll: !!once,
});

// Высвобождение из ловушки: эффект держит состояние, кнопки Атлетики/Акробатики его снимают
export async function trapped(actor, name, { slug = "grabbed", dc, img = "icons/svg/net.svg", desc = "" }) {
  const key = foundry.utils.randomID();
  await fx(actor, name, { img, conds: [[slug]], desc: `${desc} Высвободиться: ${escapeButtons(key, dc)}`, flags: { heartEscape: { key, dc } } });
  return `высвободиться (DC ${dc}): ${escapeButtons(key, dc)}`;
}
export const escapeButtons = (key, dc) =>
  `@Check[athletics|dc:${dc}|name:Высвободиться|options:${TAG.escape},${TAG.escape}:${key},action:escape] ` +
  `@Check[acrobatics|dc:${dc}|name:Высвободиться|options:${TAG.escape},${TAG.escape}:${key},action:escape]`;

// Уронить оружие из рук
export async function dropWeapon(actor) {
  const held = actor.itemTypes.weapon.filter((w) => w.system.equipped?.carryType === "held");
  if (!held.length) return "оружия в руках нет";
  const w = pick(held);
  if (typeof actor.changeCarryType === "function") await actor.changeCarryType(w, { carryType: "dropped", handsHeld: 0 });
  else await w.update({ "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
  return `роняет ${w.name}`;
}

// Пропажа расходника: возвращается, когда Испуги кончаются
export async function stealConsumable(actor) {
  const list = actor.itemTypes.consumable.filter((i) => (i.system.quantity ?? 1) > 0);
  if (!list.length) return "пропадать нечему";
  const item = pick(list);
  const source = item.toObject();
  const taken = { ...source, _id: undefined, system: { ...source.system, quantity: 1 } };
  if ((item.system.quantity ?? 1) > 1) await item.update({ "system.quantity": item.system.quantity - 1 });
  else await item.delete();
  await fx(actor, `Пропажа (${item.name})`, {
    img: "icons/svg/mystery-man.svg",
    desc: `${item.name} исчез. Найдётся, когда наваждение отступит.`,
    flags: { heartStolen: taken },
  });
  return `пропадает ${item.name}`;
}

// Застигнут врасплох в первом раунде следующего боя
export const ambush = (actor) =>
  fx(actor, "Шаги за спиной", {
    img: "icons/svg/cowled.svg",
    desc: "В следующем бою застигнут врасплох на первый раунд.",
    flags: { heartAmbush: true },
  });
