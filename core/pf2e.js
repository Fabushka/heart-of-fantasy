// Помощники для PF2e 8.x, общие для всех подсистем. Сверено с исходниками PF2e 8.5.1.

const COND = "Compendium.pf2e.conditionitems.Item.";
export const CONDITION = {
  blinded: COND + "XgEqL1kFApUbl5Z2",
  clumsy: COND + "i3OJZU2nk64Df3xm",
  concealed: COND + "DmAIPqOBomZ7H95W",
  confused: COND + "yblD8fOR1J8rDwEQ",
  dazzled: COND + "TkIyaNPgTZFBCCuh",
  deafened: COND + "9PR9y0bi4JPKnHPR",
  doomed: COND + "3uh1r86TzbQvosxv",
  drained: COND + "4D2KBtexWXa6oUMR",
  enfeebled: COND + "MIRkyAjyBeXivMa7",
  fascinated: COND + "AdPVz7rbaVSRxHFg",
  fatigued: COND + "HL2l2VRSaQHu9lUw",
  fleeing: COND + "sDPxOjQ9kx2RZE8D",
  frightened: COND + "TBSHQspnbcqxsmjL",
  grabbed: COND + "kWc1fhmv9LBiTuei",
  immobilized: COND + "eIcWbB5o3pP6OIMe",
  offGuard: COND + "AJh5ex99aV6VTggg",
  paralyzed: COND + "6uEgoh53GbXuHpTF",
  persistent: COND + "lDVqvLKA6eF3Df60",
  prone: COND + "j91X7x0XSomq8d60",
  quickened: COND + "nlCjDvLMf2EkV2dl",
  restrained: COND + "VcDeM8A5oI6VqhbM",
  sickened: COND + "fesd1n5eVhpCSS18",
  slowed: COND + "xYTAsEpcJE1Ccni3",
  stunned: COND + "dfCMdR4wnpbYNTix",
  stupefied: COND + "e1XGnhKNSQIm5IXg",
  unconscious: COND + "fBnFDH2MTzgFijKf",
};

export const EFFECT = {
  heroism: "Compendium.pf2e.spell-effects.Item.l9HRQggofFGIxEse",       // Spell Effect: Heroism
  soothingWords: "Compendium.pf2e.spell-effects.Item.an4yZ6dyIDOFa1wa", // Spell Effect: Soothing Words
  rage: "Compendium.pf2e.feat-effects.Item.z3uyCMBddrPK5umr",           // Effect: Rage
};

export const DEGREES = ["criticalFailure", "failure", "success", "criticalSuccess"];
export const DEGREE_RU = ["критический провал", "провал", "успех", "критический успех"];

const DC_BY_LEVEL = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];
export const levelDC = (lvl) => DC_BY_LEVEL[Math.clamp(Math.round(lvl), 0, 25)];
export const spellRank = (lvl) => Math.clamp(Math.ceil(lvl / 2), 1, 10);

// Длительности эффектов
export const UNLIMITED = { value: -1, unit: "unlimited", expiry: null, sustained: false };
export const rounds = (n, expiry = "turn-start") => ({ value: n, unit: "rounds", expiry, sustained: false });
export const minutes = (n) => ({ value: n, unit: "minutes", expiry: "turn-start", sustained: false });
export const hours = (n) => ({ value: n, unit: "hours", expiry: "turn-start", sustained: false });
export const days = (n) => ({ value: n, unit: "days", expiry: "turn-start", sustained: false });

// Разное
export const uniq = (actors) => [...new Map(actors.filter(Boolean).map((a) => [a.uuid, a])).values()];
export const addItem = (actor, source) => actor.createEmbeddedDocuments("Item", [source]);
export const selectedActors = () => uniq(canvas.tokens.controlled.map((t) => t.actor));
export const gmIds = () => ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
export const whisperGM = (html) => ChatMessage.create({ content: html, whisper: gmIds() });
export const tokenOf = (actor) => actor?.getActiveTokens?.(false, false)?.[0] ?? null;
export const sceneOf = (actor) => actor?.getActiveTokens?.(false, true)?.[0]?.parent ?? canvas.scene;
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const rollDie = async (faces) => (await new Roll(`1d${faces}`).evaluate()).total;

// Правило «выдать состояние, пока висит эффект». value — для состояний со значением.
// lock — состояние нельзя снять вручную, пока эффект не кончится.
export function grant(uuid, { value = null, lock = false } = {}) {
  const rule = { key: "GrantItem", uuid };
  if (value) rule.alterations = [{ mode: "override", property: "badge-value", value }];
  if (lock) rule.onDeleteActions = { grantee: "restrict" };
  return rule;
}

export const status = (selector, value, label, predicate) => ({
  key: "FlatModifier", selector, type: "status", value, label, ...(predicate ? { predicate } : {}),
});

// Исходник эффекта
export function makeEffect({ name, img = "icons/svg/aura.svg", slug = null, desc = "", duration = UNLIMITED, rules = [], flags = {}, badge = null, level = 1 }) {
  return {
    type: "effect",
    name,
    img,
    flags,
    system: {
      slug,
      level: { value: level },
      description: { value: desc },
      duration,
      tokenIcon: { show: true },
      badge,
      rules,
    },
  };
}

// Состояние со значением: поднять до value, если сейчас меньше (не складывать)
export async function setConditionAtLeast(actor, slug, value = 1) {
  const existing = actor.itemTypes.condition.find((c) => c.slug === slug && !c.isLocked);
  if (existing) {
    const current = existing._source.system.value.value;
    if (current !== null && current < value) await existing.update({ "system.value.value": value });
    return;
  }
  await actor.increaseCondition(slug, { value });
}

// Продолжительный урон (обычное состояние PF2e, снимается чистой проверкой)
export async function addPersistent(actor, damageType, formula, dc = 15) {
  const source = game.pf2e.ConditionManager.getCondition("persistent-damage").toObject();
  source.system.persistent = { formula: String(formula), damageType, dc, criticalHit: false };
  await addItem(actor, source);
}

// Бросок урона в чат и применение к актёру (с учётом сопротивлений и слабостей).
// multiplier: 0.5 — половина, 2 — двойной.
export async function dealDamage(actor, formula, { multiplier = 1, flavor = "" } = {}) {
  const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === "DamageRoll");
  const roll = await new DamageRoll(formula).evaluate();
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: `${flavor}${flavor ? " · " : ""}урон применён автоматически${multiplier !== 1 ? ` (×${multiplier})` : ""}` });
  let damage = roll;
  if (multiplier !== 1) {
    try {
      damage = roll.alter(multiplier, 0);
    } catch {
      damage = Math.floor(roll.total * multiplier);
    }
  }
  await actor.applyDamage({ damage, token: tokenOf(actor)?.document ?? null });
  return Math.floor(roll.total * multiplier);
}

export async function fromCompendium(uuid, patch = {}) {
  const source = (await fromUuid(uuid))?.toObject();
  if (!source) return null;
  return foundry.utils.mergeObject(source, patch);
}

// Расстояние между токенами в футах
export function feetBetween(a, b) {
  if (!a || !b) return Infinity;
  if (typeof a.distanceTo === "function") return a.distanceTo(b);
  return canvas.grid.measurePath([a.center, b.center]).distance;
}
