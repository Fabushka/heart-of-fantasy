// Таблица Срывов: 1d5 — состояние, 1d3 — вариант внутри состояния.
// text — что видит игрок в чате; apply(actor) накладывает эффекты и может вернуть строку-итог.
import {
  CONDITION as C, EFFECT, rounds, minutes, addItem, grant, makeEffect, setConditionAtLeast,
  addPersistent, dealDamage, fromCompendium, spellRank, tokenOf, feetBetween,
} from "../../core/pf2e.js";
import { isPC } from "./state.js";

const R2 = rounds(2);
const flags = { world: { heartMeltdown: true } };
const eff = (name, img, duration, rules, desc) =>
  makeEffect({ name: `Срыв: ${name}`, img, duration, rules, desc: `<p>${desc}</p>`, flags });

// Ярость Срыва: эффект Ярости PF2e (временные ОЗ, «rage») + урон ближних Ударов
const rageRules = () => [
  grant(EFFECT.rage, { lock: true }),
  { key: "FlatModifier", selector: "strike-damage", predicate: ["item:melee"], type: "status", value: 2, label: "Ярость Срыва" },
];
const RAGE_DESC = "Ярость: временные ОЗ, +2 к урону ближних Ударов, нельзя использовать действия с признаком «концентрация» (кроме самой Ярости).";

