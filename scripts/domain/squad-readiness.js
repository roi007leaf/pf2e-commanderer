const SELECTION_LABELS = Object.freeze({
  all: "All eligible squadmates",
  one: "Choose 1 squadmate",
  two: "Choose 2 squadmates",
  "up-to-2": "Choose up to 2 squadmates",
  "up-to-3": "Choose up to 3 squadmates",
});

export function rankSquadCandidates(candidates = []) {
  const seen = new Set();
  return [...candidates]
    .sort((left, right) => Number(Boolean(right.current)) - Number(Boolean(left.current))
      || Number(Boolean(right.targeted)) - Number(Boolean(left.targeted))
      || Number(Boolean(right.inBannerAura)) - Number(Boolean(left.inBannerAura))
      || Number(left.distance ?? Number.POSITIVE_INFINITY) - Number(right.distance ?? Number.POSITIVE_INFINITY)
      || String(left.name ?? "").localeCompare(String(right.name ?? "")))
    .filter((candidate) => {
      if (seen.has(candidate.actorUuid)) return false;
      seen.add(candidate.actorUuid);
      return true;
    });
}

export function tacticDependsOnBannerAura(definition = {}) {
  return definition.aura === true || definition.response?.kind === "gather-to-me";
}

export function tacticAudience(definition = {}, members = [], { bannerActive = true } = {}) {
  const gather = definition.response?.kind === "gather-to-me";
  const requiresAura = definition.aura === true;
  const dependsOnBannerAura = tacticDependsOnBannerAura(definition);
  const presentMembers = members
    .filter((member) => member.onScene !== false)
    .filter((member) => !definition.requirement || member.capabilities?.[definition.requirement] === true);
  const eligibleCount = dependsOnBannerAura && !bannerActive
    ? 0
    : requiresAura ? presentMembers.filter((member) => member.inBannerAura).length : presentMembers.length;
  const trainedCount = members.length;

  return {
    selectionLabel: SELECTION_LABELS[definition.selection] ?? "Choose eligible squadmates",
    reachLabel: dependsOnBannerAura && !bannerActive
      ? "Banner aura inactive"
      : gather ? "Anywhere → banner aura" : requiresAura ? "Inside banner aura" : "All squadmates",
    readyLabel: `${eligibleCount} ready`,
    readyDetail: dependsOnBannerAura && !bannerActive
      ? "Display banner first"
      : requiresAura ? `${eligibleCount} of ${trainedCount} in aura` : `${eligibleCount} of ${trainedCount} on scene`,
    eligibleCount,
    trainedCount,
    onSceneCount: presentMembers.length,
    requiresAura,
    gather,
    dependsOnBannerAura,
    tone: eligibleCount > 0 ? "ready" : "unavailable",
  };
}
