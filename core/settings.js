// Общее для всех подсистем: идентификатор модуля, настройки, пути к файлам.
export const ID = "heart-of-fantasy";

export const setting = (key) => game.settings.get(ID, key);

// Настройка мира, видна в «Настроить параметры» → модуль
export const registerSetting = (key, data) =>
  game.settings.register(ID, key, { scope: "world", config: true, ...data });

export const modulePath = (path) => `modules/${ID}/${path}`;
