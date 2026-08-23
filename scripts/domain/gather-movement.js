const MOVEMENT_MODES = Object.freeze([
  { speedKey: "land", action: "walk", label: "Stride", icon: "fa-person-walking" },
  { speedKey: "burrow", action: "burrow", label: "Burrow", icon: "fa-person-digging" },
  { speedKey: "climb", action: "climb", label: "Climb", icon: "fa-mountain" },
  { speedKey: "fly", action: "fly", label: "Fly", icon: "fa-feather-pointed" },
  { speedKey: "swim", action: "swim", label: "Swim", icon: "fa-person-swimming" },
]);

export function gatherMovementModes(actor, allowedActions = null) {
  const speeds = actor?.system?.movement?.speeds ?? {};
  const allowed = allowedActions ? new Set(allowedActions) : null;
  return MOVEMENT_MODES.flatMap((mode) => {
    const speed = Number(speeds[mode.speedKey]?.value ?? 0);
    return speed > 0 && (!allowed || allowed.has(mode.action)) ? [{ ...mode, speed }] : [];
  });
}

/**
 * Pure rules verdict for Gather to Me!'s destination.
 * Foundry's native planner separately enforces path cost, terrain, and movement mode.
 */
export function gatherDestinationVerdict({
  originDistance,
  destinationDistance,
  auraRadius = 30,
  speed,
  pathCost,
  gridDistance = 5,
  directRoute = true,
} = {}) {
  const origin = Number(originDistance);
  const destination = Number(destinationDistance);
  const budget = Number(speed);
  const cost = Number(pathCost);
  const tolerance = Math.max(0.5, Number(gridDistance) / 2 || 0.5);

  if (![origin, destination, budget, cost].every(Number.isFinite)) {
    return { valid: false, code: "unmeasurable", message: "Could not measure this movement path." };
  }
  if (destination <= auraRadius) return { valid: true, code: "inside-aura" };
  if (origin <= auraRadius) {
    return { valid: false, code: "left-aura", message: "Gather to Me! must end inside the banner aura." };
  }
  if (destination >= origin - 0.5) {
    return { valid: false, code: "not-closer", message: "This movement must finish closer to the banner aura." };
  }

  const costNeeded = Math.min(budget, Math.max(0, origin - auraRadius));
  if (cost + tolerance < costNeeded) {
    return { valid: false, code: "movement-unused", message: "Use enough movement to enter the aura, or get as close as your Speed allows." };
  }

  const closestDirectDistance = Math.max(auraRadius, origin - budget);
  if (directRoute && destination > closestDirectDistance + gridDistance) {
    return { valid: false, code: "not-closest", message: "Choose a destination closer to the banner along this unobstructed route." };
  }

  return { valid: true, code: directRoute ? "closest-direct" : "closest-routed" };
}
