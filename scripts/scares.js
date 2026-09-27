// Испуги (Scare): таблица d20, карточки в чате, проверка Ужаса.
import { setting } from "./settings.js";
import {
  UUID, TAG, MIN10, rounds, dreadValue, gmIds, whisperGM, levelDC, halfLevelTimes, uniq, addItem,
  grant, penalty, persistent, scareEffect, partyInZone,
} from "./common.js";

// ---------- таблица Испугов (d20) ----------
// check(env) — общая проверка для всех целей (кнопки в чате); apply — что происходит с каждым.
export const SCARES = {
  1: {
    name: "Туман",
    text: "Неестественный туман: всё вокруг скрыто для тех, у кого есть Ужас. 10 минут.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Туман −${dv}`, { duration: MIN10, rules: [penalty("perception", dv, "Туман (только зрение)")] }));
      return `−${dv} к Внимательности на зрение`;
    },
    note: "Штраф — только к Внимательности на зрение: для проверок на слух снимите его в окне броска.",
  },
  2: {
    name: "Тошнота",
    text: "Смрад или внезапная дурнота.",
    check: (env) => `@Check[fortitude|dc:${env.dcStd}|name:Позывы (тошнота)]`,
    note: "Проверка — чтобы ослабить тошноту действием «позывы», по обычным правилам.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Тошнота ${dv}`, {
        rules: [grant(UUID.sickened, { alterations: [{ mode: "override", property: "badge-value", value: dv }] })],
      }));
      return `тошнота ${dv}`;
    },
  },
  3: {
    name: "Двери",
    text: "Все двери и проходы захлопываются или перекрываются.",
    check: (env) =>
      `@Check[athletics|dc:${env.dcStd}|name:Выбить дверь|options:${TAG.door},action:force-open] ` +
      `@Check[thievery|dc:${env.dcStd}|name:Вскрыть проход|options:${TAG.door},action:disable-device]`,
    note: "Штраф Ужаса учтётся сам.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Двери −${dv}`, {
        rules: [penalty(["athletics", "thievery"], dv, "Испуг: двери", [{ or: [TAG.door, "action:force-open", "action:disable-device"] }])],
      }));
      return `−${dv} к Атлетике и Воровству против преград`;
    },
  },
  4: {
    name: "Холод",
    text: "Воздух леденеет.",
    apply: async (a, dv) => {
      const w = halfLevelTimes(a, dv);
      await addItem(a, scareEffect(`Холод ${w}`, {
        rules: [{ key: "Weakness", type: "cold", value: w }, { key: "Weakness", type: "spirit", value: w }],
      }));
      return `слабость к холоду и духу ${w}`;
    },
  },
  5: {
    name: "Тьма",
    text: "Гаснет весь немагический свет; дальность магического света — вдвое меньше.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Тьма +${dv}`, { desc: `+${dv} к DC чистых проверок против скрытых целей.` }));
      return `+${dv} к DC чистых проверок против скрытых и спрятавшихся целей`;
    },
  },
  6: {
    name: "Тишина",
    text: "Жуткая тишина.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Тишина −${dv}`, {
        rules: [penalty("stealth", dv, "Тишина"), penalty("perception", dv, "Тишина (только слух)")],
      }));
      return `−${dv} к Скрытности и Внимательности на слух`;
    },
  },
  7: {
    name: "Паранойя",
    text: "Подозрение ко всем.",
    note: "Штраф к проверкам против союзников ГМ применяет вручную.",
    apply: async (a, dv) => {
      const confused = dv >= 4;
      await addItem(a, scareEffect(`Паранойя −${dv}`, {
        rules: confused ? [grant(UUID.confused)] : [],
        desc: `−${dv} к проверкам, нацеленным на союзников.`,
      }));
      return `−${dv} к проверкам против союзников${confused ? ", в замешательстве" : ""}`;
    },
  },
  8: {
    name: "Голос",
    text: "Бесплотный голос или странный звук. 10 минут.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Голос −${dv}`, {
        duration: MIN10, rules: [penalty("saving-throw", dv, "Голос", ["item:trait:mental"])],
      }));
      return `−${dv} к спасброскам против ментальных эффектов`;
    },
  },
  9: {
    name: "Обрыв",
    text: "Зыбкий пол: до 10 смежных клеток, где нужно Балансировать, иначе падение ничком. Для тех, у кого есть Ужас, опасность скрыта.",
    check: (env) =>
      `@Check[perception|dc:${env.dcStd}|name:Заметить обрыв|options:${TAG.ground}] ` +
      `@Check[acrobatics|dc:${env.dcStd}|name:Балансировать|options:${TAG.ground},action:balance]`,
    note: "ГМ отмечает клетки. Штраф Ужаса учтётся сам.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Обрыв −${dv}`, {
        rules: [penalty(["perception", "acrobatics"], dv, "Испуг: обрыв", [{ or: [TAG.ground, "action:balance"] }])],
      }));
      return `−${dv} к Внимательности и Акробатике у обрыва`;
    },
  },
  10: {
    name: "Иллюзии",
    text: "Тени и мороки. ГМ выбирает иллюзию ранга «половина уровня партии, округлить вверх» и проявляет её.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Иллюзии −${dv}`, {
        rules: [penalty(["perception", "will"], dv, "Иллюзии", ["item:trait:illusion"])],
        desc: "Длится, как выбранное заклинание — снимите вручную.",
      }));
      return `−${dv} к Внимательности и Воле против иллюзий`;
    },
  },
  11: {
    name: "Воскрешение",
    text: "Недавно убитый враг поблизости встаёт с половиной ОЗ.",
    note: "«Напуган» ГМ вешает, когда персонаж впервые увидит ожившего.",
    apply: async (a, dv) => `при виде ожившего — напуган ${dv}${dv >= 3 ? " и убегает, пока испуг не спадёт до 0" : ""}`,
  },
  12: {
    name: "Западня",
    text: "Провал в полу, завал или путы.",
    check: (env) => `@Check[fortitude|dc:${env.dcStd}|name:Западня|options:${TAG.trap}]`,
    note: "Провал — обездвижен, критический провал — схвачен. Высвобождение против того же DC. Штраф Ужаса и результат учтутся сами.",
    apply: async (a, dv, env) => {
      await addItem(a, scareEffect(`Западня −${dv} (ждёт спасброска)`, {
        rules: [penalty("fortitude", dv, "Испуг: западня", [TAG.trap])],
        flags: { heartScarePending: "trap", heartScareDv: dv, heartScareDc: env.dcStd },
      }));
      return `спасбросок со штрафом −${dv}`;
    },
  },
  13: {
    name: "Беспечность",
    text: "Ложное чувство безопасности.",
    note: "Неуклюжесть ГМ вешает при первом успешном попадании враждебного эффекта.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Беспечность ${dv}`, { desc: `При следующем попадании — неуклюжесть ${dv} на 1 раунд.` }));
      return `при следующем попадании — неуклюжесть ${dv} на 1 раунд`;
    },
  },
  14: {
    name: "Осколки",
    text: "Стекло, гвозди, острые обломки: до 10 смежных клеток опасной местности, скрытой для тех, у кого есть Ужас.",
    note: "ГМ отмечает клетки.",
    apply: async (a, dv) => `${halfLevelTimes(a, dv)} урона за каждое движение через опасную местность`,
  },
  15: {
    name: "Разум",
    text: "Это становится невыносимо.",
    apply: async (a, dv) => {
      const dmg = halfLevelTimes(a, dv);
      await addItem(a, scareEffect(`Разум ${dmg}`, { rules: [persistent("mental", dmg, 15 + dv)] }));
      return `${dmg} продолжительного ментального урона, проверка снятия DC ${15 + dv}`;
    },
  },
  16: {
    name: "Внезапность",
    text: "Что-то выскакивает из темноты.",
    apply: async (a, dv, env) => {
      if (env.inCombat) {
        await addItem(a, scareEffect(`Внезапность (${dv} р.)`, { duration: rounds(dv), rules: [grant(UUID.offGuard)] }));
        return `застигнут врасплох на ${dv} р.`;
      }
      await addItem(a, scareEffect(`Внезапность (${dv} р.)`, { desc: `Если бой начнётся до выхода из зоны — застигнут врасплох на ${dv} р.` }));
      return `застигнут врасплох на ${dv} р., если бой начнётся до выхода из зоны`;
    },
  },
  17: {
    name: "Смешение",
    text: "Свои и чужие — во сне не различить.",
    apply: async (a, dv) => {
      await addItem(a, scareEffect(`Смешение −${dv}`, {
        rules: [penalty("attack", dv, "Смешение (против врагов)")],
        desc: dv >= 4 ? "Не может целить существ враждебными эффектами; для фланга все — союзники." : "",
      }));
      return `−${dv} к атакам против врагов${dv >= 4 ? "; не может целить враждебными эффектами" : ""}`;
    },
  },
  18: {
    name: "Кровь",
    text: "Кровь течёт, порой без причины.",
    apply: async (a, dv) => {
      const dmg = halfLevelTimes(a, dv);
      await addItem(a, scareEffect(`Кровь ${dmg}`, { rules: [persistent("bleed", dmg, 15 + dv)] }));
      return `${dmg} продолжительного кровотечения, проверка снятия DC ${15 + dv}`;
    },
  },
  19: {
    name: "Поломка",
    text: "Сбой в худший момент. Каждый, кто держит предметы, проходит чистую проверку.",
    note: "При провале ломается один предмет в руках (выбирает ГМ); Починка — DC выше на Ужас.",
    apply: async (a, dv) => {
      const dc = 10 + dv;
      await addItem(a, scareEffect(`Поломка (ждёт проверки)`, { flags: { heartScarePending: "break", heartScareDv: dv } }));
      return `@Check[flat|dc:${dc}|name:Поломка — ${a.name}|options:${TAG.break}]`;
    },
  },
};