export const MELTDOWNS = [
  {
    key: "despair",
    name: "Отчаяние",
    img: "icons/svg/sleep.svg",
    flavor: "Персонаж не в силах совладать с переполняющим его чувством апатии, грусти и безысходности. Он безудержно рыдает.",
    variants: [
      {
        text: "2 раунда не может использовать реакции и <b>замедлен 1</b>.",
        apply: (a) => addItem(a, eff("Отчаяние — слёзы", "icons/svg/sleep.svg", R2,
          [grant(C.slowed, { value: 1, lock: true })],
          "Не может использовать реакции. Замедлен 1.")),
      },
      {
        text: "Получает <b>(уровень)d4 ментального урона</b> и <b>напуган 3</b>.",
        apply: async (a) => {
          const dmg = await dealDamage(a, `${Math.max(1, a.level)}d4[mental]`, { flavor: "Срыв: Отчаяние" });
          await setConditionAtLeast(a, "frightened", 3);
          return `${dmg} ментального урона`;
        },
      },
      {
        text: "<b>Парализован</b> до конца следующего хода и <b>напуган 3</b>.",
        apply: async (a) => {
          await addItem(a, eff("Отчаяние — оцепенение", "icons/svg/paralysis.svg", rounds(1, "turn-end"),
            [grant(C.paralyzed, { lock: true })], "Парализован до конца следующего хода."));
          await setConditionAtLeast(a, "frightened", 3);
        },
      },
    ],
  },
  {
    key: "rage",
    name: "Ярость",
    img: "icons/svg/fire.svg",
    flavor: "Персонаж начинает издавать животные звуки и бросаться на всех вокруг в приступе первобытной злости.",
    variants: [
      {
        text: "<b>В замешательстве</b> 2 раунда. Снять раньше нельзя, затем проходит само.",
        apply: (a) => addItem(a, eff("Ярость — слепая злоба", "icons/svg/fire.svg", R2,
          [grant(C.confused, { lock: true })], "В замешательстве. Снять раньше нельзя.")),
      },
      {
        text: "<b>Ярость</b> и <b>замешательство</b> на 2 раунда. Снять раньше нельзя.",
        apply: (a) => addItem(a, eff("Ярость — зверь", "icons/svg/fire.svg", R2,
          [...rageRules(), grant(C.confused, { lock: true })], `${RAGE_DESC} В замешательстве. Снять раньше нельзя.`)),
      },
      {
        text:
          "Ранит себя, пытаясь сдержать волну ярости: <b>Ярость</b> на 2 раунда, и все эти 2 раунда он атакует <b>только себя</b>. " +
          "Против этих атак он застигнут врасплох и не получает бонусов предметов к КБ.",
        apply: (a) => addItem(a, eff("Ярость — против себя", "icons/svg/blood.svg", R2, rageRules(),
          `${RAGE_DESC}<br><b>Атакует только себя.</b> Против своих атак застигнут врасплох, без бонусов предметов к КБ (ГМ учитывает вручную).`)),
      },
    ],
  },
  {
    key: "paranoia",
    name: "Паранойя",
    img: "icons/svg/eye.svg",
    flavor: "Персонаж больше не способен отличать союзников от врагов, он сомневается в своих и чужих решениях.",
    variants: [
      {
        text:
          "3 раунда видит угрозу в каждом: становится <b>недружелюбным</b> ко всем, к кому не был враждебен, даже к союзникам, " +
          "и никого не считает союзником.",
        apply: (a) => addItem(a, eff("Паранойя — угроза", "icons/svg/eye.svg", rounds(3),
          [{ key: "RollOption", domain: "all", option: "heart-paranoia" }],
          "Недружелюбен ко всем, кому не был враждебен. Никого не считает союзником: не даёт и не получает флангов, Помощи, союзных аур.")),
      },
      {
        text:
          "2 раунда считает <b>смертельным врагом</b> всех, кого видит. Действует так же рационально, как обычно: " +
          "скорее атакует тех, кто атакует его или мешает ему, чем тех, кто оставляет его в покое.",
        apply: (a) => addItem(a, eff("Паранойя — все враги", "icons/svg/eye.svg", R2,
          [{ key: "RollOption", domain: "all", option: "heart-paranoia" }],
          "Все, кого он видит, — смертельные враги. Предпочитает атаковать тех, кто атакует его или мешает ему.")),
      },
      {
        text:
          "<b>Недоверие</b> на 2 раунда: <b>ошеломлён 1</b>, не может Помогать и принимать Помощь, " +
          "союзные ауры и эффекты «на союзников» на него не действуют.",
        apply: (a) => addItem(a, eff("Паранойя — недоверие", "icons/svg/eye.svg", R2,
          [grant(C.stupefied, { value: 1, lock: true }), { key: "RollOption", domain: "all", option: "heart-paranoia" }],
          "Ошеломлён 1. Не может Помогать и принимать Помощь. Союзные ауры и эффекты «на союзников» на него не действуют.")),
      },
    ],
  },
  {
    key: "terror",
    name: "Ужас",
    img: "icons/svg/terror.svg",
    flavor: "Персонаж начинает видеть свои худшие кошмары наяву.",
    variants: [
      {
        text:
          "Толпа существ, в чьей смерти он повинен, шепчет ему проклятья: <b>продолжительный ментальный урон</b> " +
          "(½ уровня)d4 и <b>напуган 2</b>.",
        apply: async (a) => {
          const dice = Math.max(1, Math.floor(a.level / 2));
          await addPersistent(a, "mental", `${dice}d4`);
          await setConditionAtLeast(a, "frightened", 2);
          return `${dice}d4 продолжительного ментального урона`;
        },
      },
      {
        text: "<b>В бегстве</b> 2 раунда, пока за ним гонятся его кошмары.",
        apply: (a) => addItem(a, eff("Ужас — погоня", "icons/svg/terror.svg", R2,
          [grant(C.fleeing, { lock: true })], "В бегстве: за ним гонятся его кошмары.")),
      },
      {
        text:
          "Видит нечто отвратительное: <b>тошнота 1</b> и <b>замедлен 1</b>. Тошноту снимает рвота, " +
          "замедление спадает, как только отнимет одно действие.",
        apply: async (a) => {
          await setConditionAtLeast(a, "sickened", 1);
          await addItem(a, eff("Ужас — отвращение", "icons/svg/poison.svg", rounds(1, "turn-end"),
            [grant(C.slowed, { value: 1 })], "Замедлен 1 до конца следующего хода."));
        },
      },
    ],
  },
  {
    key: "overcome",
    name: "Преодоление Ужаса",
    img: "icons/svg/sun.svg",
    positive: true,
    flavor: "Персонажу удаётся на время собраться с силами и преодолеть страх.",
    variants: [
      {
        text: "<b>Ускорен</b> на 2 раунда.",
        apply: (a) => addItem(a, eff("Преодоление — рывок", "icons/svg/wingfoot.svg", R2,
          [grant(C.quickened, { lock: true })], "Ускорен.")),
      },
      {
        text: "Эффект заклинания <b>Героизм</b> 3-го ранга на 2 раунда.",
        apply: async (a) => {
          const src = await fromCompendium(EFFECT.heroism, { system: { duration: R2, level: { value: 3 } } });
          if (src) await addItem(a, src);
        },
      },
      {
        text: "Произносит <b>Успокаивающие слова</b> для себя и союзников в радиусе 30 футов.",
        apply: async (a) => {
          const me = tokenOf(a);
          const tokens = me ? canvas.tokens.placeables : [];
          const allies = tokens.filter((t) => t !== me && t.actor && isPC(t.actor) && feetBetween(me, t) <= 30).map((t) => t.actor);
          const targets = [...new Map([a, ...allies].map((x) => [x.uuid, x])).values()];
          const src = await fromCompendium(EFFECT.soothingWords, {
            system: { duration: minutes(1), level: { value: spellRank(a.level) } },
          });
          if (src) for (const t of targets) await addItem(t, foundry.utils.deepClone(src));
          return `Успокаивающие слова: ${targets.map((t) => t.name).join(", ")}`;
        },
      },
    ],
  },
];
