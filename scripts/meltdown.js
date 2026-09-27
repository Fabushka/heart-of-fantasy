// Срыв — что случается, когда Ужас достигает предела.
import { setting } from "./settings.js";
import { UUID, rounds, getDread, setDread, checkScareEnd, sceneOf, addItem } from "./common.js";

const R2 = rounds(2);

// ---------- Визуал: Cinematic Cut-ins ----------
// Порядок поиска: личный пресет персонажа → глобальный пресет → заготовка из кода.
// Чтобы заменить заготовку своим кадром, создайте в Cinematic Cut-ins пресет с именем из поля preset.
export const VISUAL = {
  fear: { title: "СТРАХ", preset: "Срыв: Страх", theme: "phantom" },
  apathy: { title: "АПАТИЯ", preset: "Срыв: Апатия", theme: "eclipse" },
  rage: { title: "ЯРОСТЬ", preset: "Срыв: Ярость", theme: "impact" },
  heroism: { title: "ГЕРОИЗМ", preset: "Срыв: Героизм", theme: "royal" },
};
const VISUAL_SECONDS = 3.5;

async function showVisual(kind, victim, subText) {
  if (!setting("meltdownVisual")) return;
  const mod = game.modules.get("cinematic-cut-ins");
  const api = mod?.active ? mod.api : null;
  if (!api) return;
  const v = VISUAL[kind];
  try {
    const own = ((await api.getActorPresets?.(victim)) ?? []).find((p) => p?.name === v.preset);
    if (own) return await api.play({ ...(own.data ?? own), actorId: victim.uuid });
    const global = await api.getGlobalPreset?.(v.preset);
    if (global) return await api.play({ ...(global.data ?? global), actorId: victim.uuid, characterImageSource: "actor" });
  } catch (err) {
    console.warn("heart-of-fantasy | пресет Cinematic Cut-ins не запустился, показываю заготовку", err);
  }
  await api.play({
    theme: v.theme,
    format: "popout",
    text: v.title,
    subText,
    img: victim.img,
    actorId: victim.uuid,
    characterImageSource: "actor",
    customDuration: VISUAL_SECONDS,
  });
}

const grantLocked = (uuid) => ({ key: "GrantItem", uuid, onDeleteActions: { grantee: "restrict" } });
const effect = (name, img, rules) => ({
  type: "effect",
  name,
  img,
  system: { description: { value: "<p>Срыв в зоне ужаса.</p>" }, duration: R2, tokenIcon: { show: true }, rules },
});
const fromCompendium = async (uuid, duration) => {
  const src = (await fromUuid(uuid))?.toObject();
  if (src && duration) src.system.duration = duration;
  return src;
};

// Положительный исход «Героизм»: 1d5
const BUFFS = [
  {
    label: "<i>героизм</i> 3-го ранга на 2 раунда",
    apply: async (a) => { const s = await fromCompendium(UUID.heroism, R2); if (s) await addItem(a, s); },
  },
  {
    label: "ускорен на 2 раунда",
    apply: (a) => addItem(a, effect("Срыв: Героизм — ускорение", "icons/svg/wingfoot.svg", [grantLocked(UUID.quickened)])),
  },
  {
    label: "сопротивление всему урону 5 на 2 раунда",
    apply: (a) => addItem(a, effect("Срыв: Героизм — стойкость", "icons/svg/shield.svg", [
      { key: "Resistance", type: "all-damage", value: 5 },
    ])),
  },
  {
    label: "16 временных ОЗ на 2 раунда",
    apply: (a) => addItem(a, effect("Срыв: Героизм — второе дыхание", "icons/svg/regen.svg", [
      { key: "TempHP", value: 16 },
    ])),
  },
  {
    label: "эффект <i>верного удара</i>",
    apply: async (a) => { const s = await fromCompendium(UUID.sureStrike); if (s) await addItem(a, s); },
  },
];

export async function meltdown(victim) {
  const roll = await new Roll("1d4").evaluate();
  let kind, text, sub;
  switch (roll.total) {
    case 1:
      kind = "fear";
      await addItem(victim, effect("Срыв: Страх", "icons/svg/terror.svg", [grantLocked(UUID.fleeing)]));
      text = "<b>Страх.</b> Убегает 2 раунда.";
      sub = `${victim.name} бежит`;
      break;
    case 2:
      kind = "apathy";
      await addItem(victim, effect("Срыв: Апатия", "icons/svg/sleep.svg", [grantLocked(UUID.fascinated), grantLocked(UUID.immobilized)]));
      text = "<b>Апатия.</b> Заворожён и обездвижен 2 раунда.";
      sub = `${victim.name} застывает`;
      break;
    case 3:
      kind = "rage";
      await victim.toggleCondition("confused", { active: true });
      text = "<b>Ярость.</b> В замешательстве. Снять: чистая проверка DC 11 при получении урона.";
      sub = `${victim.name} теряет рассудок`;
      break;
    default: {
      kind = "heroism";
      if (getDread(victim)) await setDread(victim, 1);
      const b = (await new Roll("1d5").evaluate()).total;
      await BUFFS[b - 1].apply(victim);
      text = `<b>Героизм.</b> Ужас падает до 1. Бафф (1d5 = ${b}): ${BUFFS[b - 1].label}.`;
      sub = `${victim.name} встречает страх лицом`;
    }
  }
  await showVisual(kind, victim, sub);
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: victim }),
    flavor: `<h3>Срыв: ${victim.name}</h3><p>${text}</p>`,
  });
  if (kind === "heroism") await checkScareEnd(sceneOf(victim));
}
