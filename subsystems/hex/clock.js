// Окно похода: день, время, фаза дня, такт и событие дня. Открывается только у ГМ; игроки его не видят.
// Время берётся из часов мира. Кнопки двигают время такта́ми и запускают «Новый день».
import { ID } from "../../core/settings.js";
import { slotLabel } from "./data.js";
import { getState } from "./state.js";

const DAY_START = 6;   // с этого часа начинается первый такт
const TACT_HOURS = 3;  // 12 полезных часов = четыре такта по три часа
const PHASES = [
  { key: "НОЧ", from: 22, to: 6 },
  { key: "УТР", from: 6, to: 12 },
  { key: "ДЕН", from: 12, to: 18 },
  { key: "ВЕЧ", from: 18, to: 22 },
];

// Часы и минуты мира: сначала часы PF2e, потом календарь ядра, потом грубо из секунд.
export function now() {
  const wc = game.pf2e?.worldClock?.worldTime;
  if (Number.isFinite(wc?.hour)) return { hour: wc.hour, minute: wc.minute ?? 0 };
  const c = game.time.components ?? game.time.calendar?.timeToComponents?.(game.time.worldTime);
  if (Number.isFinite(c?.hour)) return { hour: c.hour, minute: c.minute ?? 0 };
  const s = ((game.time.worldTime % 86400) + 86400) % 86400;
  return { hour: Math.floor(s / 3600), minute: Math.floor((s % 3600) / 60) };
}

export function phaseOf(hour) {
  return PHASES.find((p) => (p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to)).key;
}

// Номер такта 1–4 в рабочие часы, иначе null (лагерь или ночь).
export function tactOf(hour) {
  const t = Math.floor((hour - DAY_START) / TACT_HOURS) + 1;
  return t >= 1 && t <= 4 ? t : null;
}

const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const advanceHours = (h) => game.time.advance(Math.round(h * 3600));

// До ближайших шести утра. Если сейчас ровно шесть — на сутки вперёд.
export function advanceToMorning() {
  const { hour, minute } = now();
  const mins = ((DAY_START * 60 - (hour * 60 + minute) + 1440) % 1440) || 1440;
  return game.time.advance(mins * 60);
}

function bodyHtml() {
  const st = getState();
  const { hour, minute } = now();
  const phase = phaseOf(hour);
  const tact = tactOf(hour);
  const t = st.today;
  const due = t && !t.done && !st.hold && t.slot === phase;
  let ev = "<i>не назначено</i>";
  if (t) {
    const state = t.done ? "сыграно" : st.hold ? "придержано" : due ? "СЕЙЧАС" : "ждёт";
    ev = `${slotLabel(t.slot)} — ${esc(t.label)} <span class="hof-clock-state">(${state})</span>`;
  }
  return `
    <div class="hof-clock${due ? " hof-clock-due" : ""}">
      <div class="hof-clock-top"><span class="hof-clock-day">День ${st.day}</span><span class="hof-clock-time">${pad(hour)}:${pad(minute)}</span></div>
      <div class="hof-clock-phase">${slotLabel(phase)}${tact ? ` · такт ${tact} из 4` : " · лагерь"}</div>
      <div class="hof-clock-event"><b>Событие дня:</b> ${ev}</div>
      <div class="hof-clock-buttons">
        <button type="button" data-action="adv" data-hours="2" data-tooltip="Переход по дороге">+2 ч</button>
        <button type="button" data-action="adv" data-hours="3" data-tooltip="Обычный такт">+3 ч</button>
        <button type="button" data-action="adv" data-hours="6" data-tooltip="Тяжёлая местность">+6 ч</button>
      </div>
      <div class="hof-clock-buttons">
        <button type="button" data-action="enter">Вошли в гекс</button>
        <button type="button" data-action="played">Сыграно</button>
      </div>
      <div class="hof-clock-buttons">
        <button type="button" data-action="newday" data-tooltip="Время до 06:00 и «Новый день»">Ночлег → новый день</button>
        <button type="button" data-action="panel">Пульт</button>
      </div>
    </div>`;
}

let app = null;
let AppClass = null;

// Класс создаётся при первом открытии, а не при загрузке модуля: ошибка здесь не должна ронять остальные подсистемы.
function makeClass(api) {
  const { ApplicationV2 } = foundry.applications.api;
  return class HexClock extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: "hof-hex-clock",
      classes: ["hof-hex-clock"],
      window: { title: "Поход", icon: "fa-solid fa-mountain-sun", resizable: false },
      position: { width: 270, height: "auto" },
      actions: {
        adv: (event, target) => advanceHours(Number(target.dataset.hours)),
        enter: () => api.enterHex(),
        played: () => api.playToday(),
        panel: () => api.panel(),
        newday: async () => {
          await advanceToMorning();
          await api.newDay();
        },
      },
    };

    async _renderHTML() {
      const div = document.createElement("div");
      div.innerHTML = bodyHtml();
      return div;
    }

    _replaceHTML(result, content) {
      content.replaceChildren(result);
    }
  };
}

export function openClock(api) {
  if (!game.user.isGM) return ui.notifications.warn("Окно похода: только для ГМ.");
  AppClass ??= makeClass(api);
  app ??= new AppClass();
  return app.render({ force: true });
}

const refresh = () => {
  if (app?.rendered) app.render();
};

// Вызывается один раз при старте подсистемы.
export function startClock(api, autoOpen) {
  let lastPhase = null;
  Hooks.on("updateWorldTime", () => {
    if (!game.user.isGM) return;
    const phase = phaseOf(now().hour);
    const st = getState();
    const t = st.today;
    if (phase !== lastPhase && lastPhase !== null && t && !t.done && !st.hold && t.slot === phase && game.user === game.users.activeGM) {
      ui.notifications.info(`Поход: наступил ${slotLabel(phase)} — время события дня: ${t.label}.`, { permanent: false });
    }
    lastPhase = phase;
    refresh();
  });
  Hooks.on(`${ID}.hexState`, refresh);
  if (autoOpen && game.user.isGM) {
    try {
      openClock(api);
    } catch (err) {
      console.error(`${ID} | окно похода не открылось`, err);
    }
  }
}
