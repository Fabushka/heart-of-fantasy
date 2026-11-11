// Пульт гекс-исследования: «Новый день», «Вошли в гекс», событие дня, статус таблиц.
// Всё, что пульт сообщает, уходит шёпотом ГМ. Игрокам он не пишет ничего.
import { gmIds } from "../../core/pf2e.js";
import { registerChatAction } from "../../core/chat.js";
import {
  BIOMES, BIOME_TYPES, DAY_SLOTS, DAY_TYPES, QUEUE,
  normCoord, aureoleAt, storyAt, slotLabel,
} from "./data.js";
import { d, findTable, describe, drawFrom, nextByNumber, freeCount } from "./tables.js";
import { getState, saveState, resetState, logLine, nextQueued, queueDue, todayText } from "./state.js";

const DialogV2 = () => foundry.applications.api.DialogV2;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const link = (uuid, label) => (uuid ? `@UUID[${uuid}]{${label}}` : `<b>${esc(label)}</b>`);

async function card(title, kicker, body) {
  const html = `<div class="hof-card hof-hex"><header><div><span class="hof-kicker">${esc(kicker)}</span><h3>${esc(title)}</h3></div></header>${body}</div>`;
  const content = (await game.pf2e?.TextEditor?.enrichHTML?.(html)) ?? html;
  return ChatMessage.create({ content, whisper: gmIds(), speaker: { alias: "Пульт" } });
}

