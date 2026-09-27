// Срыв: на Ужасе 5 — случайное состояние (1d5) и вариант (1d3), Ужас падает до 1,
// затем передышка: новый Срыв не случается N раундов. Если к концу передышки Ужас 5 — Срыв сразу.
import { rounds, addItem, makeEffect, rollDie, sceneOf, selectedActors } from "../../core/pf2e.js";
import { S } from "./settings.js";
import { IMMUNITY_SLUG, getDread, dreadValue, setDread, MAX_DREAD } from "./state.js";
import { MELTDOWNS } from "./meltdowns.js";
import { checkScareEnd } from "./scares/engine.js";

const busy = new Set();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export const getImmunity = (actor) => actor?.itemTypes?.effect.find((e) => e.slug === IMMUNITY_SLUG) ?? null;
const expired = (e) => e?.remainingDuration?.expired ?? e?.isExpired ?? false;
export const isImmune = (actor) => {
  const e = getImmunity(actor);
  return !!e && !expired(e);
};

function playSound() {
  const src = S.sound();
  if (!src) return;
  const AudioHelper = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
  AudioHelper?.play({ src, volume: S.volume(), autoplay: true, loop: false }, true);
}

async function setImmunity(actor) {
  const old = getImmunity(actor);
  if (old) await old.delete();
  const n = S.immunityRounds();
  if (!n) return 0;
  await addItem(actor, makeEffect({
    name: "Передышка после Срыва",
    img: "icons/svg/regen.svg",
    slug: IMMUNITY_SLUG,
    duration: rounds(n),
    desc: `<p>Новый Срыв не случится ${n} р. Если к концу передышки Ужас 5 — Срыв сразу.</p>`,
    flags: { world: { heartMeltdown: true } },
  }));
  return n;
}

function card(actor, state, s, v, variant, details, immunity) {
  const plural = immunity === 1 ? "раунд" : immunity < 5 ? "раунда" : "раундов";
  return `
<div class="hof-card hof-meltdown hof-mood-${state.key}">
  <header>
    <img class="hof-portrait" src="${actor.img}" alt="">
    <div>
      <span class="hof-kicker">Срыв</span>
      <h3>${state.name}</h3>
      <span class="hof-who">${actor.name}</span>
    </div>
    <img class="hof-icon" src="${state.img}" alt="">
  </header>
  <p class="hof-flavor">${state.flavor}</p>
  <div class="hof-box">
    <span class="hof-dice">d5 = ${s} · d3 = ${v}</span>
    <p>${variant.text}</p>
    ${details ? `<p class="hof-details">${details}</p>` : ""}
  </div>
  <footer>Ужас → 1${immunity ? ` · передышка ${immunity} ${plural}` : ""}</footer>
</div>`;
}

export async function meltdown(actor, { state: forcedState = null, variant: forcedVariant = null } = {}) {
  if (!actor || busy.has(actor.uuid)) return;
  busy.add(actor.uuid);
  try {
    const s = forcedState ?? (await rollDie(5));
    const v = forcedVariant ?? (await rollDie(3));
    const state = MELTDOWNS[s - 1];
    const variant = state.variants[v - 1];

    playSound();
    if (getDread(actor)) await setDread(actor, 1);
    const immunity = await setImmunity(actor);
    let details = "";
    try {
      details = (await variant.apply(actor)) || "";
      if (typeof details !== "string") details = "";
    } catch (err) {
      console.error("heart-of-fantasy | Срыв", err);
      details = `Не удалось наложить эффект автоматически: ${err.message}. Наложите вручную.`;
    }
    await wait(1200); // пусть сердце успеет стукнуть пару раз
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: card(actor, state, s, v, variant, details, immunity),
      flags: { "heart-of-fantasy": { meltdown: { state: state.key, variant: v } } },
    });
    await checkScareEnd(sceneOf(actor));
  } finally {
    busy.delete(actor.uuid);
  }
}

// Передышка кончилась, а Ужас уже 5 — Срыв сразу
export async function onImmunityGone(actor) {
  if (!actor || game.users.activeGM !== game.user) return;
  if (dreadValue(actor) >= MAX_DREAD && !isImmune(actor)) await meltdown(actor);
}

// Если в PF2e выключено автоудаление истёкших эффектов — убираем передышку сами
export async function sweepExpiredImmunity(actors) {
  for (const a of actors) {
    const e = getImmunity(a);
    if (e && expired(e)) await e.delete(); // удаление запустит onImmunityGone через хук
  }
}

export async function meltdownSelected() {
  if (!game.user.isGM) return ui.notifications.warn("Срыв: только для ГМ.");
  const actors = selectedActors();
  if (!actors.length) return ui.notifications.warn("Срыв: выделите токены персонажей.");
  for (const a of actors) await meltdown(a);
}
