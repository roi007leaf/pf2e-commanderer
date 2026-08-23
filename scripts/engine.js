import { FLAG_SCOPE, MODULE_ID } from "./constants.js";
import { combatRoundKey, responseAllowed, selectionAllowed } from "./domain/rules.js";
import { tacticDefinition } from "./domain/tactics.js";
import { tacticDependsOnBannerAura } from "./domain/squad-readiness.js";
import { performResponse, swapTokenPositions } from "./foundry/actions.js";
import { requireTacticTarget } from "./foundry/tactic-movement.js";
import { formFromDialogSubmit } from "./foundry/dialog.js";
import { resolveTargets } from "./foundry/effects.js";
import { eligibleSquad, resolvedSquad } from "./foundry/squad.js";
import { bannerOrigin, bannerRangeToToken, plantedBanner } from "./foundry/banner.js";
import {
  actorCanUserModify,
  activeTokenFor,
  bannerActive,
  escapeHtml,
  hasDrilledReactions,
  notify,
  preparedTacticIds,
} from "./foundry/runtime.js";
import { registerOperation, requestOperation } from "./foundry/socket.js";
import { INVOCATION_CARD_VERSION, invocationViewModel } from "./ui/invocation-view-model.js";

const TEMPLATE = `modules/${MODULE_ID}/templates/invocation.hbs`;

async function renderInvocation(invocation) {
  return foundry.applications.handlebars.renderTemplate(TEMPLATE, invocationViewModel(invocation));
}

async function updateInvocationMessage(message, invocation) {
  await message.update({
    content: await renderInvocation(invocation),
    [`flags.${FLAG_SCOPE}.invocation`]: invocation,
  });
}

function requesterOwns(userId, actor) {
  const user = game.users.get(userId);
  return user?.isGM === true || actor?.testUserPermission?.(user, "OWNER") === true;
}

async function confirmOverride({ title, message, hint, action, icon }) {
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<div class="pf2e-commanderer-dialog">
      <p>${escapeHtml(message)}</p>
      <p class="hint">${escapeHtml(hint)}</p>
    </div>`,
    buttons: [
      { action: "confirm", label: action, icon, default: true },
      { action: "cancel", label: "Cancel" },
    ],
    default: "cancel",
  });
  return result === "confirm";
}

async function recordResponse(payload, userId) {
  const message = game.messages.get(payload.messageId);
  const invocation = foundry.utils.deepClone(message?.getFlag(FLAG_SCOPE, "invocation"));
  if (!message || !invocation) throw new Error("Tactic message no longer exists.");
  const participant = invocation.participants[payload.participantIndex];
  const actor = participant ? await fromUuid(participant.actorUuid) : null;
  if (!participant || !actor || !requesterOwns(userId, actor)) throw new Error("You do not own this squadmate.");
  if (participant.status !== "pending") throw new Error(`${participant.name} already answered this tactic.`);
  if (invocation.combat && combatRoundKey(game.combat) !== invocation.roundKey) throw new Error("This tactic card expired when the combat round changed.");

  if (payload.status === "responded") {
    if (actor.getFlag(FLAG_SCOPE, "lastResponseRound") !== invocation.roundKey) {
      throw new Error(`${participant.name}'s response was not reserved for this round.`);
    }
    if (payload.useDrilledReaction) {
      const commander = await fromUuid(invocation.commanderUuid);
      if (!hasDrilledReactions(commander) || !invocation.response.reaction || participant.commander) {
        throw new Error("Drilled Reactions cannot apply to this response.");
      }
      if (!responseAllowed(commander.getFlag(FLAG_SCOPE, "lastDrilledReactionRound"), invocation.roundKey)) {
        throw new Error("Drilled Reactions was already used this round.");
      }
      await commander.setFlag(FLAG_SCOPE, "lastDrilledReactionRound", invocation.roundKey);
      invocation.drilledUsedBy = participant.name;
    }
  }

  participant.status = payload.status;
  participant.result = payload.result ?? "";
  participant.manual = payload.manual === true;
  await updateInvocationMessage(message, invocation);
  return true;
}

