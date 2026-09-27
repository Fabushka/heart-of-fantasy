// Испуги в исследовании (d20). Больше нарратива, ловушки, болезни и яды.
// Последствия живут дольше боевых: 10 минут, час, до отдыха; болезни — пока не вылечат.
import { rounds, minutes, hours } from "../../../core/pf2e.js";
import { fx, cond, hurt, status, rollTwiceWorse, trapped, stealConsumable, ambush } from "./helpers.js";
import { inflict } from "./afflictions.js";

const nothing = { text: "ничего" };

export const EXPLORATION_SCARES = [
  {
    id: "e01",
    name: "Мгла",
    img: "icons/svg/cowled.svg",
    text: "Туман поднимается из-под пола и глотает стены. Коридор, который вы только что прошли, теперь ведёт в другую сторону.",
    targets: "all",
    check: "survival",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "час −2 к Внимательности и Выживанию", apply: (a) => fx(a, "Мгла", { img: "icons/svg/cowled.svg", duration: hours(1), rules: [status(["perception", "survival"], -2, "Мгла")], desc: "Сбился с пути: −2 к Внимательности и Выживанию." }) },
      criticalFailure: {
        text: "как провал, напуган 1 и отбивается от группы",
        apply: async (a) => {
          await fx(a, "Мгла", { img: "icons/svg/cowled.svg", duration: hours(1), rules: [status(["perception", "survival"], -2, "Мгла")], desc: "Сбился с пути: −2 к Внимательности и Выживанию." });
          await cond(a, "frightened", 1);
          return "ГМ переставляет токен";
        },
      },
    },
  },
  {
    id: "e02",
    name: "Кукла поворачивает голову",
    img: "icons/svg/mystery-man.svg",
    text: "Фарфоровая кукла на стуле медленно поворачивает голову вслед за вами. Когда вы оборачиваетесь, она уже сидит ближе.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: { text: "напуган 2, ошеломлён 1 на 10 минут", apply: async (a) => { await cond(a, "frightened", 2); await fx(a, "Кукла", { img: "icons/svg/mystery-man.svg", duration: minutes(10), conds: [["stupefied", 1]], desc: "Ошеломлён 1: не может выбросить её из головы." }); } },
      criticalFailure: { text: "напуган 3, ошеломлён 2 на 10 минут", apply: async (a) => { await cond(a, "frightened", 3); await fx(a, "Кукла", { img: "icons/svg/mystery-man.svg", duration: minutes(10), conds: [["stupefied", 2]], desc: "Ошеломлён 2: не может выбросить её из головы." }); } },
    },
  },
  {
    id: "e03",
    name: "Взгляд с портрета",
    img: "icons/svg/eye.svg",
    text: "Глаза на старом портрете следят за вами. На раме свежие царапины — изнутри.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "10 минут −1 к Скрытности", apply: (a) => fx(a, "Под наблюдением", { img: "icons/svg/eye.svg", duration: minutes(10), rules: [status("stealth", -1, "Под наблюдением")], desc: "−1 к Скрытности." }) },
      failure: { text: "час −2 к Скрытности и инициативе", apply: (a) => fx(a, "Под наблюдением", { img: "icons/svg/eye.svg", duration: hours(1), rules: [status(["stealth", "initiative"], -2, "Под наблюдением")], desc: "Кажется, что за тобой следят: −2 к Скрытности и инициативе." }) },
      criticalFailure: {
        text: "как провал и напуган 1",
        apply: async (a) => { await fx(a, "Под наблюдением", { img: "icons/svg/eye.svg", duration: hours(1), rules: [status(["stealth", "initiative"], -2, "Под наблюдением")], desc: "Кажется, что за тобой следят: −2 к Скрытности и инициативе." }); await cond(a, "frightened", 1); },
      },
    },
  },
  {
    id: "e04",
    name: "Шаги над головой",
    img: "icons/svg/cowled.svg",
    text: "Наверху кто-то ходит. Тяжёлые шаги пересекают комнату и останавливаются ровно над вами. Этажа наверху нет.",
    targets: "all",
    check: "perception",
    outcomes: {
      criticalSuccess: { text: "+2 к следующей инициативе: понял, откуда придут", apply: (a) => fx(a, "Слышал шаги", { img: "icons/svg/sound.svg", rules: [{ key: "FlatModifier", selector: "initiative", type: "circumstance", value: 2, label: "Слышал шаги", removeAfterRoll: true }], desc: "+2 к следующей инициативе." }) },
      success: nothing,
      failure: { text: "в следующем бою застигнут врасплох в первом раунде", apply: (a) => ambush(a) },
      criticalFailure: { text: "как провал и напуган 1", apply: async (a) => { await ambush(a); await cond(a, "frightened", 1); } },
    },
  },
  {
    id: "e05",
    name: "Надпись кровью",
    img: "icons/svg/blood.svg",
    text: "На стене проступают буквы, ещё влажные. Это ваше имя. Под ним — дата. Сегодняшняя.",
    targets: "all",
    check: "will",
    note: "Оккультизм или Религия (DC Испуга): надпись — след конкретного духа, ГМ даёт зацепку.",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "тошнота 1", apply: (a) => cond(a, "sickened", 1) },
      criticalFailure: { text: "тошнота 2, напуган 1", apply: async (a) => { await cond(a, "sickened", 2); await cond(a, "frightened", 1); } },
    },
  },
  {
    id: "e06",
    name: "Ледяное дыхание",
    img: "icons/svg/frozen.svg",
    text: "Кто-то невидимый дышит вам в затылок. Дыхание холодное, как колодезная вода, и пахнет сырой землёй.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {r}d6 холода", apply: (a, c) => hurt(a, `${c.rank}d6[cold]`, 0.5, "Ледяное дыхание") },
      failure: { text: "{r}d6 холода, неуклюж 1 на 10 минут", apply: async (a, c) => { await hurt(a, `${c.rank}d6[cold]`, 1, "Ледяное дыхание"); await fx(a, "Озноб", { img: "icons/svg/frozen.svg", duration: minutes(10), conds: [["clumsy", 1]], desc: "Неуклюж 1." }); } },
      criticalFailure: {
        text: "двойной урон, неуклюж 1 на 10 минут, утомлён",
        apply: async (a, c) => { await hurt(a, `${c.rank}d6[cold]`, 2, "Ледяное дыхание"); await fx(a, "Озноб", { img: "icons/svg/frozen.svg", duration: minutes(10), conds: [["clumsy", 1]], desc: "Неуклюж 1." }); await cond(a, "fatigued"); },
      },
    },
  },
  {
    id: "e07",
    name: "Ловушка: провал в полу",
    img: "icons/svg/falling.svg",
    text: "Половицы под ногами проседают с долгим стоном и уходят вниз. Под ними — не подвал, а яма, полная старых костей.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "падает: {r}d8 дробящего, ничком", apply: async (a, c) => { await hurt(a, `${c.rank}d8[bludgeoning]`, 1, "Провал в полу"); await cond(a, "prone"); } },
      criticalFailure: {
        text: "{2r}d8 дробящего, ничком, завален обломками (высвободиться)",
        apply: async (a, c) => { await hurt(a, `${c.rank * 2}d8[bludgeoning]`, 1, "Провал в полу"); await cond(a, "prone"); return trapped(a, "Под обломками", { slug: "immobilized", dc: c.dc, img: "icons/svg/falling.svg", desc: "Придавлен обломками." }); },
      },
    },
  },
  {
    id: "e08",
    name: "Ловушка: игла в дверной ручке",
    img: "icons/svg/poison.svg",
    text: "Ручка двери чуть теплее, чем должна быть. Укол почти не больно. Почти.",
    targets: "one",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "трупный яд, стадия 1", apply: (a, c) => inflict(a, "corpsePoison", 1, c.dc) },
      criticalFailure: { text: "трупный яд, стадия 2", apply: (a, c) => inflict(a, "corpsePoison", 2, c.dc) },
    },
  },
  {
    id: "e09",
    name: "Споры из мертвеца",
    img: "icons/svg/biohazard.svg",
    text: "Тело в углу вздрагивает, и из его рта выходит облачко серой пыли. Пыль пахнет сладко.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "могильная гниль, стадия 1", apply: (a, c) => inflict(a, "graveRot", 1, c.dc) },
      criticalFailure: { text: "могильная гниль, стадия 2", apply: (a, c) => inflict(a, "graveRot", 2, c.dc) },
    },
  },
  {
    id: "e10",
    name: "Крысы в стенах",
    img: "icons/svg/pawprint.svg",
    text: "Скрежет в стенах становится громче, и из-под плинтусов хлещет поток крыс. У них человеческие глаза.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "укусы: {r}d4 колющего", apply: (a, c) => hurt(a, `${c.rank}d4[piercing]`, 1, "Крысы") },
      failure: { text: "укусы и кошмарная лихорадка, стадия 1", apply: async (a, c) => { await hurt(a, `${c.rank}d4[piercing]`, 1, "Крысы"); return inflict(a, "nightFever", 1, c.dc); } },
      criticalFailure: { text: "укусы и кошмарная лихорадка, стадия 2", apply: async (a, c) => { await hurt(a, `${c.rank}d4[piercing]`, 1, "Крысы"); return inflict(a, "nightFever", 2, c.dc); } },
    },
  },
  {
    id: "e11",
    name: "Зеркало крадёт годы",
    img: "icons/svg/statue.svg",
    text: "Отражение не повторяет движений. Оно стареет на глазах — и вы чувствуете, как вместе с ним уходят силы.",
    targets: "one",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: { text: "истощён 1", apply: (a) => cond(a, "drained", 1) },
      criticalFailure: { text: "истощён 2, напуган 1", apply: async (a) => { await cond(a, "drained", 2); await cond(a, "frightened", 1); } },
    },
  },
  {
    id: "e12",
    name: "Колыбельная",
    img: "icons/svg/sleep.svg",
    text: "Где-то поёт мать. Колыбельная на языке, которого вы не знаете, но слова понятны: спи, спи, больше не просыпайся.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "утомлён на час", apply: (a) => fx(a, "Колыбельная", { img: "icons/svg/sleep.svg", duration: hours(1), conds: [["fatigued"]], desc: "Утомлён." }) },
      criticalFailure: {
        text: "засыпает на минуту (будят урон или встряхивание), утомлён на час",
        apply: async (a) => {
          await fx(a, "Колыбельная", { img: "icons/svg/sleep.svg", duration: hours(1), conds: [["fatigued"]], desc: "Утомлён." });
          await fx(a, "Колыбельная — сон", { img: "icons/svg/unconscious.svg", duration: minutes(1), rules: [{ key: "GrantItem", uuid: "Compendium.pf2e.conditionitems.Item.fBnFDH2MTzgFijKf" }], desc: "Спит. Урон или встряхивание будят (удалите эффект)." });
        },
      },
    },
  },
  {
    id: "e13",
    name: "Зов по имени",
    img: "icons/svg/sound.svg",
    text: "Из темноты зовут по имени — голосом того, кого вы похоронили. Голос просит подойти. Совсем ненадолго.",
    targets: "one",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "заворожён 1 раунд", apply: (a) => fx(a, "Зов", { img: "icons/svg/sound.svg", duration: rounds(1), conds: [["fascinated"]], desc: "Заворожён голосом." }) },
      failure: { text: "заворожён минуту, идёт на голос", apply: (a) => fx(a, "Зов", { img: "icons/svg/sound.svg", duration: minutes(1), conds: [["fascinated"]], desc: "Заворожён: идёт на голос. Враждебное действие против него снимает эффект." }) },
      criticalFailure: {
        text: "заворожён минуту, уходит в темноту на 60 футов, напуган 1",
        apply: async (a) => { await fx(a, "Зов", { img: "icons/svg/sound.svg", duration: minutes(1), conds: [["fascinated"]], desc: "Заворожён: ушёл на голос в темноту." }); await cond(a, "frightened", 1); return "ГМ переставляет токен на 60 футов"; },
      },
    },
  },
  {
    id: "e14",
    name: "Вещи не на месте",
    img: "icons/svg/mystery-man.svg",
    text: "Вы точно клали это сюда. Сумка застёгнута, но внутри чего-то не хватает, а на дне — горсть могильной земли.",
    targets: "all",
    check: "perception",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "пропадает случайный расходник (вернётся, когда Испуги кончатся)", apply: (a) => stealConsumable(a) },
      criticalFailure: { text: "как провал и напуган 1", apply: async (a) => { const t = await stealConsumable(a); await cond(a, "frightened", 1); return t; } },
    },
  },
  {
    id: "e15",
    name: "Ловушка: удавка",
    img: "icons/svg/net.svg",
    text: "С потолочной балки падает петля и затягивается на шее. Верёвка старая, волокна липкие — ею уже пользовались.",
    targets: "one",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "{r}d6 дробящего, схвачен (высвободиться)", apply: async (a, c) => { await hurt(a, `${c.rank}d6[bludgeoning]`, 1, "Удавка"); return trapped(a, "Удавка", { slug: "grabbed", dc: c.dc, desc: "Петля на шее." }); } },
      criticalFailure: {
        text: "{r}d6 дробящего, схвачен и обездвижен, не может говорить (высвободиться)",
        apply: async (a, c) => { await hurt(a, `${c.rank}d6[bludgeoning]`, 1, "Удавка"); return trapped(a, "Удавка", { slug: "restrained", dc: c.dc, desc: "Петля на шее, не может говорить." }); },
      },
    },
  },
  {
    id: "e16",
    name: "Холодная рука на плече",
    img: "icons/svg/frozen.svg",
    text: "На плечо ложится ладонь. Пальцы сжимаются. Рядом никого нет, но следы пальцев на коже останутся до утра.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: { text: "напуган 2, час −1 к спасброскам от страха", apply: async (a) => { await cond(a, "frightened", 2); await fx(a, "Метка мертвеца", { img: "icons/svg/frozen.svg", duration: hours(1), rules: [status("saving-throw", -1, "Метка мертвеца", ["item:trait:fear"])], desc: "−1 к спасброскам от страха." }); } },
      criticalFailure: { text: "напуган 3, час −2 к спасброскам от страха", apply: async (a) => { await cond(a, "frightened", 3); await fx(a, "Метка мертвеца", { img: "icons/svg/frozen.svg", duration: hours(1), rules: [status("saving-throw", -2, "Метка мертвеца", ["item:trait:fear"])], desc: "−2 к спасброскам от страха." }); } },
    },
  },
  {
    id: "e17",
    name: "Кровавая ржавчина",
    img: "icons/svg/sword.svg",
    text: "Металл покрывается рыжими пятнами прямо на глазах. Ржавчина пахнет кровью и не стирается.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "час −1 к атакам и урону оружием", apply: (a) => fx(a, "Кровавая ржавчина", { img: "icons/svg/sword.svg", duration: hours(1), rules: [status(["attack", "strike-damage"], -1, "Ржавчина")], desc: "−1 к атакам и урону Ударов." }) },
      criticalFailure: { text: "час −2 к атакам и урону оружием", apply: (a) => fx(a, "Кровавая ржавчина", { img: "icons/svg/sword.svg", duration: hours(1), rules: [status(["attack", "strike-damage"], -2, "Ржавчина")], desc: "−2 к атакам и урону Ударов." }) },
    },
  },
  {
    id: "e18",
    name: "Дым из холодного камина",
    img: "icons/svg/fire.svg",
    text: "Камин давно не топили, но из него валит жирный чёрный дым. В дыму — запах горелых волос.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: nothing,
      failure: { text: "тошнота 1", apply: (a) => cond(a, "sickened", 1) },
      criticalFailure: { text: "тошнота 2, утомлён на час", apply: async (a) => { await cond(a, "sickened", 2); await fx(a, "Дым", { img: "icons/svg/fire.svg", duration: hours(1), conds: [["fatigued"]], desc: "Утомлён." }); } },
    },
  },
  {
    id: "e19",
    name: "Видение прошлого",
    img: "icons/svg/book.svg",
    text: "Комната на миг становится прежней: свечи, голоса, накрытый стол. И вы видите, что здесь случилось.",
    targets: "all",
    check: "will",
    note: "При успехе и провале ГМ даёт зацепку о том, что здесь случилось.",
    outcomes: {
      criticalSuccess: {
        text: "зацепка и +2 к следующей проверке Вспомнить знания или Внимательности",
        apply: (a) => fx(a, "Видел прошлое", { img: "icons/svg/book.svg", duration: hours(1), rules: [{ key: "FlatModifier", selector: ["perception", "skill-check"], predicate: [{ or: ["action:recall-knowledge", "check:type:perception-check"] }], type: "circumstance", value: 2, label: "Видел прошлое", removeAfterRoll: true }], desc: "+2 к следующей проверке Вспомнить знания или Внимательности." }),
      },
      success: { text: "зацепка от ГМ" },
      failure: { text: "зацепка от ГМ, но напуган 2", apply: (a) => cond(a, "frightened", 2) },
      criticalFailure: { text: "зацепки нет, напуган 2, ошеломлён 2 на 10 минут", apply: async (a) => { await cond(a, "frightened", 2); await fx(a, "Чужие воспоминания", { img: "icons/svg/book.svg", duration: minutes(10), conds: [["stupefied", 2]], desc: "Ошеломлён 2." }); } },
    },
  },
  {
    id: "e20",
    name: "Метка изгоя",
    img: "icons/svg/skull.svg",
    text: "Дух касается лба одного из вас. На коже ничего не видно, но живые теперь чувствуют: с этим человеком что-то не так.",
    targets: "one",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "10 минут Обман, Дипломатия, Запугивание, Выступление — дважды, худший", apply: (a) => fx(a, "Метка изгоя", { img: "icons/svg/skull.svg", duration: minutes(10), rules: [rollTwiceWorse(["deception", "diplomacy", "intimidation", "performance"], false)], desc: "Социальные навыки — дважды, берётся худший." }) },
      failure: { text: "то же на час, отношение незнакомцев на ступень хуже", apply: (a) => fx(a, "Метка изгоя", { img: "icons/svg/skull.svg", duration: hours(1), rules: [rollTwiceWorse(["deception", "diplomacy", "intimidation", "performance"], false)], desc: "Социальные навыки — дважды, берётся худший. Незнакомцы относятся на ступень хуже." }) },
      criticalFailure: { text: "то же на сутки", apply: (a) => fx(a, "Метка изгоя", { img: "icons/svg/skull.svg", duration: { value: 1, unit: "days", expiry: "turn-start", sustained: false }, rules: [rollTwiceWorse(["deception", "diplomacy", "intimidation", "performance"], false)], desc: "Социальные навыки — дважды, берётся худший. Незнакомцы относятся на ступень хуже." }) },
    },
  },
];

