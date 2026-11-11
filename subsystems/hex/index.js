// Подсистема «Гекс-исследование»: пульт ГМ для Главы 2.
// Контент (таблицы и журналы) лежит в мире; подсистема находит его по именам и ведёт состояние похода.
import { apiCall } from "../../core/macros.js";
import { registerSetting, setting } from "../../core/settings.js";
import { registerHexState, getState, resetState } from "./state.js";
import { panel, newDay, enterHex, playToday, toggleHold, tableStatus, registerHexActions } from "./panel.js";

export default {
  id: "hex",
  title: "Гекс-исследование",

  registerSettings() {
    registerSetting("hexEnabled", {
      name: "Гекс-исследование: подсистема включена",
      hint: "Пульт ГМ: новый день, вход в гекс, событие дня. Меняется после перезагрузки.",
      type: Boolean,
      default: true,
      requiresReload: true,
    });
    registerHexState();
    registerHexActions();
  },

  enabled: () => setting("hexEnabled"),

  async start() {},

  macros: [
    { key: "hex-panel", name: "Гекс — пульт", img: "icons/svg/mountain.svg", command: `${apiCall("hex.panel")}();`, players: false },
    { key: "hex-enter", name: "Гекс — вошли в гекс", img: "icons/svg/direction.svg", command: `${apiCall("hex.enterHex")}();`, players: false },
    { key: "hex-day", name: "Гекс — новый день", img: "icons/svg/sun.svg", command: `${apiCall("hex.newDay")}();`, players: false },
  ],

  // game.modules.get("heart-of-fantasy").api.hex
  api: { panel, newDay, enterHex, playToday, toggleHold, tableStatus, getState, resetState },
};
