export function movementBudget(speed, allowance = "full", gridDistance = 5) {
  const base = Math.max(0, Number(speed) || 0);
  const grid = Math.max(1, Number(gridDistance) || 5);
  if (typeof allowance === "number") return Math.max(0, allowance);
  if (allowance === "half") return Math.max(grid, Math.floor(base / 2 / grid) * grid);
  if (allowance === "double") return base * 2;
  return base;
}

export function movementDestinationVerdict({
  relation = "free",
  originTargetDistance,
  destinationTargetDistance,
  pathTargetDistances = [],
  hostileOriginDistances = [],
  hostileDestinationDistances = [],
  requireAdjacent = false,
  maximumTargetDistance = null,
  gridDistance = 5,
} = {}) {
  const origin = Number(originTargetDistance);
  const destination = Number(destinationTargetDistance);
  const grid = Math.max(1, Number(gridDistance) || 5);
  const tolerance = Math.max(0.5, grid / 10);

  if (relation === "toward-target") {
    if (![origin, destination].every(Number.isFinite)) {
      return { valid: false, code: "unmeasurable", message: "Could not measure movement toward the selected target." };
    }
    if (destination >= origin - tolerance) {
      return { valid: false, code: "not-closer", message: "This movement must finish closer to the selected target." };
    }
    let previous = origin;
    for (const distance of pathTargetDistances.map(Number).filter(Number.isFinite)) {
      if (distance > previous + tolerance) {
        return { valid: false, code: "not-direct", message: "Every segment must move directly toward the selected target." };
      }
      previous = distance;
    }
  }

  if (relation === "away-from-enemy") {
    const improved = hostileOriginDistances.some((distance, index) => {
      const after = Number(hostileDestinationDistances[index]);
      return Number.isFinite(distance) && Number.isFinite(after) && after > Number(distance) + tolerance;
    });
    if (!improved) {
      return { valid: false, code: "not-farther", message: "Finish farther from at least one observed hostile creature." };
    }
  }

  if (requireAdjacent && (!Number.isFinite(destination) || destination > grid + tolerance)) {
    return { valid: false, code: "not-adjacent", message: "Finish adjacent to the selected target." };
  }
  if (Number.isFinite(maximumTargetDistance) && (!Number.isFinite(destination) || destination > maximumTargetDistance + tolerance)) {
    return { valid: false, code: "not-in-reach", message: `Finish with the selected target within ${maximumTargetDistance} feet.` };
  }

  return { valid: true, code: "valid" };
}
