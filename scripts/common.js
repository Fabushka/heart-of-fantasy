// Общие константы и помощники подсистемы Ужаса.

export const MAX_DREAD = 5;

const COND = "Compendium.pf2e.conditionitems.Item.";
export const UUID = {
  fleeing: COND + "sDPxOjQ9kx2RZE8D",
  fascinated: COND + "AdPVz7rbaVSRxHFg",
  immobilized: COND + "eIcWbB5o3pP6OIMe",
  restrained: COND + "VcDeM8A5oI6VqhbM",
  quickened: COND + "nlCjDvLMf2EkV2dl",
  sickened: COND + "fesd1n5eVhpCSS18",
  confused: COND + "yblD8fOR1J8rDwEQ",
  offGuard: COND + "AJh5ex99aV6VTggg",
  persistent: COND + "lDVqvLKA6eF3Df60",
  heroism: "Compendium.pf2e.spell-effects.Item.l9HRQggofFGIxEse", // Spell Effect: Heroism (ранг 3)
  sureStrike: "Compendium.pf2e.spell-effects.Item.fpGDAz2v5PG0zUSl", // Spell Effect: Sure Strike
};

// Метки бросков: по ним ядро узнаёт свои проверки в чате
export const TAG = {
  stifle: "heart-dread:stifle",
  panic: "heart-dread:panic",
  trap: "heart-dread:scare-trap",
  break: "heart-dread:scare-break",
  door: "heart-dread:scare-door",
  ground: "heart-dread:scare-ground",
};

export const CHECK_TYPES = new Set([
  "attack-roll", "check", "counteract-check", "flat-check",
  "initiative", "perception-check", "saving-throw", "skill-check",
]);
export const DEGREES = ["criticalFailure", "failure", "success", "criticalSuccess"];
export const DEGREE_RU = ["критический провал", "провал", "успех", "критический успех"];
const DC_BY_LEVEL = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];

export const UNLIMITED = { value: -1, unit: "unlimited", expiry: null, sustained: false };
export const MIN10 = { value: 10, unit: "minutes", expiry: "turn-start", sustained: false };
export const rounds = (n) => ({ value: n, unit: "rounds", expiry: "turn-start", sustained: false });

export const getDread = (actor) => actor?.itemTypes?.effect.find((e) => e.slug === "dread") ?? null;
export const dreadValue = (actor) => getDread(actor)?.system.badge?.value ?? 0;
export const isPC = (a) => a?.alliance === "party";
export const isEnemy = (a) => a?.alliance === "opposition";
export const gmIds = () => ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
export const whisperGM = (html) => ChatMessage.create({ content: html, whisper: gmIds() });
export const levelDC = (lvl) => DC_BY_LEVEL[Math.clamp(Math.round(lvl), 0, 25)];
export const halfLevelTimes = (actor, dv) => Math.max(1, Math.floor(actor.level / 2) * dv);
export const sceneOf = (actor) => actor?.getActiveTokens?.(false, true)?.[0]?.parent ?? canvas.scene;
export const uniq = (actors) => [...new Map(actors.filter(Boolean).map((a) => [a.uuid, a])).values()];
export const addItem = (actor, source) => actor.createEmbeddedDocuments("Item", [source]);
export const selectedActors = () => uniq(canvas.tokens.controlled.map((t) => t.actor));

export const grant = (uuid, extra = {}) => ({ key: "GrantItem", uuid, ...extra });
export const penalty = (selector, dv, label, predicate) => ({
  key: "FlatModifier", selector, type: "status", value: -dv, label, ...(predicate ? { predicate } : {}),
});
export const persistent = (damageType, formula, dc) =>
  grant(UUID.persistent, {
    alterations: [
      { mode: "override", property: "persistent-damage", value: { damageType, formula: String(formula) } },
      { mode: "override", property: "pd-recovery-dc", value: dc },
    ],
    onDeleteActions: { grantee: "cascade" },
  });

export function scareEffect(name, { duration = UNLIMITED, rules = [], desc = "", flags = {} } = {}) {
  return {
    type: "effect",
    name: `Испуг: ${name}`,
    img: "icons/svg/hazard.svg",
    flags: { world: { heartScare: true, ...flags } },
    system: {
      description: {
        value: `<p>${desc}</p><p>Испуг кончается, когда Ужас всей партии снижен до 1 или партия покинула зону.</p>`,
      },
      duration,
      tokenIcon: { show: true },
      rules,
    },
  };
}

// Итоговая степень успеха: доверяем PF2e; если правило диапазона почему-то не сработало — страхуем
export function effectiveDegree(ctx, nat, dv) {
  let deg = DEGREES.indexOf(ctx.outcome ?? "");
  if (deg < 0) return null;
  const expected = dv > 1 && nat > 1 && nat <= dv;
  if (expected && ctx.outcome === ctx.unadjustedOutcome && deg > 0) deg -= 1;
  return deg;
}

export function partyInZone(scene) {
  return uniq((scene?.tokens ?? []).map((t) => t.actor).filter((a) => a && isPC(a) && getDread(a)));
}

export async function setDread(actor, value) {
  const eff = getDread(actor);
  if (!eff) return;
  await eff.update({ "system.badge.value": Math.clamp(value, 1, MAX_DREAD) });
}

// ---------- конец Испугов ----------
export async function removeOwnScares(actor) {
  const ids = actor.items.filter((i) => i.getFlag("world", "heartScare")).map((i) => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  return ids.length;
}

export async function endScares(scene) {
  const actors = uniq([
    ...(scene?.tokens ?? []).map((t) => t.actor),
    ...game.actors.filter((a) => a.type === "character"),
  ]);
  let removed = 0;
  for (const a of actors) removed += await removeOwnScares(a);
  if (removed) await ChatMessage.create({ content: "<p><i>Наваждение отступает. Испуги рассеялись.</i></p>" });
}

// Вызывать после каждого СНИЖЕНИЯ Ужаса или выхода из зоны
export async function checkScareEnd(scene) {
  const party = partyInZone(scene);
  if (party.length && !party.every((a) => dreadValue(a) <= 1)) return;
  await endScares(scene);
}
