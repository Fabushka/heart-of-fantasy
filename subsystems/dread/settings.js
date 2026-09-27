// Настройки подсистемы Ужаса. Ключи прежние (dread…), чтобы сохранённые значения не потерялись.
import { registerSetting, setting, modulePath } from "../../core/settings.js";
import { BIOME_CHOICES } from "./scares/biomes.js";

export const S = {
  enabled: () => setting("dreadEnabled"),
  scope: () => setting("dreadScope"),
  oncePerRound: () => setting("dreadOncePerRound"),
  flatChecks: () => setting("dreadFlatChecks"),
  announce: () => setting("dreadAnnounce"),
  roundCheck: () => setting("dreadRoundCheck"),
  scareCooldown: () => setting("dreadScareCooldown"),
  immunityRounds: () => setting("dreadMeltdownImmunity"),
  sound: () => setting("dreadMeltdownSound"),
  volume: () => setting("dreadMeltdownVolume"),
};

export function registerDreadSettings() {
  registerSetting("dreadEnabled", {
    name: "Ужас: подсистема включена",
    hint: "Отслеживание Ужаса, Испугов и Срывов. Меняется после перезагрузки.",
    type: Boolean,
    default: true,
    requiresReload: true,
  });
  registerSetting("dreadScope", {
    name: "Ужас: кому растёт",
    hint: "Критический успех врага и критический провал персонажа.",
    type: String,
    choices: { party: "Всей партии в зоне (как в книге)", self: "Только бросившему или его цели" },
    default: "party",
  });
  registerSetting("dreadOncePerRound", {
    name: "Ужас: не чаще раза за раунд",
    hint: "В бою Ужас персонажа растёт не чаще раза за раунд (правило книги).",
    type: Boolean,
    default: true,
  });
  registerSetting("dreadFlatChecks", {
    name: "Ужас: учитывать чистые проверки",
    hint: "Критические провалы чистых проверок тоже двигают Ужас.",
    type: Boolean,
    default: true,
  });
  registerSetting("dreadAnnounce", {
    name: "Ужас: сообщать в чат",
    hint: "Писать в общий чат, когда Ужас растёт.",
    type: Boolean,
    default: true,
  });
  registerSetting("dreadRoundCheck", {
    name: "Ужас: проверка в конце раунда",
    hint: "Чистая проверка DC 1 + суммарный Ужас партии в конце каждого раунда боя.",
    type: Boolean,
    default: true,
  });
  registerSetting("dreadBiome", {
    name: "Испуг: биом по умолчанию",
    hint: "Какая таблица Испугов исследования и какие существа в бою. Для отдельной сцены биом меняется в «Ужас — управление».",
    type: String,
    choices: BIOME_CHOICES,
    default: "city",
  });
  registerSetting("dreadScareCooldown", {
    name: "Испуг: перезарядка (раунды)",
    hint: "После Испуга в бою следующий — не раньше чем через столько раундов. По книге — минута, 10 раундов.",
    type: Number,
    range: { min: 0, max: 30, step: 1 },
    default: 10,
  });
  registerSetting("dreadMeltdownImmunity", {
    name: "Срыв: передышка (раунды)",
    hint: "Сколько раундов после Срыва новый Срыв не случается. Если к концу передышки Ужас 5 — Срыв сразу.",
    type: Number,
    range: { min: 0, max: 10, step: 1 },
    default: 3,
  });
  registerSetting("dreadMeltdownSound", {
    name: "Срыв: звук",
    hint: "Звучит у всех при Срыве. Пусто — без звука.",
    type: String,
    filePicker: "audio",
    default: modulePath("subsystems/dread/sounds/heartbeat.ogg"),
  });
  registerSetting("dreadMeltdownVolume", {
    name: "Срыв: громкость звука",
    type: Number,
    range: { min: 0, max: 1, step: 0.05 },
    default: 0.8,
  });
}