async function resolveInvocation(payload, userId) {
  const message = game.messages.get(payload.messageId);
  const invocation = foundry.utils.deepClone(message?.getFlag(FLAG_SCOPE, "invocation"));
  if (!message || !invocation?.resolution) throw new Error("This tactic has no automated target resolution.");
  const commander = await fromUuid(invocation.commanderUuid);
  if (!requesterOwns(userId, commander)) throw new Error("Only the commander owner or GM can resolve targets.");
  const ignoreGeometry = payload.ignoreGeometry === true;
  const user = game.users.get(userId);
  if (ignoreGeometry && !user?.isGM) throw new Error("Only a GM can override tactic geometry.");
  if (invocation.resolutionResults?.length) throw new Error("This tactic card was already resolved.");
  if (invocation.participants.some((participant) => participant.status === "pending")) {
    throw new Error("Every selected squadmate must respond or decline before resolution.");
  }
  const results = await resolveTargets({
    commanderUuid: invocation.commanderUuid,
    itemUuid: invocation.tacticUuid,
    targetTokenUuids: payload.targetTokenUuids,
    participantRows: invocation.participants,
    squadRows: invocation.squad,
    resolution: invocation.resolution,
    ignoreGeometry,
  });
  invocation.resolutionResults = results;
  if (ignoreGeometry) {
    invocation.resolutionOverride = { mode: "geometry", userId, userName: user.name };
  }
  await updateInvocationMessage(message, invocation);
  return results;
}

async function resolveInvocationManually(payload, userId) {
  const message = game.messages.get(payload.messageId);
  const invocation = foundry.utils.deepClone(message?.getFlag(FLAG_SCOPE, "invocation"));
  if (!message || !invocation?.resolution) throw new Error("This tactic has no target resolution.");
  const commander = await fromUuid(invocation.commanderUuid);
  if (!requesterOwns(userId, commander)) throw new Error("Only the commander owner or GM can resolve targets.");
  if (invocation.resolutionResults?.length) throw new Error("This tactic card was already resolved.");
  if (invocation.participants.some((participant) => participant.status === "pending")) {
    throw new Error("Every selected squadmate must respond or decline before resolution.");
  }
  const user = game.users.get(userId);
  invocation.resolutionOverride = { mode: "manual", userId, userName: user?.name ?? "A user" };
  invocation.resolutionResults = [{
    name: "Order",
    degreeLabel: "Manual",
    applied: `resolved outside Commanderer by ${user?.name ?? "a user"}; no automated effects applied`,
  }];
  await updateInvocationMessage(message, invocation);
  return true;
}

async function designatedTargetFor(actor, definition) {
  if (!definition.designatedTarget) return null;
  const token = await requireTacticTarget(actor, definition.designatedTarget);
  if (definition.targetInAura) {
    const origin = bannerOrigin(actor);
    if (!origin || bannerRangeToToken(actor, token) > origin.radius) {
      throw new Error(`${token.name} must be inside the banner aura.`);
    }
  }
  return {
    tokenUuid: token.document.uuid,
    actorUuid: token.actor.uuid,
    name: token.name,
    img: token.document.texture?.src ?? token.actor.img,
  };
}

