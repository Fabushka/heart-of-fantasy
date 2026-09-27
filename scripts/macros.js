// Кнопки для хотбара. Модуль сам создаёт их в папке макросов «Сердце Фантазии»
// и держит в актуальном виде. Макросы — тонкие обёртки: вся логика живёт в модуле.
import { ID } from "./settings.js";

const api = `game.modules.get("${ID}")?.api`;
const MACROS = [
  { key: "dread-manage", name: "Ужас — управление", img: "icons/svg/terror.svg", command: `${api}.dread.manage();`, players: false },
  { key: "dread-meltdown", name: "Срыв", img: "icons/svg/skull.svg", command: `${api}.dread.meltdownSelected();`, players: false },
  { key: "dread-stifle", name: "Подавить ужас", img: "icons/svg/daze.svg", command: `${api}.dread.stifle(actor);`, players: true },
  { key: "dread-panic", name: "Предотвратить панику", img: "icons/svg/heal.svg", command: `${api}.dread.panic(actor);`, players: true },
];

export async function ensureMacros() {
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
  for (const m of MACROS) {
    const existing = game.macros.find((x) => x.getFlag(ID, "key") === m.key);
    if (existing) {
      if (existing.command !== m.command) await existing.update({ command: m.command });
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
