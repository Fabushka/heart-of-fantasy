// Рост Ужаса и разбор бросков в чате.
import { DEGREE_RU, levelDC, whisperGM, sceneOf } from "../../core/pf2e.js";
import { S } from "./settings.js";
import { MAX_DREAD, TAG, getDread, dreadValue, isPC, isEnemy, partyInZone, setDread } from "./state.js";
import { meltdown, isImmune, sweepExpiredImmunity } from "./meltdown.js";
import {
  effectiveDegree, triggerScare, resolveScareRoll, resolveEscape, dreadCheck, checkScareEnd,
} from "./scares/engine.js";
import { resolveAffliction } from "./scares/afflictions.js";

const CHECK_TYPES = new Set([
  "attack-roll", "check", "counteract-check", "flat-check",
  "initiative", "perception-check", "saving-throw", "skill-check",
]);

function currentTick() {
  const c = game.combat;
  return c?.started ? `${c.id}:${c.round}` : null; // вне боя лимита нет
}

// tick = null — без лимита (ручное начисление). Возвращает { from, to } или null.
async function addDread(actor, tick = null) {
  const eff = getDread(actor);
  if (!eff) return null;
  if (S.oncePerRound() && tick && eff.getFlag("world", "dreadTick") === tick) return null;
  const from = eff.system.badge?.value ?? 1;
  const to = Math.min(from + 1, MAX_DREAD);
  const update = { "system.badge.value": to };
  if (tick) update["flags.world.dreadTick"] = tick;
  await eff.update(update);
  return { from, to };
}

export async function applyDread(actors, trigger, tick) {
  const lines = [];
  const breaking = [];
  for (const a of actors) {
    const res = await addDread(a, tick);
    if (!res) continue;
    const atMax = res.to >= MAX_DREAD;
    const immune = atMax && isImmune(a);
    if (atMax && !immune) breaking.push(a);
    const tail = !atMax ? "" : immune ? " — на пределе, держится (передышка)" : " — <b>Срыв</b>!";
    lines.push(res.from === res.to ? `${a.name}: Ужас на пределе${tail}` : `${a.name}: Ужас ${res.from} → ${res.to}${tail}`);
  }
  if (lines.length && S.announce()) {
    await ChatMessage.create({
      content: `<div class="hof-card hof-result hof-growth"><p><i>${trigger}. Страх расползается.</i></p><p>${lines.join("<br>")}</p></div>`,
    });
  }
  for (const a of breaking) await meltdown(a);
}

// ---------- Подавить ужас / Предотвратить панику ----------
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
  await ChatMessage.create({ content: `<div class="hof-card hof-result hof-deg-${deg}"><p><b>${roller.name}: ${title}</b> — ${DEGREE_RU[deg]}. ${text}</p></div>` });
  if (deg >= 2) await checkScareEnd(scene);
  if (deg === 0) await triggerScare(partyInZone(scene), scene, title);
}

// ---------- страховка: правило диапазона не сработало ----------
async function remindRange(ctx, roller, nat) {
  if (!ctx.dc || ctx.outcome !== ctx.unadjustedOutcome) return; // степень уже скорректирована
  const own = dreadValue(roller);
  if (isPC(roller) && own > 1 && nat > 1 && nat <= own && ctx.outcome !== "criticalFailure") {
    await whisperGM(`<p><b>Ужас (для ГМ): автоматика не сработала</b><br>${roller.name}: натуральная ${nat} при Ужасе ${own} — понизьте степень успеха на ступень.</p>`);
  }
}

// ---------- сообщения в чате ----------
export async function onMessage(message) {
  if (game.users.activeGM !== game.user) return; // считает только один активный ГМ
  const ctx = message.flags?.pf2e?.context;
  if (!ctx || !CHECK_TYPES.has(ctx.type)) return;

  const d20 = message.rolls?.[0]?.dice?.find((d) => d.faces === 20);
  const nat = d20?.total; // при удаче/неудаче (2d20kh/kl) — оставленный кубик
  const roller = message.actor;
  if (!nat || !roller) return;

  const options = ctx.options ?? [];
  if (options.includes(TAG.stifle)) await resolveCalm(ctx, roller, nat, "stifle");
  else if (options.includes(TAG.panic)) await resolveCalm(ctx, roller, nat, "panic");
  else if (options.includes(TAG.scare)) await resolveScareRoll(ctx, roller, nat);
  else if (options.includes(TAG.escape)) await resolveEscape(ctx, roller, nat);
  else if (options.includes(TAG.affliction)) {
    const key = options.find((o) => o.startsWith(`${TAG.affliction}:`))?.slice(TAG.affliction.length + 1);
    const deg = effectiveDegree(ctx, nat, dreadValue(roller));
    if (key && deg !== null) await resolveAffliction(roller, key, deg);
  } else await remindRange(ctx, roller, nat);

  // Рост Ужаса: итоговая степень успеха, а не натуральный кубик
  if (ctx.isReroll) return; // переброс уже посчитан в исходном броске
  if (ctx.type === "flat-check" && !S.flatChecks()) return;
  let trigger = null;
  if (ctx.outcome === "criticalFailure" && isPC(roller) && getDread(roller)) trigger = `${roller.name}: критический провал`;
  else if (ctx.outcome === "criticalSuccess" && isEnemy(roller)) trigger = `${roller.name}: критический успех`;
  if (!trigger) return;

  const scene = game.scenes.get(message.speaker?.scene) ?? canvas.scene;
  let targets;
  if (S.scope() === "party") {
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

// ---------- бой ----------
const seenRounds = new Map();
export async function onCombatUpdate(combat, changed) {
  if (game.users.activeGM !== game.user) return;
  if (!("round" in changed) && !("turn" in changed)) return;
  const party = combat.combatants.map((c) => c.actor).filter((a) => a && isPC(a) && getDread(a));
  await sweepExpiredImmunity(party);

  if (!S.roundCheck() || !("round" in changed)) return;
  const prev = seenRounds.get(combat.id) ?? changed.round - 1;
  seenRounds.set(combat.id, changed.round);
  if (changed.round < 2 || changed.round <= prev) return; // старт боя или откат раунда
  await dreadCheck(party, combat.scene ?? canvas.scene, `конец раунда ${changed.round - 1}`);
}

// ---------- действия игроков ----------
export async function rollCalm(actor, kind) {
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