async function chooseInvocation(item, actor, definition, members, { bannerPlanted = false } = {}) {
  const brandish = item.system?.traits?.value?.includes("brandish") === true;
  const all = definition.selection === "all";
  const memberRows = members.map((member, index) => `
    <label class="commanderer-choice">
      ${all ? '<i class="fa-solid fa-check"></i>' : `<input type="checkbox" name="participant" value="${index}">`}
      <img src="${escapeHtml(member.img)}" alt="" width="28" height="28">
      <span>${escapeHtml(member.name)}${member.commander ? " (Commander)" : ""}</span>
    </label>`).join("");
  const signal = brandish
    ? '<input type="hidden" name="signal" value="visual"><p><i class="fa-solid fa-flag"></i> Brandish: visual banner signal.</p>'
    : bannerPlanted
      ? '<input type="hidden" name="signal" value="auditory"><p><i class="fa-solid fa-volume-high"></i> Planted banner: auditory signal required.</p>'
    : `<div class="form-group"><label>Signal</label><select name="signal">
        <option value="visual">Visual</option><option value="auditory">Auditory</option>
      </select></div>`;
  const tacticOptions = definition.response.kind === "shadows-in-the-moonlight"
    ? `<div class="form-group"><label>Actions spent</label><select name="actionCost"><option value="1">1 action - formation benefits</option><option value="2">2 actions - plus free Hide or Sneak</option></select></div>`
    : "";
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: item.name },
    content: `<div class="pf2e-commanderer-dialog">
      ${signal}
      ${tacticOptions}
      <p><strong>Responders:</strong> ${escapeHtml(definition.selection.replaceAll("-", " "))}</p>
      <div class="commanderer-choices">${memberRows}</div>
      <p class="hint">${escapeHtml(definition.response.instruction)}</p>
    </div>`,
    buttons: [
      {
        action: "issue",
        label: "Issue Tactic",
        icon: "fa-solid fa-bullhorn",
        default: true,
        callback: (_event, button, dialog) => {
          const form = formFromDialogSubmit(button, dialog);
          return {
            signal: form.elements.signal.value,
            actionCost: Number(form.elements.actionCost?.value ?? 0),
            indexes: all ? members.map((_member, index) => index) : [...form.querySelectorAll('input[name="participant"]:checked')].map((input) => Number(input.value)),
          };
        },
      },
      { action: "cancel", label: "Cancel" },
    ],
    default: "issue",
  });
  if (!result || result === "cancel") return null;
  if (!selectionAllowed(definition.selection, result.indexes.length, members.length)) {
    notify("warn", `Choose a valid number of responders (${definition.selection.replaceAll("-", " ")}).`);
    return null;
  }
  return result;
}

