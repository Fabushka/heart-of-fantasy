// Болезни и яды из Испугов. Стадия — отдельный эффект с состояниями;
// кнопка спасброска в описании и в чате, итог двигает стадию по правилам PF2e:
// крит. успех −2, успех −1, провал +1, крит. провал +2. Стадия 0 — выздоровел.
// Болезни не кончаются вместе с Испугами: это настоящие последствия.
import { CONDITION as C, grant, makeEffect, addItem, levelDC, days, minutes, hours, DEGREE_RU } from "../../../core/pf2e.js";
import { TAG } from "../state.js";

export const AFFLICTIONS = {
  graveRot: {
    name: "Могильная гниль",
    type: "болезнь",
    img: "icons/svg/biohazard.svg",
    save: "fortitude",
    interval: days(1),
    intervalText: "раз в день",
    lore: "Серая плесень с мёртвых тел пустила корни в лёгких. Суставы ноют, кожа шелушится, пальцы не слушаются.",
    stages: [
      { text: "неуклюж 1", rules: [grant(C.clumsy, { value: 1, lock: true })] },
      { text: "неуклюж 1, ослаблен 1", rules: [grant(C.clumsy, { value: 1, lock: true }), grant(C.enfeebled, { value: 1, lock: true })] },
      { text: "неуклюж 2, ослаблен 2, утомлён", rules: [grant(C.clumsy, { value: 2, lock: true }), grant(C.enfeebled, { value: 2, lock: true }), grant(C.fatigued, { lock: true })] },
    ],
  },
  nightFever: {
    name: "Кошмарная лихорадка",
    type: "болезнь",
    img: "icons/svg/degen.svg",
    save: "fortitude",
    interval: days(1),
    intervalText: "раз в день",
    lore: "Укусы крыс воспалились. Каждую ночь приходят одни и те же сны, и после них не отдохнуть.",
    stages: [
      { text: "ошеломлён 1", rules: [grant(C.stupefied, { value: 1, lock: true })] },
      { text: "ошеломлён 2, утомлён", rules: [grant(C.stupefied, { value: 2, lock: true }), grant(C.fatigued, { lock: true })] },
      { text: "ошеломлён 3, утомлён, напуган 1 не снимается", rules: [grant(C.stupefied, { value: 3, lock: true }), grant(C.fatigued, { lock: true }), grant(C.frightened, { value: 1, lock: true })] },
    ],
  },
  corpsePoison: {
    name: "Трупный яд",
    type: "яд",
    img: "icons/svg/poison.svg",
    save: "fortitude",
    interval: minutes(10),
    intervalText: "каждые 10 минут",
    maxDuration: hours(1),
    lore: "Игла была смазана чем-то, что пахнет склепом. Мышцы наливаются свинцом.",
    stages: [
      { text: "ослаблен 1", rules: [grant(C.enfeebled, { value: 1, lock: true })] },
      { text: "ослаблен 2", rules: [grant(C.enfeebled, { value: 2, lock: true })] },
      { text: "ослаблен 2, неуклюж 1", rules: [grant(C.enfeebled, { value: 2, lock: true }), grant(C.clumsy, { value: 1, lock: true })] },
    ],
  },
  // Лес Отродья (Осколок №1, кабан): проклятое мясо оседает в желудке паразитом
  spawnHunger: {
    name: "Голод Отродья",
    type: "проклятие",
    img: "icons/svg/pawprint.svg",
    save: "fortitude",
    interval: days(1),
    intervalText: "раз в день",
    lore: "Кусок проклятого мяса не переварился и прижился в желудке. Голод не утоляется ничем, а под ним тлеет чужая слепая ярость.",
    stages: [
      { text: "ослаблен 1: сколько ни ешь — мало", rules: [grant(C.enfeebled, { value: 1, lock: true })] },
      { text: "ослаблен 1, ошеломлён 1: мысли только о мясе", rules: [grant(C.enfeebled, { value: 1, lock: true }), grant(C.stupefied, { value: 1, lock: true })] },
      { text: "ослаблен 2, ошеломлён 2, утомлён, чёрная пена у рта", rules: [grant(C.enfeebled, { value: 2, lock: true }), grant(C.stupefied, { value: 2, lock: true }), grant(C.fatigued, { lock: true })] },
    ],
  },
  blackTar: {
    name: "Чёрная смола",
    type: "яд",
    img: "icons/svg/acid.svg",
    save: "fortitude",
    interval: minutes(10),
    intervalText: "каждые 10 минут",
    maxDuration: hours(1),
    lore: "Смола заражённого дерева въедается в кожу и жжёт изнутри. Пальцы липнут и немеют.",
    stages: [
      { text: "неуклюж 1", rules: [grant(C.clumsy, { value: 1, lock: true })] },
      { text: "неуклюж 2", rules: [grant(C.clumsy, { value: 2, lock: true })] },
      { text: "неуклюж 2, ослаблен 1", rules: [grant(C.clumsy, { value: 2, lock: true }), grant(C.enfeebled, { value: 1, lock: true })] },
    ],
  },
};