const select = (name, options, value) =>
  `<select name="${name}">${options.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${l}</option>`).join("")}</select>`;

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

const choose = (title, content, buttons) =>
  DialogV2().wait({ window: { title }, content, buttons: buttons.map(([action, label], i) => ({ action, label, default: i === 0 })), rejectClose: false });

// Запись журнала с кодом в названии («ВНЕ-03 …», «Г-17 …»): сам журнал или его страница.
function findDoc(code) {
  const c = code.toUpperCase();
  for (const j of game.journal) {
    if (j.name.toUpperCase().includes(c)) return j.uuid;
    const page = j.pages.find((p) => p.name.toUpperCase().startsWith(c));
    if (page) return page.uuid;
  }
  return null;
}

// Кнопка под вытянутой записью: условие не выполнено — следующая по номеру.
const nextButton = (tableId, resultId, scope) =>
  `<p><button type="button" class="hof-button" data-hof-action="hex-next" data-gm-only data-table="${tableId}" data-result="${resultId}" data-scope="${scope}">Условие не выполнено — следующая по номеру</button></p>`;

function resultBody(result, table, scope) {
  const r = describe(result);
  return `<p>${link(r.uuid, r.name)}</p>${r.desc}${r.uuid ? "" : `<p><i>Запись не привязана к журналу.</i></p>`}` +
    `<p class="hof-muted">Таблица «${esc(table.name)}», осталось ${freeCount(table)}.</p>` + nextButton(table.id, result.id, scope);
}

// ---------- Новый день ----------

async function rollDayEvent(st) {
  const slot = DAY_SLOTS[d(4) - 1];
  const type = DAY_TYPES[d(4) - 1];
  const prefix = `${slot.key}-${type.letter}`;
  const table = findTable(prefix);
  const head = `${slot.label}, ${type.label}`;
  if (!table) {
    const n = d(slot.die);
    st.today = { day: st.day, kind: "day", slot: slot.key, label: `${prefix}${n} (${type.label})`, done: false };
    logLine(st, `Событие дня: ${head} — ${prefix}${n}, таблицы нет, бросок d${slot.die}.`);
    await card(`День ${st.day}`, "событие дня", `<p><b>${head}</b> — запись <b>${prefix}${n}</b>.</p><p><i>Таблицы «${prefix}» в мире нет, номер брошен кубиком d${slot.die}. Проверь по списку, не выпадала ли она раньше.</i></p>`);
    return;
  }
  const result = await drawFrom(table);
  if (!result) {
    st.today = { day: st.day, kind: "day", slot: slot.key, label: `${prefix}: таблица исчерпана`, done: false };
    logLine(st, `Событие дня: ${head} — таблица ${prefix} исчерпана.`);
    await card(`День ${st.day}`, "событие дня", `<p><b>${head}</b>, но в таблице «${esc(table.name)}» не осталось записей. Выбери событие рукой или сбрось таблицу.</p>`);
    return;
  }
  const r = describe(result);
  st.today = { day: st.day, kind: "day", slot: slot.key, label: r.name, uuid: r.uuid, tableId: table.id, resultId: result.id, done: false };
  logLine(st, `Событие дня: ${head} — ${r.name}.`);
  await card(`День ${st.day}`, `событие дня · ${head}`, resultBody(result, table, "day"));
}

export async function newDay() {
  const st = getState();
  const prev = st.today;
  if (prev && !prev.done && prev.kind === "day") {
    const what = await choose("Вчерашнее событие не сыграно",
      `<p>День ${st.day}: <b>${esc(todayText(st))}</b>.</p><p>Перенести его на новый день или сбросить?</p>`,
      [["carry", "Перенести"], ["drop", "Сбросить"], ["cancel", "Отмена"]]);
    if (!what || what === "cancel") return;
    if (what === "carry") {
      st.day += 1;
      st.today = { ...prev, day: st.day };
      logLine(st, `Событие дня перенесено со вчера: ${prev.label}.`);
      await saveState(st);
      await card(`День ${st.day}`, "событие дня перенесено", `<p>${link(prev.uuid, prev.label)} — ${slotLabel(prev.slot)}.</p>`);
      return;
    }
    logLine(st, `Событие дня сброшено: ${prev.label}.`);
  }
  st.day += 1;
  st.today = null;

  if (queueDue(st)) {
    const q = nextQueued(st);
    const what = await choose(`День ${st.day}: внеочередное`,
      `<p>По очереди идёт <b>${q.id} · ${esc(q.name)}</b> (${slotLabel(q.slot)}).</p><p><b>Условие:</b> ${esc(q.gate)}</p><p>Если условие сегодня невыполнимо, событие остаётся в очереди, а день получает обычный бросок.</p>`,
      [["play", "Ставлю на сегодня"], ["skip", "Условие не выполнено"], ["cancel", "Отмена"]]);
    if (!what || what === "cancel") return;
    if (what === "play") {
      const uuid = findDoc(q.id);
      st.today = { day: st.day, kind: "vne", slot: q.slot, label: `${q.id} · ${q.name}`, uuid, queueId: q.id, done: false };
      logLine(st, `Внеочередное на сегодня: ${q.id} ${q.name}, ${slotLabel(q.slot)}.`);
      await saveState(st);
      await card(`День ${st.day}`, `внеочередное · ${slotLabel(q.slot)}`,
        `<p>${link(uuid, `${q.id} · ${q.name}`)}</p><p><b>Условие:</b> ${esc(q.gate)}</p>${uuid ? "" : `<p><i>Журнала с «${q.id}» в названии в мире нет.</i></p>`}<p class="hof-muted">Очередь сдвинется, когда отметишь событие сыгранным.</p>`);
      return;
    }
    logLine(st, `${q.id} остаётся в очереди: условие не выполнено.`);
  }
  await rollDayEvent(st);
  await saveState(st);
}

// ---------- Событие дня ----------

export async function playToday() {
  const st = getState();
  const t = st.today;
  if (!t) return ui.notifications.warn("Пульт: событие дня не назначено. Нажми «Новый день».");
  if (t.done) return ui.notifications.info("Пульт: событие дня уже отмечено сыгранным.");
  t.done = true;
  if (t.kind === "vne" && QUEUE[st.queueIndex]?.id === t.queueId) st.queueIndex += 1;
  logLine(st, `Сыграно: ${t.label}.`);
  await saveState(st);
  ui.notifications.info(`Пульт: «${t.label}» сыграно.`);
}

export async function toggleHold() {
  const st = getState();
  st.hold = !st.hold;
  logLine(st, st.hold ? "Событие дня придержано (партия в подземелье)." : "Событие дня отпущено.");
  await saveState(st);
  ui.notifications.info(st.hold ? "Пульт: событие дня придержано до выхода." : "Пульт: событие дня снова в игре.");
}

// ---------- Вошли в гекс ----------

export async function enterHex() {
  const st = getState();
  const biomeOptions = [["auto", "по сюжетному гексу"], ["none", "без биомного броска"], ...Object.entries(BIOMES)];
  const form = await ask("Вошли в гекс",
    `<div class="form-group"><label>Координата</label><input type="text" name="coord" placeholder="например C10" autofocus></div>` +
    `<div class="form-group"><label>Биом</label>${select("biome", biomeOptions, "auto")}</div>` +
    `<div class="form-group"><label>Бросить биомное, даже если гекс уже посещён</label><input type="checkbox" name="force"></div>`,
    (el) => ({ coord: el.coord.value, biome: el.biome.value, force: el.force.checked }));
  if (!form || form === "cancel") return;

  const coord = normCoord(form.coord);
  if (coord === null) return ui.notifications.warn("Пульт: координата не распознана. Нужна буква A–H и номер, например C10.");
  const story = coord ? storyAt(coord) : [];
  const aura = coord ? aureoleAt(coord) : null;
  let biome = form.biome;
  if (biome === "auto") biome = story[0]?.biome ?? null;
  if (form.biome === "auto" && !biome && !(story.length && story[0].biome === null)) {
    return ui.notifications.warn("Пульт: для этого гекса биом не известен, выбери его в списке.");
  }
  if (biome === "none") biome = null;

  const seen = coord ? st.hexes[coord] : null;
  const events = [];
  let body = "";
  let rolled = false; // биомное считается брошенным, только если запись действительно вытянута

  if (aura) {
    body += `<p><b>${aura.id} · ${esc(aura.name)}</b> (вокруг ${aura.center})</p><blockquote>${esc(aura.text)}</blockquote><p class="hof-muted">${esc(aura.hint)}</p>`;
    events.push(`ореол ${aura.id}`);
  }
  for (const s of story) {
    const uuid = findDoc(s.id);
    body += `<p><b>Сюжетный гекс:</b> ${link(uuid, `${s.id} · ${s.name}`)}${uuid ? "" : " <i>(журнала нет)</i>"}</p>`;
    events.push(`${s.id} ${s.name}`);
  }

  if (!biome) body += `<p><i>Биомного броска нет.</i></p>`;
  else if (seen?.rolled && !form.force) body += `<p><i>Гекс уже посещён в день ${seen.day}: биомное не бросается.</i></p>`;
  else {
    const type = aura?.safe ? BIOME_TYPES[3] : BIOME_TYPES[d(4) - 1];
    const prefix = `${biome}-${type.letter}`;
    const table = findTable(prefix);
    body += `<p><b>Биомное:</b> ${esc(BIOMES[biome])}, ${type.label}${aura?.safe ? " (безопасное кольцо)" : ""}</p>`;
    if (!table) body += `<p><i>Таблицы «${prefix}» в мире нет.</i></p>`;
    else {
      const result = await drawFrom(table);
      if (!result) body += `<p><i>Таблица «${esc(table.name)}» исчерпана. Выбери запись рукой или сбрось таблицу.</i></p>`;
      else {
        body += resultBody(result, table, "hex");
        events.push(describe(result).name);
        rolled = true;
      }
    }
  }

  const t = st.today;
  if (t && !t.done) {
    body += `<hr><p><b>Событие дня ещё впереди:</b> ${slotLabel(t.slot)} — ${link(t.uuid, t.label)}${st.hold ? " <i>(придержано)</i>" : ""}</p>`;
  }

  if (coord) {
    st.hexes[coord] = {
      biome: biome ?? seen?.biome ?? null,
      day: seen?.day ?? st.day,
      visits: (seen?.visits ?? 0) + 1,
      rolled: rolled || !!seen?.rolled,
      events: [...(seen?.events ?? []), ...events],
    };
  }
  logLine(st, `Гекс ${coord || "без координаты"}: ${events.join("; ") || "без событий"}.`);
  await saveState(st);
  await card(coord ? `Гекс ${coord}` : "Гекс", `день ${st.day} · порядок: ореол → сюжетное → биомное`, body);
}

// ---------- Следующая по номеру ----------

async function onNext({ data }) {
  const table = game.tables.get(data.table);
  if (!table) throw new Error("таблица не найдена");
  const result = await nextByNumber(table, data.result);
  if (!result) {
    ui.notifications.warn("Пульт: в таблице больше нет свободных записей.");
    return false;
  }
  const r = describe(result);
  const st = getState();
  if (data.scope === "day" && st.today?.resultId === data.result) {
    st.today = { ...st.today, label: r.name, uuid: r.uuid, resultId: result.id };
  }
  logLine(st, `Условие не выполнено, взята следующая: ${r.name}.`);
  await saveState(st);
  await card("Замена", "следующая по номеру", resultBody(result, table, data.scope));
  return true;
}

// ---------- Статус таблиц ----------

export async function tableStatus() {
  const rows = [];
  const check = (prefix) => {
    const t = findTable(prefix);
    rows.push(`<tr><td>${prefix}</td><td>${t ? `${freeCount(t)} из ${t.results.size}` : "<i>нет</i>"}</td></tr>`);
  };
  for (const b of Object.keys(BIOMES)) for (const t of BIOME_TYPES) check(`${b}-${t.letter}`);
  for (const s of DAY_SLOTS) for (const t of DAY_TYPES) check(`${s.key}-${t.letter}`);
  await card("Таблицы", "свободных записей", `<table><tr><th>Таблица</th><th>Осталось</th></tr>${rows.join("")}</table>`);
}

// ---------- Пульт ----------

const ACTIONS = [
  ["enter", "Вошли в гекс"],
  ["day", "Новый день"],
  ["played", "Событие дня сыграно"],
  ["hold", "Придержать или отпустить событие дня (подземелье)"],
  ["tables", "Статус таблиц"],
  ["reset", "Сбросить поход (день, очередь, гексы)"],
];

export async function panel() {
  if (!game.user.isGM) return ui.notifications.warn("Пульт: только для ГМ.");
  const st = getState();
  const q = nextQueued(st);
  const action = await ask("Гекс-исследование",
    `<p><b>День ${st.day}.</b> Событие дня: ${esc(todayText(st))}</p>` +
    `<p><b>Очередь:</b> ${q ? `${q.id} · ${esc(q.name)}` : "пуста"} · <b>гексов пройдено:</b> ${Object.keys(st.hexes).length}</p>` +
    `<div class="form-group">${select("action", ACTIONS, "enter")}</div>`,
    (el) => el.action.value);
  if (!action || action === "cancel") return;
  switch (action) {
    case "enter": return enterHex();
    case "day": return newDay();
    case "played": return playToday();
    case "hold": return toggleHold();
    case "tables": return tableStatus();
    case "reset": {
      const sure = await choose("Сбросить поход", "<p>День, очередь внеочередных и список гексов обнулятся. Таблицы не трогаются: их сбрасывает кнопка Reset Results в самой таблице.</p>", [["cancel", "Отмена"], ["yes", "Сбросить"]]);
      if (sure === "yes") {
        await resetState();
        ui.notifications.info("Пульт: поход сброшен.");
      }
      return;
    }
  }
}

export function registerHexActions() {
  registerChatAction("hex-next", onNext);
}
