// Настройки модуля: Настройки игры → Настроить → «Сердце Фантазии — инструменты ГМ».
export const ID = "heart-of-fantasy";

export const setting = (key) => game.settings.get(ID, key);

export function registerSettings() {
  const world = (key, data) => game.settings.register(ID, key, { scope: "world", config: true, ...data });

  world("dreadEnabled", {
    name: "Ужас: подсистема включена",
    hint: "Отслеживание Ужаса, Испугов и Срыва. Меняется после перезагрузки.",
    type: Boolean,
    default: true,
    requiresReload: true,
  });
  world("dreadScope", {
    name: "Ужас: кому растёт",
    hint: "Натуральная 1 у персонажа и натуральная 20 у врага.",
    type: String,
    choices: { party: "Всей партии в зоне (как в книге)", self: "Только бросившему или цели" },
    default: "party",
  });
  world("dreadOncePerRound", {
    name: "Ужас: не чаще раза за раунд",
    hint: "В бою Ужас персонажа растёт не чаще раза за раунд (правило книги).",
    type: Boolean,
    default: true,
  });
  world("dreadFlatChecks", {
    name: "Ужас: учитывать чистые проверки",
    hint: "Натуральные 1 и 20 на чистых проверках тоже двигают Ужас.",
    type: Boolean,
    default: true,
  });
  world("dreadAnnounce", {
    name: "Ужас: сообщать в чат",
    hint: "Писать в общий чат, когда Ужас растёт.",
    type: Boolean,
    default: true,
  });
  world("dreadRoundCheck", {
    name: "Ужас: проверка в конце раунда",
    hint: "Чистая проверка DC 1 + суммарный Ужас партии в конце каждого раунда боя.",
    type: Boolean,
    default: true,
  });
  world("dreadScareCooldown", {
    name: "Испуг: перезарядка (раунды)",
    hint: "После Испуга следующий — не раньше чем через столько раундов. По книге — минута, 10 раундов.",
    type: Number,
    range: { min: 0, max: 30, step: 1 },
    default: 10,
  });
  world("meltdownVisual", {
    name: "Срыв: кадр Cinematic Cut-ins",
    hint: "Показывать кадр Срыва на экране у всех (нужен модуль Cinematic Cut-ins).",
    type: Boolean,
    default: true,
  });
}
