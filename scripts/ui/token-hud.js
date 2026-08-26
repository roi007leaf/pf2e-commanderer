import { MODULE_ID } from "../constants.js";
import {
  carriedBanners,
  removableEnemyBanners,
  requestCarriedBannerDrop,
  requestEnemyBannerRemoval,
} from "../foundry/banner.js";
import { hasCommanderFeatures, notify } from "../foundry/runtime.js";
import { openCommanderPanel } from "./panel.js";

const ACTION = `${MODULE_ID}-open`;
const REMOVE_ACTION = `${MODULE_ID}-remove-banner`;
const DROP_ACTION = `${MODULE_ID}-drop-banner`;

export function shouldShowCommanderHudButton(actor) {
  return actor?.isOwner === true && hasCommanderFeatures(actor);
}

function rootElement(html) {
  return html instanceof HTMLElement ? html : html?.[0] ?? null;
}

async function chooseBannerRemovalMode(commander) {
  const name = foundry.utils.escapeHTML(commander.name);
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Remove planted banner" },
    content: `<div class="pf2e-commanderer-dialog">
      <p>How does this creature use its <strong>Interact</strong> action on <strong>${name}'s banner</strong>?</p>
      <div class="commanderer-banner-removal-options">
        <div><i class="fa-solid fa-arrow-down"></i><span><strong>Pull Down</strong><small>Leave it where it was planted.</small></span></div>
        <div><i class="fa-solid fa-hand-fist"></i><span><strong>Take Banner</strong><small>Carry it away with this token.</small></span></div>
      </div>
      <p class="hint">Either choice ends every banner benefit until the Commander retrieves it.</p>
    </div>`,
    buttons: [
      { action: "dropped", label: "Pull Down", icon: "fa-solid fa-arrow-down", default: true },
      { action: "carried", label: "Take Banner", icon: "fa-solid fa-hand-fist" },
      { action: "cancel", label: "Cancel" },
    ],
    default: "dropped",
  });
  return result === "dropped" || result === "carried" ? result : null;
}

function addRemoveBannerButton(column, token, { commander, placement }) {
  const button = column.ownerDocument.createElement("button");
  button.type = "button";
  button.className = "control-icon commander-remove-banner-hud-button";
  button.dataset.action = `${REMOVE_ACTION}-${placement.actorId}`;
  button.dataset.commandererBannerRemove = "true";
  button.dataset.tooltip = `Remove ${commander.name}'s banner (Interact)`;
  button.setAttribute("aria-label", `Remove ${commander.name}'s banner with Interact`);
  button.innerHTML = '<i class="fa-solid fa-flag" inert></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const mode = await chooseBannerRemovalMode(commander);
    if (!mode) return;
    button.disabled = true;
    try {
      await requestEnemyBannerRemoval(token, placement.actorId, mode);
      button.remove();
      const result = mode === "carried" ? "taken" : "pulled down";
      notify("info", `${commander.name}'s banner ${result}. Its benefits are inactive until retrieved.`);
    } catch (error) {
      console.error(`${MODULE_ID} | Remove enemy banner`, error);
      notify("error", error.message);
      button.disabled = false;
    }
  });
  column.append(button);
}

function addDropBannerButton(column, token, { commander, placement }) {
  const ownerName = commander?.name ?? "the Commander";
  const button = column.ownerDocument.createElement("button");
  button.type = "button";
  button.className = "control-icon commander-drop-banner-hud-button";
  button.dataset.action = `${DROP_ACTION}-${placement.actorId}`;
  button.dataset.commandererBannerDrop = "true";
  button.dataset.tooltip = `Drop ${ownerName}'s banner (Release)`;
  button.setAttribute("aria-label", `Drop ${ownerName}'s banner`);
  button.innerHTML = '<i class="fa-solid fa-arrow-down" inert></i>';
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    button.disabled = true;
    try {
      await requestCarriedBannerDrop(token, placement.actorId);
      button.remove();
      notify("info", `${ownerName}'s banner dropped at this token's position.`);
    } catch (error) {
      console.error(`${MODULE_ID} | Drop carried banner`, error);
      notify("error", error.message);
      button.disabled = false;
    }
  });
  column.append(button);
}

export function renderCommanderTokenHud(tokenHud, html, engine) {
  const root = rootElement(html);
  const column = root?.querySelector(".col.right");
  if (!column) return;
  const token = tokenHud?.object?.document
    ? tokenHud.object
    : tokenHud?.object?.object ?? null;
  const actor = token?.actor ?? tokenHud?.actor ?? null;
  column.querySelector(`[data-action="${ACTION}"]`)?.remove();
  for (const button of column.querySelectorAll("[data-commanderer-banner-remove]")) button.remove();
  for (const button of column.querySelectorAll("[data-commanderer-banner-drop]")) button.remove();

  if (engine && shouldShowCommanderHudButton(actor)) {
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

  for (const option of removableEnemyBanners(token)) addRemoveBannerButton(column, token, option);
  for (const option of carriedBanners(token)) addDropBannerButton(column, token, option);
}

export function registerCommanderTokenHud(getEngine) {
  Hooks.on("renderTokenHUD", (tokenHud, html) => {
    renderCommanderTokenHud(tokenHud, html, getEngine());
  });
}
