import { gatherDestinationVerdict, gatherMovementModes } from "../domain/gather-movement.js";
import { bannerRangeToBounds } from "../domain/banner-placement.js";
import { showGatherGuidance } from "../canvas/banner-overlay.js";
import { bannerOrigin, bannerRangeToToken } from "./banner.js";
import { formFromDialogSubmit } from "./dialog.js";
import { activeTokenFor, notify } from "./runtime.js";

async function tokenFor(actor, tokenUuid) {
  const document = tokenUuid ? await fromUuid(tokenUuid) : null;
  return document?.object ?? activeTokenFor(actor);
}

async function chooseMovementMode(actor) {
  const allowedActions = Object.keys(globalThis.CONFIG?.Token?.movement?.actions ?? {});
  const modes = gatherMovementModes(actor, allowedActions);
  if (!modes.length) throw new Error(`${actor.name} has no movement Speed usable with Gather to Me!.`);
  if (modes.length === 1) return modes[0];

  const options = modes.map((mode, index) =>
    `<option value="${index}">${mode.label} — ${mode.speed} feet</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "Gather to Me!" },
    content: `<div class="pf2e-commanderer-dialog">
      <div class="form-group"><label>Movement</label><select name="movement">${options}</select></div>
      <p class="hint">Choose the Speed this squadmate will use for the granted movement.</p>
    </div>`,
    buttons: [
      {
        action: "continue",
        label: "Plot Movement",
        icon: "fa-solid fa-route",
        default: true,
        callback: (_event, button, dialog) => Number(formFromDialogSubmit(button, dialog).elements.movement.value),
      },
      { action: "cancel", label: "Cancel" },
    ],
    default: "continue",
  });
  return Number.isInteger(result) ? modes[result] : null;
}

function planWaypoints(plan) {
  if (Array.isArray(plan?.waypoints) && plan.waypoints.length) return plan.waypoints;
  return plan?.destination ? [plan.destination] : [];
}

function planCost(token, plan) {
  const waypoints = planWaypoints(plan);
  const measurement = token.document?.measureMovementPath?.(waypoints);
  const cost = Number(measurement?.cost ?? measurement?.distance);
  return Number.isFinite(cost) ? cost : NaN;
}

function destinationDistance(origin, movingToken, destination) {
  if (!origin.planted && origin.token.id === movingToken.id) return 0;
  const bounds = movingToken.mechanicalBounds ?? movingToken.bounds;
  const x = Number(destination?.x ?? bounds.x);
  const y = Number(destination?.y ?? bounds.y);
  const width = Number(bounds.width ?? movingToken.w);
  const height = Number(bounds.height ?? movingToken.h);
  const Rectangle = globalThis.PIXI?.Rectangle;
  const mechanicalBounds = Rectangle
    ? new Rectangle(x, y, width, height)
    : { x, y, width, height };
  if (origin.planted) {
    return bannerRangeToBounds(origin, mechanicalBounds, {
      gridSize: canvas.grid?.size ?? canvas.dimensions?.size ?? 100,
      gridDistance: canvas.scene?.grid?.distance ?? canvas.dimensions?.distance ?? 5,
    });
  }
  return origin.token.distanceTo({
      actor: movingToken.actor,
      document: { elevation: destination?.elevation ?? movingToken.document?.elevation ?? 0 },
      mechanicalBounds,
    });
}

function directRouteToBanner(movingToken, origin) {
  if (!origin.planted && movingToken.id === origin.token.id) return true;
  if (typeof movingToken.checkCollision !== "function") return true;
  try {
    return !movingToken.checkCollision(origin.planted ? { x: origin.x, y: origin.y } : origin.token.center, {
      type: "move",
      mode: "any",
      origin: movingToken.center,
    });
  } catch (_error) {
    return true;
  }
}

function cancelMovementPlanning(token) {
  token?.layer?._cancelMovementPlanning?.();
}

export function startGatherMovementPlanning(token, options) {
  token.layer?.activate?.({ tool: "select" });
  token.control?.({ releaseOthers: true, force: true });
  const planning = token.planMovement(options);
  const context = token.layer?._movementPlanningContext;
  if (token.layer && "_movementPlanningContext" in token.layer && context?.object !== token) {
    Promise.resolve(planning).catch(() => {});
    throw new Error("Foundry could not start token movement planning. Make sure the scene is unpaused and the token is unlocked.");
  }
  return planning;
}

export async function performGatherMovement({ actor, commander, tokenUuid, commanderTokenUuid } = {}) {
  const movingToken = await tokenFor(actor, tokenUuid);
  const commanderToken = await tokenFor(commander, commanderTokenUuid);
  const origin = bannerOrigin(commander);
  if (!movingToken) throw new Error(`${actor.name} needs a token on the active scene for Gather to Me!.`);
  if (!origin) throw new Error(`${commander.name} needs a banner origin on the active scene for Gather to Me!.`);
  if (typeof movingToken.planMovement !== "function" || typeof movingToken.document?.startMovement !== "function") {
    throw new Error("Foundry's native movement planner is unavailable.");
  }

  const mode = await chooseMovementMode(actor);
  if (!mode) return null;
  const clearGuidance = showGatherGuidance(commanderToken, commander, movingToken);
  const originDistance = bannerRangeToToken(commander, movingToken);
  const gridDistance = Number(canvas.scene?.grid?.distance ?? canvas.dimensions?.distance ?? 5);

  notify("info", `Gather to Me!: drag ${movingToken.name ?? actor.name}'s highlighted token, then release to submit a path up to ${mode.speed} feet. Escape cancels.`);
  try {
    while (true) {
      const plan = await startGatherMovementPlanning(movingToken, {
        allowedActions: [mode.action],
        maxCost: mode.speed,
        maxDistance: mode.speed,
        preventDrop: true,
      });
      if (!plan) return null;

      const cost = planCost(movingToken, plan);
      const destination = plan.destination ?? planWaypoints(plan).at(-1);
      const destinationRange = destinationDistance(origin, movingToken, destination);
      const verdict = gatherDestinationVerdict({
        originDistance,
        destinationDistance: destinationRange,
        auraRadius: origin.radius,
        speed: mode.speed,
        pathCost: cost,
        gridDistance,
        directRoute: directRouteToBanner(movingToken, origin),
      });
      if (!verdict.valid) {
        cancelMovementPlanning(movingToken);
        notify("warn", verdict.message);
        continue;
      }

      const moved = await movingToken.document.startMovement(plan.id);
      if (!moved) throw new Error("Gather to Me! movement was stopped before completion.");
      const outcome = verdict.code === "inside-aura" ? "inside the banner aura" : "as close to the banner aura as Speed allowed";
      return `moved ${outcome} (${mode.label}, ${Math.round(cost)} feet)`;
    }
  } finally {
    cancelMovementPlanning(movingToken);
    clearGuidance();
  }
}