async function rollScareNumbers() {
  const d20 = async () => (await new Roll("1d20").evaluate()).total;
  const first = await d20();
  if (first !== 20) return [first];
  const picks = [];
  while (picks.length < 2) {
    const n = await d20();
    if (n !== 20 && !picks.includes(n)) picks.push(n);
  }
  return picks;
}

export function scareCooldownLeft() {
  const c = game.combat;
  if (!c?.started) return 0;
  const last = c.getFlag("world", "heartDreadScareRound");
  if (last == null) return 0;
  return Math.max(0, setting("dreadScareCooldown") - (c.round - last));
}

function scareCard(n, S, env, lines, twice) {
  const check = S.check ? `<p><strong>Проверка:</strong> ${S.check(env)}</p>` : "";
  const note = S.note ? `<p style="font-size:var(--font-size-12,12px);opacity:.8">${S.note}</p>` : "";
  return `
<div class="heart-dread-scare">
  <header style="display:flex;align-items:center;gap:8px;border-bottom:1px solid currentColor;padding-bottom:4px;margin-bottom:6px">
    <img src="icons/svg/hazard.svg" width="32" height="32" style="border:none;flex:0 0 32px">
    <div><strong style="font-size:var(--font-size-16,16px)">Испуг: ${S.name}</strong><br>
    <span style="font-size:var(--font-size-12,12px);opacity:.7">d20 = ${n}${twice ? " · выпало 20, два Испуга" : ""}</span></div>
  </header>
  <p><em>${S.text}</em></p>
  ${check}
  <p><strong>Цели:</strong><br>${lines.join("<br>")}</p>
  ${note}
</div>`;
}

