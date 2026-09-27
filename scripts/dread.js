// Ужас (Dread) — Horror Mode из Adventures+ (стр. 73–76) с домашним Срывом.
// Рост Ужаса, расширенный диапазон, Подавить ужас / Предотвратить панику, диалог управления.
import { setting } from "./settings.js";
import {
  MAX_DREAD, TAG, CHECK_TYPES, DEGREE_RU, UNLIMITED, UUID,
  getDread, dreadValue, isPC, isEnemy, whisperGM, levelDC, sceneOf, uniq, addItem, selectedActors,
  grant, penalty, scareEffect, effectiveDegree, partyInZone, setDread,
  removeOwnScares, endScares, checkScareEnd,
} from "./common.js";
import { triggerScare, dreadCheck } from "./scares.js";
import { meltdown } from "./meltdown.js";

// ---------- расширенный диапазон Ужаса как правила PF2e ----------
// Свой бросок: натуральные 2..Ужас — на ступень хуже (1 и так понижает).
const SELF_RANGE = [
  { gt: ["check:total:natural", 1] },
  { or: [2, 3, 4, 5].map((n) => ({ and: [`self:effect:dread:${n}`, { lte: ["check:total:natural", n] }] })) },
];
// Бросок врага против персонажа с Ужасом: натуральные (21 − Ужас)..19 — на ступень лучше.
const VICTIM_RANGE = [
  "target:enemy",
  { lt: ["check:total:natural", 20] },
  { or: [2, 3, 4, 5].map((n) => ({ and: [`target:effect:dread:${n}`, { gte: ["check:total:natural", 21 - n] }] })) },
];

// Служебный предмет в мире: временно достаётся врагу, когда тот бьёт по персонажу с Ужасом
function victimSource() {
  return {
    type: "effect",
    name: "Ужас цели",
    img: "icons/svg/terror.svg",
    flags: { world: { heartDreadVictim: true } },
    system: {
      description: { value: "<p>Служебный эффект модуля «Сердце Фантазии». Не удалять.</p>" },
      duration: UNLIMITED,
      rules: ["attack-roll", "skill-check"].map((selector) => ({
        key: "AdjustDegreeOfSuccess", selector, adjustment: { all: "one-degree-better" }, predicate: VICTIM_RANGE,
      })),
    },
  };
}
const findVictimItem = () => game.items.find((i) => i.getFlag("world", "heartDreadVictim")) ?? null;
async function ensureVictimItem() {
  const source = victimSource();
  const item = findVictimItem();
  if (!item) return (await getDocumentClass("Item").create(source)).uuid;
  await item.update({ "system.rules": source.system.rules });
  return item.uuid;
}

function dreadRules(victimUuid) {
  return [
    ...["check", "flat-check"].map((selector) => ({
      key: "AdjustDegreeOfSuccess", selector, adjustment: { all: "one-degree-worse" }, predicate: SELF_RANGE,
    })),
    ...["check", "flat-check"].map((selector) => ({
      key: "Note", selector, predicate: SELF_RANGE,
      title: "Ужас {item|system.badge.value}",
      text: "Натуральный результат не выше Ужаса — степень успеха на ступень хуже.",
    })),
    ...(victimUuid ? [{ key: "EphemeralEffect", affects: "origin", selectors: ["attack-roll", "skill-check"], uuid: victimUuid }] : []),
  ];
}

function dreadSource(value, victimUuid) {
  return {
    type: "effect",
    name: "Ужас",
    img: "icons/svg/terror.svg",
    system: {
      slug: "dread",
      description: {
        value:
          "<p>Вы в зоне ужаса. Натуральные результаты не выше значения Ужаса ухудшают степень успеха на ступень. " +
          "Враждебные проверки против вас улучшают степень на натуральных от (21 − Ужас).</p>" +
          "<p>Минута вне зоны снимает Ужас. На максимуме — Срыв.</p>",
      },
      badge: { type: "counter", value, min: 1, max: MAX_DREAD },
      duration: UNLIMITED,
      tokenIcon: { show: true },
      rules: dreadRules(victimUuid),
    },
  };
}

// Обновить правила на уже выданных эффектах Ужаса
async function migrateDread(victimUuid) {
  const actors = uniq([...game.actors.contents, ...(canvas.scene?.tokens ?? []).map((t) => t.actor)]);
  for (const a of actors) {
    const eff = getDread(a);
    if (eff) await eff.update({ "system.rules": dreadRules(victimUuid) });
  }
}

