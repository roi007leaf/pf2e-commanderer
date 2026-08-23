import { gatherMovementModes } from "../domain/gather-movement.js";
import { movementBudget, movementDestinationVerdict } from "../domain/tactic-movement.js";
import { showGatherGuidance } from "../canvas/banner-overlay.js";
import { formFromDialogSubmit } from "./dialog.js";
import { startGatherMovementPlanning } from "./gather-movement.js";
import { bannerOrigin, bannerRangeToToken } from "./banner.js";
import { activeTokenFor, notify } from "./runtime.js";
import { storedSquad } from "./squad.js";

async function tokenFor(actor, tokenUuid) {
  const document = tokenUuid ? await globalThis.fromUuid(tokenUuid) : null;
  return document?.object ?? activeTokenFor(actor);
}

function actorIsEnemy(actor, other) {
  if (!other || actor.uuid === other.uuid) return false;
  if (typeof actor.isEnemyOf === "function") return actor.isEnemyOf(other);
  return actor.alliance != null && other.alliance != null && actor.alliance !== other.alliance;
}

function actorIsAlly(actor, other) {
  if (!other || actor.uuid === other.uuid) return false;
  if (typeof actor.isAllyOf === "function") return actor.isAllyOf(other);
  return actor.alliance != null && actor.alliance === other.alliance;
}

export async function requireTacticTarget(actor, type, targetUuid = null) {
  const fixedTarget = targetUuid ? (await globalThis.fromUuid(targetUuid))?.object : null;
  if (targetUuid && !fixedTarget) throw new Error("The designated target is not on the active scene.");
  const targets = (fixedTarget ? [fixedTarget] : [...(globalThis.game?.user?.targets ?? [])])
    .filter((token) => type === "enemy"
      ? actorIsEnemy(actor, token.actor)
      : type === "ally" ? actorIsAlly(actor, token.actor) : token.actor && token.actor.uuid !== actor.uuid);
  const label = type === "enemy" ? "enemy" : type === "ally" ? "allied" : "other creature";
  if (targets.length !== 1) throw new Error(`Target exactly one ${label} token before responding.`);
  if (fixedTarget) fixedTarget.setTarget?.(true, { releaseOthers: true });
  return targets[0];
}

