// Диалог ГМ «Ужас — управление».
import { selectedActors, addItem } from "../../core/pf2e.js";
import { S } from "./settings.js";
import { getDread, dreadValue, dreadSource, setDread, partyInZone } from "./state.js";
import { applyDread } from "./growth.js";
import { meltdown } from "./meltdown.js";
import { MELTDOWNS } from "./meltdowns.js";
import { TABLES, triggerScare, dreadCheck, endScares, removeOwnScares, checkScareEnd } from "./scares/engine.js";

const DialogV2 = () => foundry.applications.api.DialogV2;

export async function enterZone(actors) {
  for (const a of actors) if (!getDread(a)) await addItem(a, dreadSource(1));
}

export async function leaveZone(actors) {
  for (const a of actors) {
    await getDread(a)?.delete();
    await removeOwnScares(a);
  }
  await checkScareEnd(canvas.scene);
}

export async function lowerDread(actors, n) {
  for (const a of actors) {
    const v = dreadValue(a);
    if (v > 1) await setDread(a, Math.max(1, v - n));
    else if (v) ui.notifications.info(`${a.name}: в зоне Ужас не опускается ниже 1.`);
  }
  await checkScareEnd(canvas.scene);
}

const select = (name, options) =>
  `<select name="${name}">${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select>`;

async function ask(title, content, read) {
  return DialogV2().wait({
    window: { title },
    content,
    buttons: [
      { action: "ok", label: "Выполнить", icon: "fa-solid fa-check", default: true, callback: (event, button) => read(button.form.elements) },
      { action: "cancel", label: "Отмена" },
    ],
    rejectClose: false,
  });
}

async function pickScare() {
  const inCombat = !!game.combat?.started;
  const table = (key) => TABLES[key].list.map((s, i) => [`${key}:${i + 1}`, `${i + 1}. ${s.name}`]);
  const res = await ask(
    "Испуг: выбрать",
    `<div class="form-group"><label>Испуг</label>${select("pick", [
      ["random", `Случайный (${inCombat ? "бой" : "исследование"})`],
      ["combat:random", "Случайный из таблицы боя"],
      ["exploration:random", "Случайный из таблицы исследования"],
      ...table("combat").map(([v, l]) => [v, `Бой — ${l}`]),
      ...table("exploration").map(([v, l]) => [v, `Исследование — ${l}`]),
    ])}</div>`,
    (el) => el.pick.value,
  );
  if (!res || res === "cancel") return null;
  if (res === "random") return {};
  const [t, n] = res.split(":");
  return { table: t, n: n === "random" ? null : Number(n) };
}

async function pickMeltdown() {
  const opts = [["random", "Случайный (1d5 и 1d3)"]];
  MELTDOWNS.forEach((m, i) => m.variants.forEach((v, j) => opts.push([`${i + 1}:${j + 1}`, `${m.name} — ${j + 1}: ${v.text.replace(/<[^>]+>/g, "").slice(0, 60)}…`])));
  const res = await ask("Срыв: выбрать", `<div class="form-group"><label>Срыв</label>${select("pick", opts)}</div>`, (el) => el.pick.value);
  if (!res || res === "cancel") return null;
  if (res === "random") return {};
  const [s, v] = res.split(":").map(Number);
  return { state: s, variant: v };
}

const ACTIONS = [
  ["enter", "Войти в зону (выделенные)"],
  ["plus", "+1 Ужас (выделенные)"],
  ["minus", "−1 Ужас (выделенные)"],
  ["flee", "Бегство весь ход: −2 (выделенные)"],
  ["leave", "Выйти из зоны (выделенные)"],
  ["meltdown", "Срыв (выделенные)"],
  ["meltdownPick", "Срыв: выбрать вариант (выделенные)"],
  ["check", "Проверка Ужаса: 10 минут исследования (партия в зоне)"],
  ["scare", "Испуг: выбрать (партия в зоне)"],
  ["clear", "Снять все Испуги"],
];
const NEED_SELECTED = new Set(["enter", "plus", "minus", "flee", "leave", "meltdown", "meltdownPick"]);

export async function manage() {
  if (!game.user.isGM) return ui.notifications.warn("Ужас: только для ГМ.");
  if (!S.enabled()) return ui.notifications.warn("Ужас выключен в настройках модуля.");
  const actors = selectedActors();
  const party = partyInZone(canvas.scene);
  const selected = actors.length ? actors.map((a) => `${a.name}: ${getDread(a)?.system.badge?.value ?? "вне зоны"}`).join("<br>") : "не выделены";
  const inZone = party.length ? party.map((a) => `${a.name} ${dreadValue(a)}`).join(", ") : "никого";

  const action = await ask(
    "Ужас",
    `<p><b>Выделены:</b><br>${selected}</p><p><b>В зоне на сцене:</b> ${inZone}</p>` +
      `<div class="form-group">${select("action", ACTIONS)}</div>`,
    (el) => el.action.value,
  );
  if (!action || action === "cancel") return;
  if (NEED_SELECTED.has(action) && !actors.length) return ui.notifications.warn("Ужас: выделите токены персонажей.");

  switch (action) {
    case "enter": return enterZone(actors);
    case "plus": return applyDread(actors.filter((a) => getDread(a)), "Ужас нарастает", null);
    case "minus": return lowerDread(actors, 1);
    case "flee": return lowerDread(actors, 2);
    case "leave": return leaveZone(actors);
    case "meltdown": for (const a of actors) await meltdown(a); return;
    case "meltdownPick": {
      const pick = await pickMeltdown();
      if (pick) for (const a of actors) await meltdown(a, pick);
      return;
    }
    case "check": return dreadCheck(party, canvas.scene, "10 минут исследования");
    case "scare": {
      const pick = await pickScare();
      if (pick) await triggerScare(party, canvas.scene, "вручную", { force: true, ...pick });
      return;
    }
    case "clear": return endScares(canvas.scene);
  }
}
