// Точка входа модуля «Сердце Фантазии — инструменты ГМ».
// Каждая подсистема живёт в subsystems/<имя>/ и отдаёт объект:
// { id, title, registerSettings(), enabled(), start(), macros: [...], api: {...} }.
// Новая подсистема = новая папка + одна строка в SUBSYSTEMS.
import { ID } from "./settings.js";
import { ensureMacros } from "./macros.js";
import { initChat } from "./chat.js";
import dread from "../subsystems/dread/index.js";

const SUBSYSTEMS = [dread];

Hooks.once("init", () => {
  const api = {};
  for (const s of SUBSYSTEMS) {
    s.registerSettings?.();
    api[s.id] = s.api;
  }
  game.modules.get(ID).api = api;
  initChat();
});

Hooks.once("ready", async () => {
  for (const s of SUBSYSTEMS) {
    if (s.enabled?.() === false) continue;
    try {
      await s.start?.();
    } catch (err) {
      console.error(`${ID} | подсистема ${s.id} не запустилась`, err);
    }
  }
  if (game.user === game.users.activeGM) await ensureMacros(SUBSYSTEMS.flatMap((s) => s.macros ?? []));
  console.log(`${ID} | готов: ${SUBSYSTEMS.map((s) => s.title).join(", ")}`);
});