async function chooseMovementMode(actor, title, modes) {
  if (!modes.length) throw new Error(`${actor.name} has no usable movement Speed.`);
  if (modes.length === 1) return modes[0];
  const options = modes.map((mode, index) =>
    `<option value="${index}">${mode.label} — ${mode.speed} feet</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `<div class="pf2e-commanderer-dialog">
      <div class="form-group"><label>Movement</label><select name="movement">${options}</select></div>
      <p class="hint">Choose the Speed used for this granted movement.</p>
    </div>`,
    buttons: [{
      action: "continue",
      label: "Plot Movement",
      icon: "fa-solid fa-route",
      default: true,
      callback: (_event, button, dialog) => Number(formFromDialogSubmit(button, dialog).elements.movement.value),
    }, { action: "cancel", label: "Cancel" }],
    default: "continue",
  });
  return Number.isInteger(result) ? modes[result] : null;
}

function planWaypoints(plan) {
  if (Array.isArray(plan?.waypoints) && plan.waypoints.length) return plan.waypoints;
  return plan?.destination ? [plan.destination] : [];
}

function planCost(token, plan) {
  const measurement = token.document?.measureMovementPath?.(planWaypoints(plan));
  const cost = Number(measurement?.cost ?? measurement?.distance);
  return Number.isFinite(cost) ? cost : NaN;
}

function virtualTokenAt(token, destination) {
  const bounds = token.mechanicalBounds ?? token.bounds;
  const x = Number(destination?.x ?? bounds.x);
  const y = Number(destination?.y ?? bounds.y);
  const width = Number(bounds.width ?? token.w);
  const height = Number(bounds.height ?? token.h);
  const Rectangle = globalThis.PIXI?.Rectangle;
  return {
    actor: token.actor,
    document: { elevation: destination?.elevation ?? token.document?.elevation ?? 0 },
    mechanicalBounds: Rectangle ? new Rectangle(x, y, width, height) : { x, y, width, height },
  };
}

function distanceAt(movingToken, targetToken, destination = null) {
  if (!destination) return movingToken.distanceTo(targetToken);
  return targetToken.distanceTo(virtualTokenAt(movingToken, destination));
}

function hostileTokens(actor) {
  return (globalThis.canvas?.tokens?.placeables ?? [])
    .filter((token) => token?.isVisible !== false && actorIsEnemy(actor, token.actor));
}

function maximumStrikeReach(actor, mode) {
  const reaches = (actor.system?.actions ?? [])
    .filter((action) => action.type === "strike" && action.ready !== false)
    .filter((action) => {
      const item = action.item;
      const melee = item?.isMelee ?? item?.system?.range == null;
      if (!melee) return false;
      if (mode !== "piercing-slashing-melee") return true;
      const damageType = item?.system?.damage?.damageType ?? item?.system?.damage?.type;
      return ["piercing", "slashing"].includes(damageType);
    })
    .map((action) => Number(actor.getReach?.({ action: "attack", weapon: action.item }) ?? 5))
    .filter(Number.isFinite);
  return reaches.length ? Math.max(...reaches) : null;
}

function validateSquadmateTarget(commander, target, { targetInAura = false } = {}) {
  const drilled = target.actor.uuid === commander.uuid
    || storedSquad(commander).some((member) => member.actorUuid === target.actor.uuid);
  if (!drilled) throw new Error(`${target.name} is not in ${commander.name}'s squad.`);
  if (targetInAura) {
    const origin = bannerOrigin(commander);
    if (!origin || bannerRangeToToken(commander, target) > origin.radius) {
      throw new Error(`${target.name} must be inside the banner aura.`);
    }
  }
}

export async function performTacticMovement({ actor, commander, item, tokenUuid, targetUuid, step } = {}) {
  const movingToken = await tokenFor(actor, tokenUuid);
  if (!movingToken) throw new Error(`${actor.name} needs a token on the active scene.`);
  if (typeof movingToken.planMovement !== "function" || typeof movingToken.document?.startMovement !== "function") {
    throw new Error("Foundry's native movement planner is unavailable.");
  }

  const target = step.target ? await requireTacticTarget(actor, step.target, targetUuid) : null;
  if (target && step.squadmate) validateSquadmateTarget(commander, target, step);
  const targetReach = step.requireInReach ? maximumStrikeReach(actor, step.requireInReach) : null;
  if (step.requireInReach && !Number.isFinite(targetReach)) {
    throw new Error(`${actor.name} has no ready Strike that qualifies for this tactic.`);
  }
  const allowedActions = step.modes === "all"
    ? Object.keys(globalThis.CONFIG?.Token?.movement?.actions ?? {})
    : ["walk"];
  const mode = await chooseMovementMode(actor, item?.name ?? "Commander Tactic", gatherMovementModes(actor, allowedActions));
  if (!mode) return null;
  const gridDistance = Number(globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  const budget = movementBudget(mode.speed, step.allowance, gridDistance);
  const enemies = step.relation === "away-from-enemy" ? hostileTokens(actor) : [];
  const originTargetDistance = target ? distanceAt(movingToken, target) : NaN;
  const hostileOriginDistances = enemies.map((enemy) => distanceAt(movingToken, enemy));
  const clearGuidance = showGatherGuidance(null, null, movingToken);

  notify("info", `${item?.name ?? "Tactic"}: drag ${movingToken.name ?? actor.name}'s highlighted token, then release to submit a path up to ${budget} feet. Escape cancels.`);
  try {
    while (true) {
      const plan = await startGatherMovementPlanning(movingToken, {
        allowedActions: [mode.action],
        maxCost: budget,
        maxDistance: budget,
        preventDrop: true,
      });
      if (!plan) return null;
      const waypoints = planWaypoints(plan);
      const destination = plan.destination ?? waypoints.at(-1);
      const destinationTargetDistance = target ? distanceAt(movingToken, target, destination) : NaN;
      const verdict = movementDestinationVerdict({
        relation: step.relation,
        originTargetDistance,
        destinationTargetDistance,
        pathTargetDistances: target ? waypoints.map((point) => distanceAt(movingToken, target, point)) : [],
        hostileOriginDistances,
        hostileDestinationDistances: enemies.map((enemy) => distanceAt(movingToken, enemy, destination)),
        requireAdjacent: step.requireAdjacent,
        maximumTargetDistance: targetReach,
        gridDistance,
      });
      if (!verdict.valid) {
        movingToken.layer?._cancelMovementPlanning?.();
        notify("warn", verdict.message);
        continue;
      }
      const cost = planCost(movingToken, plan);
      const moved = await movingToken.document.startMovement(plan.id);
      if (!moved) throw new Error(`${item?.name ?? "Tactic"} movement stopped before completion.`);
      return `moved ${Math.round(cost)} feet (${mode.label})`;
    }
  } finally {
    movingToken.layer?._cancelMovementPlanning?.();
    clearGuidance();
  }
}
