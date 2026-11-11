// Состояние похода: день, очередь внеочередных, событие дня, посещённые гексы, лента.
// Хранится в настройке мира (не в таблицах и не в журналах): это данные кампании, а не контент.
// Журнал «Журнал похода» — читаемая копия, модуль переписывает его после каждого действия.
import { ID } from "../../core/settings.js";
import { BIOMES, QUEUE, slotLabel } from "./data.js";

const KEY = "hexState";
const EMPTY = () => ({ day: 0, queueIndex: 0, hold: false, today: null, hexes: {}, log: [] });

export function registerHexState() {
  game.settings.register(ID, KEY, { scope: "world", config: false, type: Object, default: EMPTY() });
}

export const getState = () => foundry.utils.mergeObject(EMPTY(), foundry.utils.deepClone(game.settings.get(ID, KEY) ?? {}));

export async function saveState(st) {
  await game.settings.set(ID, KEY, st);
  try {
    await writeJournal(st);
  } catch (err) {
    console.warn(`${ID} | журнал похода не обновился`, err);
  }
}

export const resetState = () => saveState(EMPTY());

export function logLine(st, text) {
  st.log.push({ day: st.day, text });
}

export const nextQueued = (st) => QUEUE[st.queueIndex] ?? null;

// Первые четыре дня внеочередное идёт каждый день, дальше через день, пока очередь не кончится.
export const queueDue = (st) => !!nextQueued(st) && (st.day <= 4 || (st.day - 4) % 2 === 0);

export function todayText(st) {
  const t = st.today;
  if (!t) return "не назначено";
  const state = t.done ? "сыграно" : st.hold ? "придержано" : "ждёт";
  return `${slotLabel(t.slot)} — ${t.label} (${state})`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function journalHtml(st) {
  const days = new Map();
  for (const l of st.log) {
    if (!days.has(l.day)) days.set(l.day, []);
    days.get(l.day).push(l.text);
  }
  let html = `<p><em>Ведётся пультом гекс-исследования. Править руками бесполезно: страница переписывается после каждого действия.</em></p>`;
  html += `<p><strong>День ${st.day}.</strong> Событие дня: ${esc(todayText(st))}. Следующее внеочередное: ${esc(nextQueued(st)?.id ?? "очередь пуста")}.</p>`;
  html += `<h2>Гексы</h2>`;
  const hexes = Object.entries(st.hexes).sort((a, b) => a[1].day - b[1].day);
  if (!hexes.length) html += `<p>Пока ни одного.</p>`;
  else {
    html += `<table><tr><th>Гекс</th><th>Биом</th><th>День</th><th>Входов</th><th>Что было</th></tr>`;
    for (const [coord, h] of hexes) {
      html += `<tr><td>${esc(coord)}</td><td>${esc(BIOMES[h.biome] ?? "—")}</td><td>${h.day}</td><td>${h.visits}</td><td>${(h.events ?? []).map(esc).join("<br>")}</td></tr>`;
    }
    html += `</table>`;
  }
  html += `<h2>По дням</h2>`;
  for (const [day, lines] of [...days.entries()].sort((a, b) => b[0] - a[0])) {
    html += `<h3>День ${day}</h3><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  }
  return html;
}

async function writeJournal(st) {
  if (game.user !== game.users.activeGM) return;
  let entry = game.journal.find((j) => j.getFlag(ID, "hexLog"));
  const content = journalHtml(st);
  if (!entry) {
    await getDocumentClass("JournalEntry").create({
      name: "Журнал похода",
      flags: { [ID]: { hexLog: true } },
      pages: [{ name: "Глава 2", type: "text", text: { content, format: 1 } }],
    });
    return;
  }
  const page = entry.pages.contents[0];
  if (page) await page.update({ "text.content": content });
  else await entry.createEmbeddedDocuments("JournalEntryPage", [{ name: "Глава 2", type: "text", text: { content, format: 1 } }]);
}