async function assignParticipantRoles(definition, response, members, indexes) {
  if (definition.response.kind === "shadows-in-the-moonlight" && response.actionCost === 2) {
    const selected = indexes.map((index) => ({ index, member: members[index] }));
    const choices = selected.map(({ index, member }) => `<label class="commanderer-choice"><input type="checkbox" name="bonus" value="${index}"><img src="${escapeHtml(member.img)}" alt="" width="28" height="28"><span>${escapeHtml(member.name)}</span></label>`).join("");
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: "Shadows in the Moonlight" },
      content: `<div class="pf2e-commanderer-dialog"><p>Choose up to two squadmates who can Hide or Sneak as a free action.</p><div class="commanderer-choices">${choices}</div></div>`,
      buttons: [{
        action: "assign",
        label: "Assign free actions",
        icon: "fa-solid fa-user-ninja",
        default: true,
        callback: (_event, button, dialog) => [...formFromDialogSubmit(button, dialog).querySelectorAll('input[name="bonus"]:checked')].map((input) => Number(input.value)),
      }, { action: "cancel", label: "Cancel" }],
      default: "assign",
    });
    if (!Array.isArray(result)) return null;
    if (result.length > 2) {
      notify("warn", "Choose no more than two squadmates for the free Hide or Sneak.");
      return null;
    }
    return new Map(result.map((index) => [index, "hide-sneak"]));
  }
  if (definition.response.kind !== "slip-and-sizzle") return new Map();
  const selected = indexes.map((index) => ({ index, member: members[index] }));
  const options = selected.map(({ index, member }) => `<option value="${index}">${escapeHtml(member.name)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Slip and Sizzle roles" },
    content: `<div class="pf2e-commanderer-dialog"><div class="form-group"><label>Trip responder</label><select name="tripper">${options}</select></div><p class="hint">The other selected squadmate becomes the spellcaster.</p></div>`,
    buttons: [{
      action: "assign",
      label: "Assign roles",
      icon: "fa-solid fa-people-arrows-left-right",
      default: true,
      callback: (_event, button, dialog) => Number(formFromDialogSubmit(button, dialog).elements.tripper.value),
    }, { action: "cancel", label: "Cancel" }],
    default: "assign",
  });
  if (!Number.isInteger(result)) return null;
  return new Map(selected.map(({ index }) => [index, index === result ? "trip" : "spell"]));
}

export class CommanderEngine {
  constructor() {
    registerOperation("record-response", recordResponse);
    registerOperation("resolve-invocation", resolveInvocation);
    registerOperation("resolve-invocation-manually", resolveInvocationManually);
    registerOperation("swap-tokens", swapTokenPositions);
  }

  async execute(item, actor) {
    if (!item || item.actor?.uuid !== actor?.uuid) throw new Error("Use an embedded tactic from the commander.");
    if (!actorCanUserModify(actor)) throw new Error("You do not own this commander.");
    const prepared = preparedTacticIds(actor);
    if (!prepared.has(item.id)) throw new Error(`${item.name} is not prepared.`);
    const remaining = item.system?.frequency?.value;
    if (Number.isFinite(remaining) && remaining <= 0) throw new Error(`${item.name} has no uses remaining.`);

    const definition = tacticDefinition(item.slug);
    const response = {
      ...definition.response,
      reaction: definition.response.reaction ?? /\breaction\b/i.test(item.system?.description?.value ?? ""),
    };
    const brandish = item.system?.traits?.value?.includes("brandish") === true;
    const bannerIsPlanted = Boolean(plantedBanner(actor));
    if (brandish && !bannerActive(actor)) throw new Error(`${item.name} requires the commander's banner to be displayed.`);
    if (brandish && bannerIsPlanted) throw new Error(`${item.name} has the brandish trait and cannot be used while the banner is planted.`);
    if (tacticDependsOnBannerAura(definition) && !bannerActive(actor)) {
      throw new Error(`${item.name} requires the commander's banner aura to be active.`);
    }
    const designatedTarget = await designatedTargetFor(actor, definition);
    if (designatedTarget) {
      response.targetUuid = designatedTarget.tokenUuid;
      response.targetName = designatedTarget.name;
    }
    if (definition.response.kind === "shadows-in-the-moonlight") response.actionCost = null;
    const members = (await eligibleSquad(actor, definition))
      .filter((member) => !definition.excludeDesignatedTarget || member.actorUuid !== designatedTarget?.actorUuid);
    if (!members.length) throw new Error(definition.aura ? "No squadmates are within the banner's 30-foot aura." : "No squadmates are available.");
    const choice = await chooseInvocation(item, actor, definition, members, { bannerPlanted: bannerIsPlanted });
    if (!choice) return null;
    if (definition.response.kind === "shadows-in-the-moonlight") response.actionCost = choice.actionCost || 1;
    const participantRoles = await assignParticipantRoles(definition, response, members, choice.indexes);
    if (participantRoles == null) return null;

    const roundKey = combatRoundKey(game.combat);
    const participants = choice.indexes.map((index) => members[index]).map((member, participantIndex) => ({
      actorUuid: member.actorUuid,
      tokenUuid: member.tokenUuid,
      name: member.name,
      img: member.img,
      commander: member.commander === true,
      role: participantRoles.get(choice.indexes[participantIndex]) ?? null,
      status: "pending",
      result: "",
    }));
    const squad = (await resolvedSquad(actor)).map((member) => ({
      actorUuid: member.actorUuid,
      tokenUuid: member.tokenUuid,
      name: member.name,
    }));
    const invocation = {
      version: 1,
      commanderUuid: actor.uuid,
      commanderName: actor.name,
      bannerOriginTokenUuid: activeTokenFor(actor)?.document?.uuid ?? null,
      tacticUuid: item.uuid,
      tacticName: item.name,
      tacticImg: item.img,
      tacticSlug: item.slug,
      signal: choice.signal,
      roundKey,
      combat: game.combat ? { id: game.combat.id, round: game.combat.round, turn: game.combat.turn } : null,
      authorityUserId: game.user.id,
      response,
      designatedTarget,
      resolution: definition.resolve ?? null,
      participants,
      squad,
      drilledAvailable: hasDrilledReactions(actor) && response.reaction === true,
      drilledUsedBy: null,
      resolutionResults: [],
    };
    const message = await ChatMessage.create({
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: await renderInvocation(invocation),
      flags: { [FLAG_SCOPE]: { invocation } },
    });
    if (Number.isFinite(remaining)) await item.update({ "system.frequency.value": Math.max(0, remaining - 1) });
    return message;
  }

  async answer(messageId, participantIndex, { declined = false, manual = false, useDrilledReaction = false } = {}) {
    const message = game.messages.get(messageId);
    const invocation = message?.getFlag(FLAG_SCOPE, "invocation");
    const participant = invocation?.participants?.[participantIndex];
    const actor = participant ? await fromUuid(participant.actorUuid) : null;
    if (!message || !participant || !actor) throw new Error("This tactic response is no longer available.");
    if (!actorCanUserModify(actor)) throw new Error(`You do not own ${participant.name}.`);
    if (participant.status !== "pending") throw new Error(`${participant.name} already answered.`);
    if (invocation.combat && combatRoundKey(game.combat) !== invocation.roundKey) {
      throw new Error("This tactic card expired when the combat round changed.");
    }
    if (!declined && invocation.response.kind === "slip-and-sizzle" && participant.role === "spell") {
      const tripper = invocation.participants.find((candidate) => candidate.role === "trip");
      if (tripper?.status !== "responded") throw new Error("The Trip responder must finish first. Decline the spell response if the Trip failed.");
    }
    if (declined) {
      return requestOperation("record-response", { messageId, participantIndex, status: "declined", result: "declined" }, { authorityUserId: invocation.authorityUserId });
    }
    if (!responseAllowed(actor.getFlag(FLAG_SCOPE, "lastResponseRound"), invocation.roundKey)) {
      throw new Error(`${participant.name} already responded to a tactic this round.`);
    }
    let result;
    if (manual) {
      const confirmed = await confirmOverride({
        title: `Complete ${invocation.tacticName} manually`,
        message: `Confirm that ${participant.name} completed this response outside Commanderer.`,
        hint: "No action, movement, Strike, or effect automation will run. The response still counts for this round.",
        action: "Mark completed",
        icon: "fa-solid fa-hand",
      });
      if (!confirmed) return false;
      result = "completed manually; automation skipped";
    } else {
      const commander = await fromUuid(invocation.commanderUuid);
      const item = await fromUuid(invocation.tacticUuid);
      result = await performResponse({
        actor,
        commander,
        item,
        response: invocation.response,
        role: participant.role,
        tokenUuid: participant.tokenUuid,
        commanderTokenUuid: invocation.bannerOriginTokenUuid,
      });
    }
    if (result == null) return false;
    await actor.setFlag(FLAG_SCOPE, "lastResponseRound", invocation.roundKey);
    try {
      return await requestOperation("record-response", {
        messageId,
        participantIndex,
        status: "responded",
        result,
        manual,
        useDrilledReaction,
      }, { authorityUserId: invocation.authorityUserId });
    } catch (error) {
      if (actor.getFlag(FLAG_SCOPE, "lastResponseRound") === invocation.roundKey) await actor.unsetFlag(FLAG_SCOPE, "lastResponseRound");
      throw error;
    }
  }

  async resolve(messageId, { ignoreGeometry = false } = {}) {
    const message = game.messages.get(messageId);
    const invocation = message?.getFlag(FLAG_SCOPE, "invocation");
    if (!invocation) throw new Error("Tactic message no longer exists.");
    const useDesignatedTarget = Boolean(invocation.designatedTarget?.tokenUuid && invocation.resolution?.maxTargets === 1);
    const targetTokenUuids = useDesignatedTarget
      ? [invocation.designatedTarget.tokenUuid]
      : [...game.user.targets].map((token) => token.document.uuid);
    if (!targetTokenUuids.length) throw new Error("Target the affected enemy token or tokens first.");
    if (ignoreGeometry) {
      if (!game.user.isGM) throw new Error("Only a GM can override tactic geometry.");
      const confirmed = await confirmOverride({
        title: `Override ${invocation.tacticName} geometry`,
        message: "Run the normal save and effect automation for the selected targets without formation or distance enforcement?",
        hint: "Target count and enemy/creature restrictions remain enforced. This override is recorded on the card.",
        action: "Resolve anyway",
        icon: "fa-solid fa-shield-halved",
      });
      if (!confirmed) return false;
    }
    return requestOperation("resolve-invocation", { messageId, targetTokenUuids, ignoreGeometry }, {
      authorityUserId: invocation.authorityUserId,
      gmRequired: !game.user.isGM,
    });
  }

  async resolveManually(messageId) {
    const message = game.messages.get(messageId);
    const invocation = message?.getFlag(FLAG_SCOPE, "invocation");
    if (!invocation) throw new Error("Tactic message no longer exists.");
    const confirmed = await confirmOverride({
      title: `Handle ${invocation.tacticName} manually`,
      message: "Close automated target resolution and handle its remaining rolls and effects yourself?",
      hint: "Commander will record the manual handoff but will not change any targets, rolls, conditions, or effects.",
      action: "Handle manually",
      icon: "fa-solid fa-hand-paper",
    });
    if (!confirmed) return false;
    return requestOperation("resolve-invocation-manually", { messageId }, {
      authorityUserId: invocation.authorityUserId,
      gmRequired: !game.user.isGM,
    });
  }
}