export async function triggerScare(party, scene, reason = "", { force = false } = {}) {
  if (!party.length) return;
  const combat = game.combat?.started ? game.combat : null;
  const left = scareCooldownLeft();
  if (left && !force) {
    await whisperGM(`<p><b>Ужас (для ГМ):</b> Испуг (${reason}) не сработал — с прошлого не прошла минута, ещё ${left} р.</p>`);
    return;
  }
  if (combat) await combat.setFlag("world", "heartDreadScareRound", combat.round);

  const numbers = await rollScareNumbers();
  const partyLevel = party.reduce((s, a) => s + a.level, 0) / party.length;
  const env = { dcStd: levelDC(partyLevel), inCombat: !!combat };
  for (const n of numbers) {
    const S = SCARES[n];
    const lines = [];
    for (const a of party) {
      const dv = dreadValue(a);
      const res = await S.apply(a, dv, env);
      if (res) lines.push(`<b>${a.name}</b> (Ужас ${dv}): ${res}`);
    }
    const html = scareCard(n, S, env, lines, numbers.length > 1);
    await ChatMessage.create({ content: await game.pf2e.TextEditor.enrichHTML(html) });
  }
}

// ---------- проверка Ужаса (конец раунда / 10 минут исследования) ----------
export async function dreadCheck(dcParty, scene, label) {
  const party = uniq(dcParty);
  if (!party.length) return;
  const left = scareCooldownLeft();
  if (left) {
    await whisperGM(`<p><b>Проверка Ужаса</b> · ${label} — пропущена: Испуг на перезарядке, ещё ${left} р.</p>`);
    return;
  }
  const total = party.reduce((s, a) => s + dreadValue(a), 0);
  const dc = 1 + total;
  const r = await new Roll("1d20").evaluate();
  const fail = r.total < dc;
  const flavor =
    `<p><strong>Проверка Ужаса</strong> · ${label}<br>` +
    `DC ${dc} = 1 + сумма Ужаса партии (${party.map((a) => `${a.name} ${dreadValue(a)}`).join(", ")})</p>` +
    `<p>${fail ? "<strong>Меньше DC — Испуг!</strong>" : "Не меньше DC — пока тихо."}</p>`;
  await r.toMessage({ flavor, whisper: gmIds() }, { rollMode: "gmroll", messageMode: "gm" });
  if (fail) await triggerScare(partyInZone(scene), scene, label);
}
