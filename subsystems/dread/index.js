// Подсистема «Ужас» (Horror Mode из Adventures+, стр. 73–76) с домашними Срывами и Испугами.
import { apiCall } from "../../core/macros.js";
import { registerDreadSettings, S } from "./settings.js";
import { IMMUNITY_SLUG, getDread, dreadValue, partyInZone, migrateDread } from "./state.js";
import { onMessage, onCombatUpdate, applyDread, rollCalm } from "./growth.js";
import { meltdown, meltdownSelected, onImmunityGone } from "./meltdown.js";
import { triggerScare, dreadCheck, endScares, onCombatStart, TABLES } from "./scares/engine.js";
import { registerSummonAction } from "./scares/summons.js";
import { manage, enterZone, leaveZone, lowerDread } from "./manage.js";

let started = false;

export default {
  id: "dread",
  title: "Ужас",

  registerSettings() {
    registerDreadSettings();
    registerSummonAction(partyInZone);
  },

  enabled: () => S.enabled(),

  async start() {
    if (started) return;
    started = true;
    Hooks.on("createChatMessage", onMessage);
    Hooks.on("updateCombat", onCombatUpdate);
    Hooks.on("combatStart", onCombatStart);
    Hooks.on("deleteItem", (item) => {
      if (item.slug === IMMUNITY_SLUG && item.parent) onImmunityGone(item.parent);
    });
    if (game.user === game.users.activeGM) await migrateDread();
  },

  macros: [
    { key: "dread-manage", name: "Ужас — управление", img: "icons/svg/terror.svg", command: `${apiCall("dread.manage")}();`, players: false },
    { key: "dread-meltdown", name: "Срыв", img: "icons/svg/skull.svg", command: `${apiCall("dread.meltdownSelected")}();`, players: false },
    { key: "dread-stifle", name: "Подавить ужас", img: "icons/svg/daze.svg", command: `${apiCall("dread.stifle")}(actor);`, players: true },
    { key: "dread-panic", name: "Предотвратить панику", img: "icons/svg/heal.svg", command: `${apiCall("dread.panic")}(actor);`, players: true },
  ],

  // game.modules.get("heart-of-fantasy").api.dread
  api: {
    manage,
    stifle: (actor) => rollCalm(actor, "stifle"),
    panic: (actor) => rollCalm(actor, "panic"),
    meltdown,
    meltdownSelected,
    enterZone,
    leaveZone,
    addDread: (actors, reason = "Ужас нарастает") => applyDread([actors].flat().filter((a) => getDread(a)), reason, null),
    lowerDread,
    triggerScare,
    dreadCheck,
    endScares,
    getDread,
    dreadValue,
    partyInZone,
    tables: TABLES,
  },
};
