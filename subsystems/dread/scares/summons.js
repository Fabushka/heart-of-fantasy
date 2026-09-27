// Существа из Испугов. Карточка предлагает ГМ кнопку «Призвать»; существо берётся из
// Monster Core PF2e под уровень партии, встаёт рядом с партией и сразу бросает инициативу.
// Когда Испуги кончаются, призванные растворяются.
import { ID } from "../../../core/settings.js";
import { registerChatAction } from "../../../core/chat.js";
import { pick, uniq } from "../../../core/pf2e.js";

const MC = "Compendium.pf2e.pathfinder-monster-core.Actor.";

// Уровни — по Monster Core
export const GROUPS = {
  dead: {
    label: "мертвецы",
    list: [
      [-1, "Скелет-страж", "trchDxbDR2TiPMxT"], [-1, "Зомби-шатун", "Xo4IGzw28hivgMmM"], [-1, "Ползучая рука", "KH1GkazaI59zftst"],
      [1, "Гуль-охотник", "iLkQt8A99nQWUI8k"], [2, "Скелет-чемпион", "FH58AcRBZIfrHKvv"], [2, "Зомби-громила", "WioQ6rOeMRuTOliY"],
      [3, "Скелет-великан", "sEgjgitJmwYYa4mV"], [3, "Умертвие", "DBTbqI9QQRtlJwWh"], [5, "Гигантская ползучая рука", "TlDmc2ZKeIAJuD5v"],
      [6, "Зомби-исполин", "EDYKUdYmilw3rgJg"], [6, "Мумия-страж", "XZWUQklzWF6YFPmG"], [7, "Костяной исполин", "V4rVnbjJbcOIdC4Z"],
      [7, "Дуллахан", "GNwLVbfFx8EPz7xO"], [10, "Рыцарь могилы", "MCgSMT680ic6kr5k"],
    ],
  },
  shadows: {
    label: "тени",
    list: [[4, "Тень", "VotlWUsFKdOrHWF6"], [4, "Порождение тени", "clzHAfegb9Rn6DOe"], [7, "Великая тень", "5meW7DytYnF7Iq2V"]],
    fallback: "dead",
  },
  ghosts: {
    label: "призраки",
    list: [
      [4, "Призрак простолюдина", "N98ug9jQHqeFoK1N"], [4, "Фантомный рыцарь", "9VMoTqyVaKc4ZR4H"], [5, "Полтергейст", "zpd6b6UPP72ZELCj"],
      [6, "Рейф", "Gu0cJHGwPd547OtC"], [8, "Фантомный зверь", "YAGc6gQ5VrvWyR37"], [10, "Призрак мага", "LN7MXD38Zs2bDoW6"],
      [15, "Диббук", "IrssIkWkW6fsbHJL"], [17, "Баньши", "XKOQ3ll9TGNso0uB"],
    ],
    fallback: "dead",
  },
};

// Лучшее существо не выше уровня партии −1; два, если оно слабее партии на 4+
export function pickSummon(groupKey, partyLevel) {
  const group = GROUPS[groupKey];
  const fit = group.list.filter(([lvl]) => lvl <= partyLevel - 1);
  if (!fit.length) {
    const weakest = group.list[0];
    if (weakest[0] <= partyLevel + 1) return { level: weakest[0], name: weakest[1], uuid: MC + weakest[2], count: 1 };
    return group.fallback ? pickSummon(group.fallback, partyLevel) : null;
  }
  const top = Math.max(...fit.map(([l]) => l));
  const [level, name, id] = pick(fit.filter(([l]) => l === top));
  return { level, name, uuid: MC + id, count: level <= partyLevel - 4 ? 2 : 1 };
}

export function summonButton(choice) {
  if (!choice) return "";
  return `<button type="button" class="hof-button" data-hof-action="dread-summon" data-hof-key="summon" data-gm-only
    data-uuid="${choice.uuid}" data-count="${choice.count}">Призвать: ${choice.name} (ур. ${choice.level})${choice.count > 1 ? ` ×${choice.count}` : ""}</button>`;
}

async function worldActor(uuid) {
  const existing = game.actors.find((a) => a.getFlag(ID, "summonSource") === uuid);
  if (existing) return existing;
  const source = (await fromUuid(uuid))?.toObject();
  if (!source) throw new Error("Существо не найдено в компендиуме Monster Core");
  let folder = game.folders.find((f) => f.type === "Actor" && f.getFlag(ID, "summons"));
  folder ??= await getDocumentClass("Folder").create({ name: "Сердце Фантазии — Испуги", type: "Actor", flags: { [ID]: { summons: true } } });
  source.folder = folder.id;
  source.flags = foundry.utils.mergeObject(source.flags ?? {}, { [ID]: { summonSource: uuid } });
  return getDocumentClass("Actor").create(source);
}

// Свободная клетка в 2–4 клетках от случайного персонажа
function spotNear(scene, party) {
  const size = scene.grid.size;
  const anchors = party.map((a) => a.getActiveTokens(false, true).find((t) => t.parent === scene)).filter(Boolean);
  const anchor = pick(anchors.length ? anchors : scene.tokens.contents);
  const taken = new Set(scene.tokens.map((t) => `${Math.round(t.x / size)}:${Math.round(t.y / size)}`));
  const ax = Math.round((anchor?.x ?? 0) / size), ay = Math.round((anchor?.y ?? 0) / size);
  for (let r = 2; r <= 5; r++) {
    const ring = [];
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([ax + dx, ay + dy]);
    }
    const free = ring.filter(([x, y]) => x >= 0 && y >= 0 && !taken.has(`${x}:${y}`));
    if (free.length) {
      const [x, y] = pick(free);
      taken.add(`${x}:${y}`);
      return { x: x * size, y: y * size };
    }
  }
  return { x: anchor?.x ?? 0, y: anchor?.y ?? 0 };
}

export async function summon(uuid, count, party) {
  const scene = canvas.scene;
  if (!scene) throw new Error("Нет активной сцены");
  const actor = await worldActor(uuid);
  const created = [];
  for (let i = 0; i < count; i++) {
    const pos = spotNear(scene, party);
    const td = await actor.getTokenDocument({ ...pos, hidden: false });
    const data = td.toObject();
    data.flags = foundry.utils.mergeObject(data.flags ?? {}, { [ID]: { scareSummon: true } });
    const [tok] = await scene.createEmbeddedDocuments("Token", [data]);
    created.push(tok);
  }
  const combat = game.combat;
  if (combat && combat.scene?.id === scene.id) {
    const combatants = await combat.createEmbeddedDocuments("Combatant", created.map((t) => ({ tokenId: t.id, sceneId: scene.id, actorId: t.actorId })));
    await combat.rollInitiative(combatants.map((c) => c.id), { skipDialog: true });
  }
  return created;
}

export async function dismissSummons(scene) {
  if (!scene) return 0;
  const ids = scene.tokens.filter((t) => t.getFlag(ID, "scareSummon")).map((t) => t.id);
  if (ids.length) await scene.deleteEmbeddedDocuments("Token", ids);
  return ids.length;
}

export function registerSummonAction(getParty) {
  registerChatAction("dread-summon", async ({ data }) => {
    const party = uniq(getParty(canvas.scene));
    const tokens = await summon(data.uuid, Number(data.count) || 1, party);
    await ChatMessage.create({
      content: `<div class="hof-card hof-result"><p><i>Из темноты выходит ${tokens.map((t) => t.name).join(", ")}.</i></p></div>`,
    });
  });
}
