// Точка входа модуля «Сердце Фантазии — инструменты ГМ».
import { ID, registerSettings, setting } from "./settings.js";
import { ensureMacros } from "./macros.js";
import * as Dread from "./dread.js";

Hooks.once("init", () => {
  registerSettings();
  const module = game.modules.get(ID);
  module.api = { dread: Dread.api };
});

Hooks.once("ready", async () => {
  if (setting("dreadEnabled")) await Dread.start();
  if (game.user === game.users.activeGM) await ensureMacros();
  console.log(`${ID} | готов`);
});
