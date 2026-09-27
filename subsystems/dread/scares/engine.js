// Движок Испугов: бросок по таблице, карточка в чате, ожидание проверок, итоги, конец Испугов.
import {
  DEGREES, DEGREE_RU, levelDC, spellRank, uniq, gmIds, whisperGM, makeEffect, addItem, status, rollDie,
} from "../../../core/pf2e.js";
import { S } from "../settings.js";
import { TAG, dreadValue, partyInZone } from "../state.js";
import { COMBAT_SCARES } from "./combat.js";
import { EXPLORATION_SCARES } from "./exploration.js";
import { summonButton, pickSummon, dismissSummons } from "./summons.js";
import { scareFlags } from "./helpers.js";

export const TABLES = {
  combat: { label: "бой", list: COMBAT_SCARES },
  exploration: { label: "исследование", list: EXPLORATION_SCARES },
};
const byId = new Map([...COMBAT_SCARES, ...EXPLORATION_SCARES].map((s) => [s.id, s]));
export const scareById = (id) => byId.get(id);

const CHECK_RU = {
  will: "Воля", fortitude: "Стойкость", reflex: "Рефлекс", perception: "Внимательность",
  survival: "Выживание", athletics: "Атлетика", acrobatics: "Акробатика",
};
const OUTCOME_RU = { criticalSuccess: "Крит. успех", success: "Успех", failure: "Провал", criticalFailure: "Крит. провал" };

const enrich = (html) => game.pf2e.TextEditor.enrichHTML(html);
// {r} и {2r} в текстах таблиц — ранг заклинания для уровня партии
const fmt = (text, rank) => String(text ?? "").replaceAll("{2r}", String(rank * 2)).replaceAll("{r}", String(rank));
const say = async (html, extra = {}) => ChatMessage.create({ content: await enrich(html), ...extra });

// Итоговая степень успеха: доверяем PF2e; если правило диапазона Ужаса не сработало — страхуем
export function effectiveDegree(ctx, nat, dv) {
  let deg = DEGREES.indexOf(ctx.outcome ?? "");
  if (deg < 0) return null;
  const expected = dv > 1 && nat > 1 && nat <= dv;
  if (expected && ctx.outcome === ctx.unadjustedOutcome && deg > 0) deg -= 1;
  return deg;
}

// ---------- перезарядка в бою ----------
export function scareCooldownLeft() {
  const c = game.combat;
  if (!c?.started) return 0;
  const last = c.getFlag("world", "heartDreadScareRound");
  if (last == null) return 0;
  return Math.max(0, S.scareCooldown() - (c.round - last));
}

// ---------- карточка ----------
function scareCard(S_, table, n, env, targets, extra) {
  const checkLine = S_.check
    ? `<p class="hof-check"><b>Проверка:</b> @Check[${S_.check}|dc:${env.dc}|name:Испуг: ${S_.name}|options:${TAG.scare},${TAG.scare}:${S_.id}]` +
      ` <span class="hof-muted">штраф −(Ужас − 1)</span></p>`
    : "";
  const outcomes = S_.outcomes
    ? `<ul class="hof-outcomes">${DEGREES.slice().reverse().map((d) => `<li><b>${OUTCOME_RU[d]}:</b> ${fmt(S_.outcomes[d]?.text ?? "ничего", env.rank)}</li>`).join("")}</ul>`
    : "";
  const who = targets.length
    ? `<p class="hof-targets"><b>${S_.targets === "one" ? "Цель" : "Цели"}:</b> ${targets.map((a) => `${a.name} <span class="hof-muted">(Ужас ${dreadValue(a)})</span>`).join(", ")}</p>`
    : "";
  return `
<div class="hof-card hof-scare hof-table-${table}">
  <header>
    <img class="hof-icon" src="${S_.img ?? "icons/svg/hazard.svg"}" alt="">
    <div>
      <span class="hof-kicker">Испуг · ${TABLES[table].label} · d20 = ${n}</span>
      <h3>${S_.name}</h3>
    </div>
  </header>
  <p class="hof-flavor">${S_.text}</p>
  ${checkLine}
  ${outcomes}
  ${who}
  ${extra ?? ""}
  ${S_.note ? `<p class="hof-note">${S_.note}</p>` : ""}
</div>`;
}

// ---------- Испуг ----------
// party — персонажи в зоне. table — "combat" | "exploration" | null (по обстановке). n — номер или случайный.
export async function triggerScare(party, scene, reason = "", { force = false, table = null, n = null } = {}) {
  party = uniq(party);
  if (!party.length) return;
  const combat = game.combat?.started ? game.combat : null;
  const left = scareCooldownLeft();
  if (left && !force) {
    await whisperGM(`<p><b>Ужас (для ГМ):</b> Испуг (${reason}) не случился — перезарядка, ещё ${left} р.</p>`);
    return;
  }
  if (combat) await combat.setFlag("world", "heartDreadScareRound", combat.round);

  table ??= combat ? "combat" : "exploration";
  n ??= await rollDie(20);
  const scare = TABLES[table].list[n - 1];
  const level = party.reduce((s, a) => s + a.level, 0) / party.length;
  const env = { level, rank: spellRank(level), dc: levelDC(level), inCombat: !!combat, scene, table };

  let targets = [];
  let extra = "";
  if (scare.summon) {
    extra = `<p class="hof-summon">${summonButton(pickSummon(scare.summon, Math.round(level)))}</p>`;
  } else {
    targets = scare.targets === "one" ? [party[Math.floor(Math.random() * party.length)]] : party;
    for (const a of targets) {
      const dv = dreadValue(a);
      const tag = `${TAG.scare}:${scare.id}`;
      const rules = dv > 1 ? [status(scare.check, -(dv - 1), "Ужас", [tag])] : [];
      await addItem(a, makeEffect({
        name: `Испуг: ${scare.name} — ждёт проверки`,
        img: "icons/svg/hazard.svg",
        rules,
        desc: `<p>Бросьте проверку из карточки Испуга. Штраф Ужаса: −${Math.max(0, dv - 1)}.</p>`,
        flags: scareFlags({ heartScarePending: scare.id, heartScareDc: env.dc, heartScareEnv: { level, rank: env.rank, table } }),
      }));
    }
  }
  await say(scareCard(scare, table, n, env, targets, extra));
}

