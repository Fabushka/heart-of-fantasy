// Работа с RollTable: найти по префиксу имени, вытянуть результат без возврата, взять следующий по номеру.
// Тянем сами, а не через table.draw(): так бросок не попадает в чат и не зависит от версии ядра.

const rnd = (n) => Math.floor((CONFIG.Dice?.randomUniform?.() ?? Math.random()) * n);
export const d = (faces) => rnd(faces) + 1;

// «LES-Б · Лес и джунгли, бой» находится по «LES-Б».
export function findTable(prefix) {
  const p = prefix.toUpperCase();
  return game.tables.find((t) => {
    const n = t.name.trim().toUpperCase();
    return n === p || n.startsWith(`${p} `) || n.startsWith(`${p}·`);
  }) ?? null;
}

const lo = (r) => r.range?.[0] ?? 0;
const sorted = (table) => [...table.results].sort((a, b) => lo(a) - lo(b));

// Имя и ссылка результата: V14 (name, documentUuid) и V13 (text, documentCollection + documentId).
export function describe(result) {
  const name = result.name || result.text || "без названия";
  let uuid = result.documentUuid ?? null;
  if (!uuid && result.documentCollection && result.documentId) uuid = `${result.documentCollection}.${result.documentId}`;
  const desc = result.description || "";
  return { name, uuid, desc };
}

const mark = (table, id, drawn) => table.updateEmbeddedDocuments("TableResult", [{ _id: id, drawn }]);

// Случайный из невыпавших. null — таблица исчерпана.
export async function drawFrom(table) {
  const free = sorted(table).filter((r) => !r.drawn);
  if (!free.length) return null;
  const result = free[rnd(free.length)];
  await mark(table, result.id, true);
  return result;
}

// Условие записи не выполнено: возвращаем её в таблицу и берём следующую по номеру, с переходом через край.
export async function nextByNumber(table, resultId) {
  const all = sorted(table);
  const i = all.findIndex((r) => r.id === resultId);
  if (i < 0) return null;
  for (let step = 1; step < all.length; step++) {
    const cand = all[(i + step) % all.length];
    if (cand.drawn) continue;
    await mark(table, resultId, false);
    await mark(table, cand.id, true);
    return cand;
  }
  return null;
}

export const freeCount = (table) => table.results.filter((r) => !r.drawn).length;