export function activateChatCards(engine) {
  Hooks.on("renderChatMessageHTML", async (message, html) => {
    const invocation = message.getFlag(FLAG_SCOPE, "invocation");
    if (!invocation) return;
    const root = html instanceof HTMLElement ? html : html[0];
    root.classList.add("pf2e-commanderer-message");
    const content = root.matches?.(".message-content") ? root : root.querySelector(".message-content");
    const currentCard = content?.querySelector(`[data-commanderer-card-version="${INVOCATION_CARD_VERSION}"]`);
    if (content && !currentCard) content.innerHTML = await renderInvocation(invocation);
    for (const button of root.querySelectorAll("[data-commanderer-action]")) {
      const action = button.dataset.commandererAction;
      const index = Number(button.dataset.participantIndex);
      if (action === "force-resolve") {
        button.hidden = !game.user.isGM;
      } else if (action === "resolve" || action === "manual-resolve") {
        const commander = await fromUuid(invocation.commanderUuid);
        if (!actorCanUserModify(commander)) button.hidden = true;
      } else {
        const participant = invocation.participants[index];
        const actor = participant ? await fromUuid(participant.actorUuid) : null;
        if (!actorCanUserModify(actor)) button.hidden = true;
      }
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          if (action === "resolve") await engine.resolve(message.id);
          else if (action === "force-resolve") await engine.resolve(message.id, { ignoreGeometry: true });
          else if (action === "manual-resolve") await engine.resolveManually(message.id);
          else {
            const completed = await engine.answer(message.id, index, {
              declined: action === "decline",
              manual: action === "manual-response",
              useDrilledReaction: action === "respond-drilled",
            });
            if (completed === false) button.disabled = false;
          }
        } catch (error) {
          console.error(`${MODULE_ID} | Chat card action`, error);
          notify("error", error.message);
          button.disabled = false;
        }
      });
    }
  });
}
