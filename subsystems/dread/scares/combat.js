// Испуги в бою (d20). Чистая механика: каждый результат — проверка и последствия по степени успеха.
// targets: "all" — вся партия в зоне, "one" — случайный персонаж. check — статистика PF2e.
// Штраф к проверке: −(Ужас − 1) статусом. Эффекты накладываются только после броска.
// Урон растёт с рангом заклинания для уровня партии: r = ⌈уровень / 2⌉.
import { rounds, minutes } from "../../../core/pf2e.js";
import { fx, cond, hurt, persistent, status, rollTwiceWorse, trapped, dropWeapon } from "./helpers.js";

const nothing = { text: "ничего" };

export const COMBAT_SCARES = [
  {
    id: "c01",
    name: "Шёпот мертвецов",
    img: "icons/svg/sound.svg",
    text: "Голоса тех, кто умер на этом месте, одновременно шепчут ваши имена. Шёпот идёт отовсюду — даже изнутри шлема.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: { text: "напуган 2", apply: (a) => cond(a, "frightened", 2) },
      criticalFailure: {
        text: "напуган 3 и в бегстве 1 раунд",
        apply: async (a) => {
          await cond(a, "frightened", 3);
          await fx(a, "Шёпот мертвецов", { img: "icons/svg/terror.svg", duration: rounds(1), conds: [["fleeing"]], desc: "В бегстве." });
        },
      },
    },
  },
  {
    id: "c02",
    name: "Хохот из стен",
    img: "icons/svg/daze.svg",
    text: "Стены смеются. Детский смех перерастает в истерический хохот — и вы понимаете, что смеётесь вместе с ними.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: {
        text: "1 раунд без реакций",
        apply: (a) => fx(a, "Хохот", { img: "icons/svg/daze.svg", duration: rounds(1), desc: "Не может использовать реакции." }),
      },
      failure: {
        text: "замедлен 1 и без реакций 2 раунда",
        apply: (a) => fx(a, "Хохот", { img: "icons/svg/daze.svg", duration: rounds(2), conds: [["slowed", 1]], desc: "Замедлен 1, не может использовать реакции." }),
      },
      criticalFailure: {
        text: "падает ничком, ошеломлён 3 (теряет ход), затем замедлен 1 и без реакций 2 раунда",
        apply: async (a) => {
          await cond(a, "prone");
          await cond(a, "stunned", 3);
          await fx(a, "Хохот", { img: "icons/svg/daze.svg", duration: rounds(2), conds: [["slowed", 1]], desc: "Замедлен 1, не может использовать реакции." });
        },
      },
    },
  },
  {
    id: "c03",
    name: "Фантомная боль",
    img: "icons/svg/blood.svg",
    text: "Старые шрамы раскрываются, будто их нанесли только что. Боль настоящая, крови нет.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "{r}d4 ментального урона", apply: (a, c) => hurt(a, `${c.rank}d4[mental]`, 1, "Фантомная боль") },
      failure: {
        text: "{r}d4 ментального, {r}d4 продолжительного ментального, тошнота 1",
        apply: async (a, c) => {
          await hurt(a, `${c.rank}d4[mental]`, 1, "Фантомная боль");
          await persistent(a, "mental", `${c.rank}d4`);
          await cond(a, "sickened", 1);
        },
      },
      criticalFailure: {
        text: "{2r}d4 ментального, {r}d4 продолжительного ментального, тошнота 2",
        apply: async (a, c) => {
          await hurt(a, `${c.rank * 2}d4[mental]`, 1, "Фантомная боль");
          await persistent(a, "mental", `${c.rank}d4`);
          await cond(a, "sickened", 2);
        },
      },
    },
  },
  {
    id: "c04",
    name: "Видение смерти",
    img: "icons/svg/skull.svg",
    text: "На миг один из вас видит собственный труп — точно здесь, точно в этой позе. Видение слишком подробное, чтобы быть просто страхом.",
    targets: "one",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {2r}d6 ментального, напуган 1", apply: async (a, c) => { await hurt(a, `${c.rank * 2}d6[mental]`, 0.5, "Видение смерти"); await cond(a, "frightened", 1); } },
      failure: { text: "{2r}d6 ментального, напуган 2", apply: async (a, c) => { await hurt(a, `${c.rank * 2}d6[mental]`, 1, "Видение смерти"); await cond(a, "frightened", 2); } },
      criticalFailure: {
        text: "двойной урон, напуган 3, в бегстве 1 раунд",
        apply: async (a, c) => {
          await hurt(a, `${c.rank * 2}d6[mental]`, 2, "Видение смерти");
          await cond(a, "frightened", 3);
          await fx(a, "Видение смерти", { img: "icons/svg/skull.svg", duration: rounds(1), conds: [["fleeing"]], desc: "В бегстве." });
        },
      },
    },
  },
  {
    id: "c05",
    name: "Кровавые слёзы",
    img: "icons/svg/blood.svg",
    text: "Из глаз, ушей и из-под ногтей сочится тёмная кровь. Она не останавливается.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: { text: "{r}d6 продолжительного кровотечения, напуган 1", apply: async (a, c) => { await persistent(a, "bleed", `${c.rank}d6`); await cond(a, "frightened", 1); } },
      criticalFailure: {
        text: "{r}d6 продолжительного кровотечения, напуган 2, истощён 1",
        apply: async (a, c) => { await persistent(a, "bleed", `${c.rank}d6`); await cond(a, "frightened", 2); await cond(a, "drained", 1); },
      },
    },
  },
  {
    id: "c06",
    name: "Мерцание",
    img: "icons/svg/sun.svg",
    text: "Свет бьётся в припадке: вспышки, чернота, снова вспышки. В каждой вспышке кто-то стоит ближе, чем в прошлой.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "ослеплён светом 1 раунд", apply: (a) => fx(a, "Мерцание", { img: "icons/svg/sun.svg", duration: rounds(1), conds: [["dazzled"]], desc: "Ослеплён светом." }) },
      failure: {
        text: "слеп 1 раунд, затем ослеплён светом 1 минуту",
        apply: async (a) => {
          await fx(a, "Мерцание — слепота", { img: "icons/svg/blind.svg", duration: rounds(1), conds: [["blinded"]], desc: "Слеп." });
          await fx(a, "Мерцание — пятна", { img: "icons/svg/sun.svg", duration: minutes(1), conds: [["dazzled"]], desc: "Ослеплён светом." });
        },
      },
      criticalFailure: {
        text: "оглушён 1, слеп 1 раунд, ослеплён светом 1 минуту",
        apply: async (a) => {
          await cond(a, "stunned", 1);
          await fx(a, "Мерцание — слепота", { img: "icons/svg/blind.svg", duration: rounds(1), conds: [["blinded"]], desc: "Слеп." });
          await fx(a, "Мерцание — пятна", { img: "icons/svg/sun.svg", duration: minutes(1), conds: [["dazzled"]], desc: "Ослеплён светом." });
        },
      },
    },
  },
  {
    id: "c07",
    name: "Руки из-под пола",
    img: "icons/svg/net.svg",
    text: "Сквозь доски прорастают серые руки и хватают за лодыжки. Их слишком много для одного мертвеца.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "−10 футов к скорости на 1 раунд", apply: (a) => fx(a, "Руки из-под пола", { img: "icons/svg/net.svg", duration: rounds(1), rules: [status("land-speed", -10, "Руки из-под пола")], desc: "−10 футов к скорости." }) },
      failure: { text: "обездвижен до конца следующего хода", apply: (a) => fx(a, "Руки из-под пола", { img: "icons/svg/net.svg", duration: rounds(1, "turn-end"), conds: [["immobilized"]], desc: "Обездвижен." }) },
      criticalFailure: { text: "схвачен и обездвижен, пока не высвободится (DC Испуга)", apply: (a, c) => trapped(a, "Руки из-под пола", { slug: "restrained", dc: c.dc, desc: "Руки держат крепко." }) },
    },
  },
  {
    id: "c08",
    name: "Чужой голос в голове",
    img: "icons/svg/daze.svg",
    text: "Кто-то говорит вашим голосом у вас в голове и отдаёт приказы. Приказы бессмысленны, но тело хочет подчиниться.",
    targets: "one",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "оглушён 1", apply: (a) => cond(a, "stunned", 1) },
      failure: { text: "в замешательстве до конца следующего хода", apply: (a) => fx(a, "Чужой голос", { img: "icons/svg/daze.svg", duration: rounds(1, "turn-end"), conds: [["confused"]], desc: "В замешательстве." }) },
      criticalFailure: { text: "в замешательстве 2 раунда, снять раньше нельзя", apply: (a) => fx(a, "Чужой голос", { img: "icons/svg/daze.svg", duration: rounds(2), conds: [["confused"]], desc: "В замешательстве, снять раньше нельзя." }) },
    },
  },
  {
    id: "c09",
    name: "Тени сгущаются",
    img: "icons/svg/cowled.svg",
    text: "Тени отделяются от своих хозяев и больше не повторяют их движений. Одна из них поворачивается к вам лицом.",
    summon: "shadows",
    note: "ГМ выпускает существо кнопкой.",
  },
  {
    id: "c10",
    name: "Мертвецы встают",
    img: "icons/svg/bones.svg",
    text: "Кости в углу собираются сами, с сухим стуком. То, что лежало здесь годами, решило, что вы — его дело.",
    summon: "dead",
    note: "ГМ выпускает существо кнопкой.",
  },
  {
    id: "c11",
    name: "Неупокоенный дух",
    img: "icons/svg/angel.svg",
    text: "Воздух стынет, и сквозь стену проходит фигура. Она продолжает то, что делала в миг своей смерти, — пока не замечает живых.",
    summon: "ghosts",
    note: "ГМ выпускает существо кнопкой.",
  },
  {
    id: "c12",
    name: "Туман в голове",
    img: "icons/svg/daze.svg",
    text: "Мысли вязнут, пальцы путают ремни и застёжки. Вы забываете, что собирались сделать, прямо посреди движения.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "неуклюж 1, ошеломлён 1 на 1 раунд", apply: (a) => fx(a, "Туман в голове", { img: "icons/svg/daze.svg", duration: rounds(1), conds: [["clumsy", 1], ["stupefied", 1]], desc: "Неуклюж 1, ошеломлён 1." }) },
      failure: { text: "неуклюж 2, ошеломлён 2 на 2 раунда", apply: (a) => fx(a, "Туман в голове", { img: "icons/svg/daze.svg", duration: rounds(2), conds: [["clumsy", 2], ["stupefied", 2]], desc: "Неуклюж 2, ошеломлён 2." }) },
      criticalFailure: {
        text: "неуклюж 3, ошеломлён 3 на 2 раунда, 1 раунд в замешательстве",
        apply: async (a) => {
          await fx(a, "Туман в голове", { img: "icons/svg/daze.svg", duration: rounds(2), conds: [["clumsy", 3], ["stupefied", 3]], desc: "Неуклюж 3, ошеломлён 3." });
          await fx(a, "Туман в голове — забытьё", { img: "icons/svg/daze.svg", duration: rounds(1), conds: [["confused"]], desc: "В замешательстве." });
        },
      },
    },
  },
  {
    id: "c13",
    name: "Дурное знамение",
    img: "icons/svg/eye.svg",
    text: "Трещина в стене складывается в знак, который вы знаете с детства. Он всегда означал одно: сегодня не повезёт.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "следующий бросок атаки или навыка — дважды, худший", apply: (a) => fx(a, "Дурное знамение", { img: "icons/svg/eye.svg", duration: rounds(1), rules: [rollTwiceWorse(["attack-roll", "skill-check"], true)], desc: "Следующий бросок атаки или навыка — дважды, берётся худший." }) },
      failure: { text: "1 раунд все атаки и навыки — дважды, худший", apply: (a) => fx(a, "Дурное знамение", { img: "icons/svg/eye.svg", duration: rounds(1), rules: [rollTwiceWorse(["attack-roll", "skill-check"], false)], desc: "Атаки и навыки — дважды, берётся худший." }) },
      criticalFailure: {
        text: "2 раунда все атаки и навыки — дважды, худший; напуган 1",
        apply: async (a) => {
          await fx(a, "Дурное знамение", { img: "icons/svg/eye.svg", duration: rounds(2), rules: [rollTwiceWorse(["attack-roll", "skill-check"], false)], desc: "Атаки и навыки — дважды, берётся худший." });
          await cond(a, "frightened", 1);
        },
      },
    },
  },
  {
    id: "c14",
    name: "Могильный холод",
    img: "icons/svg/frozen.svg",
    text: "Изо рта идёт пар, на ресницах иней. Холод идёт не снаружи — он поднимается из-под земли, из самих могил.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {r}d8 холода", apply: (a, c) => hurt(a, `${c.rank}d8[cold]`, 0.5, "Могильный холод") },
      failure: { text: "{r}d8 холода, замедлен 1 до конца следующего хода", apply: async (a, c) => { await hurt(a, `${c.rank}d8[cold]`, 1, "Могильный холод"); await fx(a, "Могильный холод", { img: "icons/svg/frozen.svg", duration: rounds(1, "turn-end"), conds: [["slowed", 1]], desc: "Замедлен 1." }); } },
      criticalFailure: {
        text: "двойной урон, замедлен 1 до конца следующего хода, неуклюж 1 на минуту",
        apply: async (a, c) => {
          await hurt(a, `${c.rank}d8[cold]`, 2, "Могильный холод");
          await fx(a, "Могильный холод", { img: "icons/svg/frozen.svg", duration: rounds(1, "turn-end"), conds: [["slowed", 1]], desc: "Замедлен 1." });
          await fx(a, "Могильный холод — онемение", { img: "icons/svg/frozen.svg", duration: minutes(1), conds: [["clumsy", 1]], desc: "Неуклюж 1." });
        },
      },
    },
  },
  {
    id: "c15",
    name: "Рой из трещин",
    img: "icons/svg/biohazard.svg",
    text: "Из щелей в полу выплёскивается живая масса: многоножки, тараканы, белые слепые черви. Они лезут под одежду.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {r}d8 колющего", apply: (a, c) => hurt(a, `${c.rank}d8[piercing]`, 0.5, "Рой из трещин") },
      failure: { text: "{r}d8 колющего, тошнота 1", apply: async (a, c) => { await hurt(a, `${c.rank}d8[piercing]`, 1, "Рой из трещин"); await cond(a, "sickened", 1); } },
      criticalFailure: { text: "двойной урон, тошнота 2", apply: async (a, c) => { await hurt(a, `${c.rank}d8[piercing]`, 2, "Рой из трещин"); await cond(a, "sickened", 2); } },
    },
  },
  {
    id: "c16",
    name: "Кошмар наяву",
    img: "icons/svg/terror.svg",
    text: "Вы узнаёте этот коридор: он снился вам в детстве, в самом страшном сне. В конце его всё ещё кто-то ждёт.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "напуган 1", apply: (a) => cond(a, "frightened", 1) },
      failure: {
        text: "напуган 2, минуту слабость к ментальному {r}",
        apply: async (a, c) => { await cond(a, "frightened", 2); await fx(a, "Кошмар наяву", { img: "icons/svg/terror.svg", duration: minutes(1), rules: [{ key: "Weakness", type: "mental", value: c.rank }], desc: `Слабость к ментальному ${c.rank}.` }); },
      },
      criticalFailure: {
        text: "напуган 3, минуту слабость к ментальному {2r}",
        apply: async (a, c) => { await cond(a, "frightened", 3); await fx(a, "Кошмар наяву", { img: "icons/svg/terror.svg", duration: minutes(1), rules: [{ key: "Weakness", type: "mental", value: c.rank * 2 }], desc: `Слабость к ментальному ${c.rank * 2}.` }); },
      },
    },
  },
  {
    id: "c17",
    name: "Предсмертный крик",
    img: "icons/svg/sound.svg",
    text: "Где-то рядом кричит женщина — долго, на одной ноте, пока крик не обрывается. Уши заливает звон.",
    targets: "all",
    check: "fortitude",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {r}d8 звукового", apply: (a, c) => hurt(a, `${c.rank}d8[sonic]`, 0.5, "Предсмертный крик") },
      failure: { text: "{r}d8 звукового, оглох на минуту", apply: async (a, c) => { await hurt(a, `${c.rank}d8[sonic]`, 1, "Предсмертный крик"); await fx(a, "Предсмертный крик", { img: "icons/svg/deaf.svg", duration: minutes(1), conds: [["deafened"]], desc: "Оглох." }); } },
      criticalFailure: {
        text: "двойной урон, оглох на минуту, оглушён 1",
        apply: async (a, c) => { await hurt(a, `${c.rank}d8[sonic]`, 2, "Предсмертный крик"); await fx(a, "Предсмертный крик", { img: "icons/svg/deaf.svg", duration: minutes(1), conds: [["deafened"]], desc: "Оглох." }); await cond(a, "stunned", 1); },
      },
    },
  },
  {
    id: "c18",
    name: "Взбесившиеся вещи",
    img: "icons/svg/lightning.svg",
    text: "Стулья, подсвечники, осколки посуды взмывают в воздух и кружат по комнате. Полтергейст выбирает цели.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "половина {r}d8 дробящего", apply: (a, c) => hurt(a, `${c.rank}d8[bludgeoning]`, 0.5, "Взбесившиеся вещи") },
      failure: { text: "{r}d8 дробящего, сбит с ног", apply: async (a, c) => { await hurt(a, `${c.rank}d8[bludgeoning]`, 1, "Взбесившиеся вещи"); await cond(a, "prone"); } },
      criticalFailure: { text: "двойной урон, сбит с ног", apply: async (a, c) => { await hurt(a, `${c.rank}d8[bludgeoning]`, 2, "Взбесившиеся вещи"); await cond(a, "prone"); } },
    },
  },
  {
    id: "c19",
    name: "Одержимое оружие",
    img: "icons/svg/sword.svg",
    text: "Рукоять дёргается в ладони, как живая. Клинок хочет крови — и ему всё равно, чьей.",
    targets: "all",
    check: "reflex",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "удерживает оружие", apply: () => "удерживает оружие" },
      failure: { text: "оружие вырывается из рук", apply: (a) => dropWeapon(a) },
      criticalFailure: {
        text: "оружие вырывается и бьёт хозяина: {r}d6 колющего",
        apply: async (a, c) => { const t = await dropWeapon(a); await hurt(a, `${c.rank}d6[piercing]`, 1, "Одержимое оружие"); return t; },
      },
    },
  },
  {
    id: "c20",
    name: "Могильный зов",
    img: "icons/svg/sleep.svg",
    text: "Навалилась усталость, будто вы не спали неделю. Земля зовёт лечь. Всего на минуту. Навсегда.",
    targets: "all",
    check: "will",
    outcomes: {
      criticalSuccess: nothing,
      success: { text: "застигнут врасплох до конца следующего хода", apply: (a) => fx(a, "Могильный зов", { img: "icons/svg/sleep.svg", duration: rounds(1, "turn-end"), conds: [["offGuard"]], desc: "Застигнут врасплох: зевает." }) },
      failure: { text: "замедлен 1 до конца следующего хода", apply: (a) => fx(a, "Могильный зов", { img: "icons/svg/sleep.svg", duration: rounds(1, "turn-end"), conds: [["slowed", 1]], desc: "Замедлен 1." }) },
      criticalFailure: {
        text: "засыпает (без сознания) на 1 раунд или пока не получит урон",
        apply: (a) => fx(a, "Могильный зов — сон", { img: "icons/svg/unconscious.svg", duration: rounds(1, "turn-end"), rules: [{ key: "GrantItem", uuid: "Compendium.pf2e.conditionitems.Item.fBnFDH2MTzgFijKf" }], desc: "Спит. Урон или встряхивание союзником будят (удалите эффект)." }),
      },
    },
  },
];
