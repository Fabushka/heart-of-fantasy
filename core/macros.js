// Кнопки для хотбара. Каждая подсистема объявляет свои макросы, модуль создаёт их
// в папке «Сердце Фантазии» и держит в актуальном виде. Макрос — одна строка вызова API.
import { ID } from "./settings.js";

export const apiCall = (path) => `game.modules.get("${ID}")?.api.${path}`;

export async function ensureMacros(defs) {
  const { OBSERVER, NONE } = CONST.DOCUMENT_OWNERSHIP_LEVELS;
  let folder = game.folders.find((f) => f.type === "Macro" && f.getFlag(ID, "root"));
  if (!folder) {
    folder = await getDocumentClass("Folder").create({
      name: "Сердце Фантазии",
      type: "Macro",
      color: "#4a2560",
      flags: { [ID]: { root: true } },
    });
  }
  for (const m of defs) {
    const existing = game.macros.find((x) => x.getFlag(ID, "key") === m.key);
    if (existing) {
      const patch = {};
      if (existing.command !== m.command) patch.command = m.command;
      if (existing.img !== m.img) patch.img = m.img;
      if (Object.keys(patch).length) await existing.update(patch);
      continue;
    }
    await getDocumentClass("Macro").create({
      name: m.name,
      type: "script",
      img: m.img,
      command: m.command,
      folder: folder.id,
      ownership: { default: m.players ? OBSERVER : NONE },
      flags: { [ID]: { key: m.key } },
    });
  }
}