export const getAffliction = (actor, key) =>
  actor.itemTypes.effect.find((e) => e.getFlag("world", "heartAffliction")?.key === key) ?? null;

export const saveButton = (key, dc) => {
  const A = AFFLICTIONS[key];
  return `@Check[${A.save}|dc:${dc}|name:${A.name}: спасбросок|options:${TAG.affliction},${TAG.affliction}:${key}]`;
};

function stageSource(key, stage, dc) {
  const A = AFFLICTIONS[key];
  const S = A.stages[stage - 1];
  const table = A.stages.map((s, i) => `${i === stage - 1 ? "<b>" : ""}Стадия ${i + 1}: ${s.text}${i === stage - 1 ? "</b>" : ""}`).join("<br>");
  return makeEffect({
    name: `${A.name} (стадия ${stage})`,
    img: A.img,
    duration: A.maxDuration ?? { value: -1, unit: "unlimited", expiry: null, sustained: false },
    rules: S.rules,
    desc:
      `<p><em>${A.lore}</em></p><p>${A.type[0].toUpperCase() + A.type.slice(1)}. Спасбросок ${A.intervalText}: ${saveButton(key, dc)}</p>` +
      `<p>${table}</p><p>Крит. успех −2 стадии, успех −1, провал +1, крит. провал +2. Стадия 0 — выздоровление.</p>`,
    flags: { world: { heartAffliction: { key, stage, dc } } },
  });
}

// Заразить: stage 1 при провале, 2 при крит. провале. Возвращает строку для чата.
export async function inflict(actor, key, stage, dc = levelDC(actor.level)) {
  const A = AFFLICTIONS[key];
  const existing = getAffliction(actor, key);
  const current = existing?.getFlag("world", "heartAffliction")?.stage ?? 0;
  const next = Math.clamp(current + stage, 1, A.stages.length);
  if (existing) await existing.delete();
  await addItem(actor, stageSource(key, next, dc));
  return `${A.type} «${A.name}», стадия ${next}: ${A.stages[next - 1].text}; спасбросок ${A.intervalText} — ${saveButton(key, dc)}`;
}

// Итог спасброска от болезни или яда
export async function resolveAffliction(actor, key, degree) {
  const A = AFFLICTIONS[key];
  const eff = getAffliction(actor, key);
  if (!A || !eff) return;
  const { stage, dc } = eff.getFlag("world", "heartAffliction");
  const next = Math.min(stage + [2, 1, -1, -2][degree], A.stages.length);
  await eff.delete();
  let text;
  if (next <= 0) {
    text = `${A.name} отступает — выздоровление.`;
  } else {
    await addItem(actor, stageSource(key, next, dc));
    text = `${A.name}: стадия ${stage} → ${next} (${A.stages[next - 1].text}).`;
  }
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="hof-card hof-result"><p><b>${actor.name}</b> · ${A.name} — ${DEGREE_RU[degree]}. ${text}</p></div>`,
  });
}
