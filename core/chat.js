// Кнопки в сообщениях чата: <button data-hof-action="имя" data-...>.
// Подсистема регистрирует обработчик; data-gm-only прячет кнопку от игроков.
// Нажатая кнопка помечается во флаге сообщения и больше не активна.
import { ID } from "./settings.js";

const handlers = new Map();

export function registerChatAction(name, handler) {
  handlers.set(name, handler);
}

export function initChat() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    for (const btn of root.querySelectorAll("[data-hof-action]")) {
      if (btn.dataset.gmOnly !== undefined && !game.user.isGM) {
        btn.remove();
        continue;
      }
      const key = btn.dataset.hofKey ?? btn.dataset.hofAction;
      if (message.getFlag(ID, `used.${key}`)) {
        btn.disabled = true;
        btn.classList.add("hof-used");
        continue;
      }
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        const handler = handlers.get(btn.dataset.hofAction);
        if (!handler) return;
        btn.disabled = true;
        try {
          const done = await handler({ message, data: { ...btn.dataset }, button: btn });
          if (done !== false) await message.setFlag(ID, `used.${key}`, true);
          else btn.disabled = false;
        } catch (err) {
          btn.disabled = false;
          console.error(`${ID} | кнопка ${btn.dataset.hofAction}`, err);
          ui.notifications.error(`Сердце Фантазии: ${err.message}`);
        }
      });
    }
  });
}
