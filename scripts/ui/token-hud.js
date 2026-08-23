import { MODULE_ID } from "../constants.js";
import { hasCommanderFeatures } from "../foundry/runtime.js";
import { openCommanderPanel } from "./panel.js";

const ACTION = `${MODULE_ID}-open`;

export function shouldShowCommanderHudButton(actor) {
  return actor?.isOwner === true && hasCommanderFeatures(actor);
}

function rootElement(html) {
  return html instanceof HTMLElement ? html : html?.[0] ?? null;
}

export function renderCommanderTokenHud(tokenHud, html, engine) {
  const actor = tokenHud?.object?.actor ?? tokenHud?.actor ?? null;
  if (!engine || !shouldShowCommanderHudButton(actor)) return;

  const root = rootElement(html);
  const column = root?.querySelector(".col.right");
  if (!column) return;
  column.querySelector(`[data-action="${ACTION}"]`)?.remove();

  const button = root.ownerDocument.createElement("button");
  button.type = "button";
  button.className = "control-icon commander-token-hud-button";
  button.dataset.action = ACTION;
  button.dataset.tooltip = "Open Commander";
  button.setAttribute("aria-label", "Open Commander");
  button.innerHTML = '<i class="fa-solid fa-flag" inert></i>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openCommanderPanel(actor, engine);
  });
  column.append(button);
}

export function registerCommanderTokenHud(getEngine) {
  Hooks.on("renderTokenHUD", (tokenHud, html) => {
    renderCommanderTokenHud(tokenHud, html, getEngine());
  });
}