// ---------- рост Ужаса ----------
function currentTick() {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}` : null; // вне боя лимита нет
}

// tick = null — без лимита (ручное начисление). Возвращает { from, to, meltdown } или null.
async function addDread(actor, tick = null) {
  const eff = getDread(actor);
  if (!eff) return null;
  if (setting("dreadOncePerRound") && tick && eff.getFlag("world", "dreadTick") === tick) return null;
  const from = eff.system.badge?.value ?? 1;
  const to = Math.min(from + 1, MAX_DREAD);
  const update = { "system.badge.value": to };
  if (tick) update["flags.world.dreadTick"] = tick;
  await eff.update(update);
  return { from, to, meltdown: to >= MAX_DREAD };
}

async function applyDread(actors, trigger, tick) {
  const lines = [];
  const breaking = [];
  for (const a of actors) {
    const res = await addDread(a, tick);
    if (!res) continue;
    if (res.meltdown) breaking.push(a);
    lines.push(
      res.from === res.to
        ? `${a.name}: Ужас на пределе — <b>Срыв</b>!`
        : `${a.name}: Ужас ${res.from} → ${res.to}${res.meltdown ? " — <b>Срыв</b>!" : ""}`,
    );
  }
  if (lines.length && setting("dreadAnnounce")) {
    await ChatMessage.create({ content: `<p><i>${trigger}. Страх расползается.</i></p><p>${lines.join("<br>")}</p>` });
  }
  for (const a of breaking) await meltdown(a);
}

// ---------- Подавить ужас / Предотвратить панику: итог ----------
async function resolveCalm(ctx, roller, nat, kind) {
  const dv = dreadValue(roller);
  if (!dv) return;
  const deg = effectiveDegree(ctx, nat, dv);
  if (deg === null) return;
  const title = kind === "stifle" ? "Подавить ужас" : "Предотвратить панику";
  const scene = sceneOf(roller);
  let text;
  if (deg >= 2) {
    const nv = Math.max(1, dv - (deg === 3 ? 2 : 1));
    await setDread(roller, nv);
    text = nv === dv ? "Ужас и так на минимуме." : `Ужас ${dv} → ${nv}.`;
  } else if (deg === 1) {
    text = "Ужас не отступает.";
  } else {
    text = "Паника вырывается наружу — Испуг!";
  }
  await ChatMessage.create({ content: `<p><b>${roller.name}: ${title}</b> — ${DEGREE_RU[deg]}. ${text}</p>` });
  if (deg >= 2) await checkScareEnd(scene);
  if (deg === 0) await triggerScare(partyInZone(scene), scene, title);
}

// ---------- результаты проверок Испуга ----------
async function resolvePending(ctx, roller, nat, kind) {
  const pending = roller.items.find((i) => i.getFlag("world", "heartScarePending") === kind);
  if (!pending) return;
  const dv = pending.getFlag("world", "heartScareDv") ?? dreadValue(roller);
  const deg = effectiveDegree(ctx, nat, dreadValue(roller));
  if (deg === null) return;
  await pending.delete();
  let text;
  if (kind === "trap") {
    const dc = pending.getFlag("world", "heartScareDc");
    if (deg >= 2) {
      text = "вырывается";
    } else {
      const grabbed = deg === 0;
      await addItem(roller, scareEffect(grabbed ? "Западня (схвачен)" : "Западня (обездвижен)", {
        rules: [grant(grabbed ? UUID.restrained : UUID.immobilized), penalty(["athletics", "acrobatics", "attack-roll"], dv, "Западня", ["action:escape"])],
        desc: `Высвободиться: DC ${dc}, штраф −${dv}.`,
      }));
      text = `${grabbed ? "схвачен" : "обездвижен"}; Высвобождение DC ${dc}, штраф −${dv}`;
    }
    await ChatMessage.create({ content: `<p><b>${roller.name}: Западня</b> — ${DEGREE_RU[deg]}, ${text}.</p>` });
  } else if (kind === "break") {
    text = deg >= 2 ? "обошлось" : `ломается предмет в руках (выбирает ГМ); Починка — DC +${dv}`;
    await ChatMessage.create({ content: `<p><b>${roller.name}: Поломка</b> — ${DEGREE_RU[deg]}, ${text}.</p>` });
  }
}

// ---------- страховка: правило диапазона не сработало ----------
async function remindRange(message, ctx, roller, nat) {
  if (!ctx.dc || ctx.outcome !== ctx.unadjustedOutcome) return; // степень уже скорректирована
  const notes = [];
  const own = dreadValue(roller);
  if (isPC(roller) && own > 1 && nat > 1 && nat <= own && ctx.outcome !== "criticalFailure") {
    notes.push(`${roller.name}: натуральная ${nat} при Ужасе ${own} — понизьте степень успеха на ступень.`);
  }
  const tgt = message.target?.actor;
  const tv = dreadValue(tgt);
  if (isEnemy(roller) && isPC(tgt) && tv > 1 && nat < 20 && nat >= 21 - tv && ctx.outcome !== "criticalSuccess") {
    notes.push(`${roller.name} против ${tgt.name}: натуральная ${nat} при Ужасе ${tv} — повысьте степень врага на ступень.`);
  }
  if (notes.length) await whisperGM(`<p><b>Ужас (для ГМ): автоматика не сработала</b><br>${notes.join("<br>")}</p>`);
}

// ---------- обработчики ----------
async function onMessage(message) {
  if (game.users.activeGM !== game.user) return; // считает только один активный ГМ
  const ctx = message.flags?.pf2e?.context;
  if (!ctx || !CHECK_TYPES.has(ctx.type)) return;
  if (ctx.type === "flat-check" && !setting("dreadFlatChecks")) return;

  const d20 = message.rolls?.[0]?.dice?.find((d) => d.faces === 20);
  const nat = d20?.total; // при удаче/неудаче (2d20kh/kl) — оставленный кубик
  const roller = message.actor;
  if (!nat || !roller) return;

  const options = ctx.options ?? [];
  if (options.includes(TAG.stifle)) await resolveCalm(ctx, roller, nat, "stifle");
  else if (options.includes(TAG.panic)) await resolveCalm(ctx, roller, nat, "panic");
  else if (options.includes(TAG.trap)) await resolvePending(ctx, roller, nat, "trap");
  else if (options.includes(TAG.break)) await resolvePending(ctx, roller, nat, "break");
  else await remindRange(message, ctx, roller, nat);

  let trigger = null;
  if (nat === 1 && isPC(roller) && getDread(roller)) trigger = `${roller.name} выбрасывает натуральную 1`;
  else if (nat === 20 && isEnemy(roller)) trigger = `${roller.name} выбрасывает натуральную 20`;
  if (!trigger) return;

  const scene = game.scenes.get(message.speaker?.scene) ?? canvas.scene;
  let targets;
  if (setting("dreadScope") === "party") {
    targets = partyInZone(scene);
  } else {
    const origin = ctx.origin?.actor ? fromUuidSync(ctx.origin.actor) : null;
    const who = isPC(roller) ? roller : [message.target?.actor, origin].find((a) => a && isPC(a));
    targets = who && getDread(who) ? [who] : [];
  }
  if (!targets.length) return;

  // Секретная проверка: не выдаём результат игрокам
  const secret = !!message.blind || (message.whisper?.length ?? 0) > 0;
  if (secret) {
    await whisperGM(`<p><b>Ужас (для ГМ):</b> ${trigger} в секретной проверке. Автоматически не начислено.</p>`);
    return;
  }

  await applyDread(targets, trigger, currentTick());
}

const seenRounds = new Map();
async function onCombatUpdate(combat, changed) {
  if (game.users.activeGM !== game.user) return;
  if (!setting("dreadRoundCheck") || !("round" in changed)) return;
  const prev = seenRounds.get(combat.id) ?? changed.round - 1;
  seenRounds.set(combat.id, changed.round);
  if (changed.round < 2 || changed.round <= prev) return; // старт боя или откат раунда
  const party = combat.combatants.map((c) => c.actor).filter((a) => a && isPC(a) && getDread(a));
  await dreadCheck(party, combat.scene ?? canvas.scene, `конец раунда ${changed.round - 1}`);
}

// ---------- действия игроков ----------
async function rollCalm(actor, kind) {
  const a = actor ?? game.user.character;
  if (!a) return ui.notifications.warn("Выделите своего персонажа.");
  if (!getDread(a)) return ui.notifications.warn(`${a.name} не в зоне ужаса.`);
  const inCombat = !!game.combat?.started && game.combat.combatants.some((c) => c.actor === a);
  if (kind === "stifle" && inCombat) return ui.notifications.warn("В бою используйте «Предотвратить панику».");
  if (kind === "panic" && !game.combat?.started) {
    return ui.notifications.warn("Предотвратить панику — только в бою. Вне боя: «Подавить ужас».");
  }
  await a.getStatistic("will").roll({
    dc: { value: levelDC(a.level), label: "Стандартный DC уровня" },
    label: kind === "stifle" ? "Подавить ужас" : "Предотвратить панику",
    extraRollOptions: [kind === "stifle" ? TAG.stifle : TAG.panic],
    ...(kind === "stifle" ? { traits: ["concentrate"] } : {}),
  });
}

// ---------- управление (ГМ) ----------
async function enterZone(actors) {
  let victimUuid = findVictimItem()?.uuid;
  if (!victimUuid) victimUuid = await ensureVictimItem();
  for (const a of actors) if (!getDread(a)) await addItem(a, dreadSource(1, victimUuid));
}

async function leaveZone(actors) {
  for (const a of actors) {
    await getDread(a)?.delete();
    await removeOwnScares(a);
  }
  await checkScareEnd(canvas.scene);
}

async function lowerDread(actors, n) {
  for (const a of actors) {
    const v = dreadValue(a);
    if (v > 1) await setDread(a, Math.max(1, v - n));
    else if (v) ui.notifications.info(`${a.name}: в зоне Ужас не опускается ниже 1.`);
  }
  await checkScareEnd(canvas.scene);
}

async function meltdownSelected() {
  if (!game.user.isGM) return ui.notifications.warn("Срыв: только для ГМ.");
  const actors = selectedActors();
  if (!actors.length) return ui.notifications.warn("Срыв: выделите токены персонажей.");
  for (const a of actors) await meltdown(a);
}

const ACTIONS = [
  ["enter", "Войти в зону (выделенные)"],
  ["plus", "+1 Ужас (выделенные)"],
  ["minus", "−1 Ужас (выделенные)"],
  ["flee", "Бегство весь ход: −2 (выделенные)"],
  ["leave", "Выйти из зоны (выделенные)"],
  ["meltdown", "Срыв (выделенные)"],
  ["check", "Проверка Ужаса: 10 минут исследования (партия в зоне)"],
  ["scare", "Испуг вручную (партия в зоне)"],
  ["clear", "Снять все Испуги"],
];
const NEED_SELECTED = new Set(["enter", "plus", "minus", "flee", "leave", "meltdown"]);

async function manage() {
  if (!game.user.isGM) return ui.notifications.warn("Ужас: только для ГМ.");
  if (!setting("dreadEnabled")) return ui.notifications.warn("Ужас выключен в настройках модуля.");
  const actors = selectedActors();
  const party = partyInZone(canvas.scene);
  const selected = actors.length ? actors.map((a) => `${a.name}: ${getDread(a)?.system.badge?.value ?? "вне зоны"}`).join("<br>") : "не выделены";
  const inZone = party.length ? party.map((a) => `${a.name} ${dreadValue(a)}`).join(", ") : "никого";
  const options = ACTIONS.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");

  const action = await foundry.applications.api.DialogV2.wait({
    window: { title: "Ужас" },
    content:
      `<p><b>Выделены:</b><br>${selected}</p><p><b>В зоне на сцене:</b> ${inZone}</p>` +
      `<div class="form-group"><select name="action">${options}</select></div>`,
    buttons: [
      { action: "ok", label: "Выполнить", icon: "fa-solid fa-check", default: true, callback: (event, button) => button.form.elements.action.value },
      { action: "cancel", label: "Отмена" },
    ],
    rejectClose: false,
  });
  if (!action || action === "cancel") return;
  if (NEED_SELECTED.has(action) && !actors.length) return ui.notifications.warn("Ужас: выделите токены персонажей.");

  switch (action) {
    case "enter": return enterZone(actors);
    case "plus": return applyDread(actors.filter((a) => getDread(a)), "Ужас нарастает", null);
    case "minus": return lowerDread(actors, 1);
    case "flee": return lowerDread(actors, 2);
    case "leave": return leaveZone(actors);
    case "meltdown": for (const a of actors) await meltdown(a); return;
    case "check": return dreadCheck(party, canvas.scene, "10 минут исследования");
    case "scare": return triggerScare(party, canvas.scene, "вручную", { force: true });
    case "clear": return endScares(canvas.scene);
  }
}

// ---------- запуск ----------
let started = false;
export async function start() {
  if (started) return;
  started = true;
  Hooks.on("createChatMessage", onMessage);
  Hooks.on("updateCombat", onCombatUpdate);
  if (game.user === game.users.activeGM) {
    const victimUuid = await ensureVictimItem();
    await migrateDread(victimUuid);
  }
}

// Публичный API: game.modules.get("heart-of-fantasy").api.dread
export const api = {
  manage,
  stifle: (actor) => rollCalm(actor, "stifle"),
  panic: (actor) => rollCalm(actor, "panic"),
  meltdown,
  meltdownSelected,
  enterZone,
  leaveZone,
  addDread: (actors, reason = "Ужас нарастает") => applyDread(uniq([actors].flat()).filter((a) => getDread(a)), reason, null),
  lowerDread,
  triggerScare,
  dreadCheck,
  endScares,
  getDread,
  dreadValue,
  partyInZone,
};
