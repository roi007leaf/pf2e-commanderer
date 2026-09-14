import { FLAG_SCOPE } from "../constants.js";
import { ACTIVE_FEATS } from "../domain/feat-rules.js";
import { requestCommanderWorkflow } from "../foundry/feats.js";
import { owner } from "../foundry/workflow.js";

const workflowStates = new Map();

/** Resolve only an owned, current item from a non-roll native item post. */
export function featChatActions(message, user) {
  if (message.isRoll || message.rolls?.length || message.flags?.pf2e?.context) return [];
  const actor = message.actor;
  const posted = message.item;
  const item = actor?.items.get(posted?.id);
  if (!item || item.uuid !== posted.uuid || !owner(actor, user)) return [];
  const actions = [];
  const add = (id, label) => actions.push({ actor, id, label });
  if (ACTIVE_FEATS.has(item.slug)) add(item.id, `Use ${item.name}`);
  if (["guiding-shot", "set-up-strike"].includes(item.slug)) add("opening", "Resolve next attack opening");
  if (item.slug === "banner-twirl") add("twirl-check", "Ranged concealment flat check");
  if (item.slug === "piranha-assault") add("piranha", "Apply guided resistance bypass");
  if (["mountaineering-training", "naval-training", "shadows-in-the-moonlight"].includes(item.slug)) add("training", "Roll prepared training");
  if (item.getFlag?.(FLAG_SCOPE, "workflow")?.mercenary) add("mercenary-save", "Retry Mercenary Reversal save");
  return actions;
}

export function renderFeatChatActions(message, html) {
  const root = html?.[0] ?? html;
  root?.querySelectorAll(".commanderer-feat-actions").forEach((element) => element.remove());
  const card = root?.querySelector(".pf2e.chat-card.item-card");
  if (!card) return;
  const actions = featChatActions(message, game.user);
  if (!actions.length) return;
  const group = document.createElement("div");
  group.className = "commanderer-feat-actions";
  const status = document.createElement("p");
  status.className = "commanderer-feat-status";
  status.setAttribute("role", "status");
  const refresh = () => {
    const state = workflowStates.get(message.id);
    group.querySelectorAll("button").forEach(button => { button.disabled = state?.running === true; });
    status.textContent = state?.text ?? "Target any required creatures, then choose an action. Follow its prompts to finish.";
  };
  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `commanderer-card-button ${action.id === message.item?.id ? "primary" : "follow-up"}`;
    button.textContent = action.label;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (workflowStates.get(message.id)?.running) return;
      workflowStates.set(message.id, { running: true, text: game.user.isGM
        ? `${action.label}: in progress. Complete the open dialog to continue.`
        : `Waiting for ${game.users.activeGM?.name ?? "the active GM"} to complete the prompted steps.` });
      refresh();
      try {
        const current = featChatActions(message, game.user).find((entry) => entry.id === action.id);
        if (!current) throw new Error("This feat is unavailable or you no longer own its actor.");
        const result = await requestCommanderWorkflow(current.actor, current.id);
        workflowStates.set(message.id, { text: result ? `${action.label}: completed.` : `${action.label}: cancelled. Review any steps already completed.` });
      } catch (error) {
        workflowStates.set(message.id, { text: error.message });
        ui.notifications.error(error.message);
      }
      finally {
        // Refresh any chat popouts/rerenders as well as this original card.
        for (const element of document.querySelectorAll(`[data-message-id="${message.id}"]`)) renderFeatChatActions(message, element);
        refresh();
      }
    });
    group.append(button);
  }
  group.append(status);
  refresh();
  card.append(group);
}

export function registerFeatChatActions() {
  Hooks.on("renderChatMessageHTML", renderFeatChatActions);
  Hooks.on("deleteChatMessage", (message) => workflowStates.delete(message.id));
}
