// Биомы Испугов. У сцены свой биом (флаг сцены), по умолчанию — из настроек модуля.
// Биом задаёт таблицу исследования и лесные/городские замены текстов и существ в боевой таблице.
// Новый биом = файл с таблицей исследования (+ замены для боя) и одна запись здесь.
import { ID, setting } from "../../../core/settings.js";
import { COMBAT_SCARES } from "./combat.js";
import { CITY_SCARES } from "./city.js";
import { FOREST_SCARES, FOREST_COMBAT } from "./forest.js";

export const BIOMES = {
  city: { label: "Город: дом с привидениями (Осколок №2)", short: "город", exploration: CITY_SCARES, combat: {} },
  forest: { label: "Лес Отродья: заражённые звери (Осколок №1)", short: "лес", exploration: FOREST_SCARES, combat: FOREST_COMBAT },
};
export const BIOME_CHOICES = Object.fromEntries(Object.entries(BIOMES).map(([k, b]) => [k, b.label]));

export function getBiome(scene) {
  const key = scene?.getFlag?.(ID, "dreadBiome") ?? setting("dreadBiome");
  return BIOMES[key] ? key : "city";
}
export const setBiome = (scene, key) => scene?.setFlag(ID, "dreadBiome", key);

// Боевая таблица с заменами биома: механика общая, текст и существа — свои
const combatFor = (biome) => COMBAT_SCARES.map((s) => (BIOMES[biome].combat[s.id] ? { ...s, ...BIOMES[biome].combat[s.id] } : s));

export function scareList(table, biome) {
  return table === "combat" ? combatFor(biome) : BIOMES[biome].exploration;
}

export function findScare(id, biome) {
  const list = id?.startsWith("c") ? combatFor(BIOMES[biome] ? biome : "city") : Object.values(BIOMES).flatMap((b) => b.exploration);
  return list.find((s) => s.id === id) ?? null;
}