// Итог проверки Испуга
export async function resolveScareRoll(ctx, roller, nat) {
  const tag = (ctx.options ?? []).find((o) => o.startsWith(`${TAG.scare}:`));
  const id = tag?.slice(TAG.scare.length + 1);
  const scare = scareById(id);
  const pending = roller.items.find((i) => i.getFlag("world", "heartScarePending") === id);
  if (!scare || !pending) return;
  const deg = effectiveDegree(ctx, nat, dreadValue(roller));
  if (deg === null) return;
  const envFlag = pending.getFlag("world", "heartScareEnv") ?? {};
  const c = {
    dv: dreadValue(roller),
    dc: pending.getFlag("world", "heartScareDc"),
    rank: envFlag.rank ?? spellRank(roller.level),
    level: envFlag.level ?? roller.level,
    inCombat: !!game.combat?.started,
  };
  await pending.delete();
  const outcome = scare.outcomes[DEGREES[deg]] ?? { text: "ничего" };
  let detail = "";
  try {
    const res = outcome.apply ? await outcome.apply(roller, c) : null;
    if (typeof res === "string") detail = res;
  } catch (err) {
    console.error("heart-of-fantasy | Испуг", err);
    detail = `не удалось применить автоматически (${err.message})`;
  }
  const base = fmt(outcome.text, c.rank);
  const text = detail && detail !== base ? `${base}; ${detail}` : base;
  await say(
    `<div class="hof-card hof-result hof-deg-${deg}"><p><b>${roller.name}</b> · ${scare.name} — ${DEGREE_RU[deg]}: ${text}.</p></div>`,
    { speaker: ChatMessage.getSpeaker({ actor: roller }) },
  );
}

// Высвобождение из ловушки
export async function resolveEscape(ctx, roller, nat) {
  const tag = (ctx.options ?? []).find((o) => o.startsWith(`${TAG.escape}:`));
  const key = tag?.slice(TAG.escape.length + 1);
  const eff = roller.items.find((i) => i.getFlag("world", "heartEscape")?.key === key);
  if (!eff) return;
  const deg = effectiveDegree(ctx, nat, dreadValue(roller));
  if (deg === null) return;
  if (deg >= 2) await eff.delete();
  await say(`<div class="hof-card hof-result hof-deg-${deg}"><p><b>${roller.name}</b> · ${eff.name.replace("Испуг: ", "")} — ${DEGREE_RU[deg]}: ${deg >= 2 ? "высвободился" : "держит крепко"}.</p></div>`);
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

// ---------- конец Испугов ----------
export async function removeOwnScares(actor) {
  const items = actor.items.filter((i) => i.getFlag("world", "heartScare"));
  for (const i of items) {
    const stolen = i.getFlag("world", "heartStolen");
    if (!stolen) continue;
    const stack = actor.items.find((x) => x.type === stolen.type && x.name === stolen.name && !x.getFlag("world", "heartScare"));
    if (stack) await stack.update({ "system.quantity": (stack.system.quantity ?? 1) + 1 });
    else await actor.createEmbeddedDocuments("Item", [stolen]);
  }
  const ids = items.map((i) => i.id);
  if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  return ids.length;
}

export async function endScares(scene) {
  const actors = uniq([
    ...(scene?.tokens ?? []).map((t) => t.actor),
    ...game.actors.filter((a) => a.type === "character"),
  ]);
  let removed = 0;
  for (const a of actors) removed += await removeOwnScares(a);
  removed += await dismissSummons(scene);
  if (removed) await ChatMessage.create({ content: `<div class="hof-card hof-result"><p><i>Наваждение отступает. Испуги рассеялись.</i></p></div>` });
}

// Вызывать после каждого СНИЖЕНИЯ Ужаса или выхода из зоны
export async function checkScareEnd(scene) {
  const party = partyInZone(scene);
  if (party.length && !party.every((a) => dreadValue(a) <= 1)) return;
  await endScares(scene);
}

// Засада из «Шагов над головой»: в начале боя — застигнут врасплох на 1 раунд
export async function onCombatStart(combat) {
  if (game.users.activeGM !== game.user) return;
  for (const c of combat.combatants) {
    const a = c.actor;
    const marker = a?.items.find((i) => i.getFlag("world", "heartAmbush"));
    if (!marker) continue;
    await marker.delete();
    await addItem(a, makeEffect({
      name: "Испуг: застигнут в засаде",
      img: "icons/svg/cowled.svg",
      duration: { value: 1, unit: "rounds", expiry: "turn-end", sustained: false },
      rules: [{ key: "GrantItem", uuid: "Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg", onDeleteActions: { grantee: "restrict" } }],
      desc: "<p>Застигнут врасплох в первом раунде.</p>",
      flags: scareFlags(),
    }));
    await ChatMessage.create({ content: `<div class="hof-card hof-result"><p><b>${a.name}</b> слышит шаги за спиной слишком поздно — застигнут врасплох.</p></div>` });
  }
}
