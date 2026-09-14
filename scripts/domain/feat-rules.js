export const hasFeat = (actor, slug) => actor?.items?.some((item) => item.slug === slug) === true;

export function armoredBulkRules(actor) {
  if (!hasFeat(actor, "armored-regiment-training")) return [];
  return [...actor.items].filter((item) => item.type === "armor" && (item._source?.system ?? item.system)?.category === "heavy").map((item) => ({
    key: "ItemAlteration", itemType: "armor", predicate: [`item:id:${item.id}`], property: "bulk", mode: "override",
    value: Math.max(0, Number((item._source?.system ?? item.system).bulk.value) - 1),
  }));
}

export function drilledReactionLimit(actor) {
  return hasFeat(actor, "practiced-reflexes") ? 4 : hasFeat(actor, "drilled-reflexes") ? 2 : 1;
}

export function assessmentLimit(actor) {
  return hasFeat(actor, "perfected-evaluations") ? 6 : hasFeat(actor, "unrivaled-analysis") ? 4 : 1;
}

export function bannerRadius(actor, { planted = false, companion = false, mascot = false } = {}) {
  const glorious = hasFeat(actor, "glorious-banner");
  if (planted) return glorious ? 80 : 40;
  if (companion && mascot) return glorious ? 100 : 60;
  return (glorious ? 60 : 30) + (companion && hasFeat(actor, "battle-tested-companion") ? 10 : 0);
}

export function rallyingDice(level) {
  return Math.max(4, 4 + Math.floor((Number(level) - 8) / 2));
}

export const ACTIVE_FEATS = new Set([
  "adaptive-stratagem", "rapid-assessment", "combat-assessment", "guiding-shot", "set-up-strike",
  "unsteadying-strike", "banner-twirl", "banners-inspiration", "defiant-banner", "rallying-banner",
  "quickening-banner", "pennant-of-victory", "confusing-commands", "demand-surrender", "mercenary-reversal",
  "desperate-resuscitation", "defensive-swap", "reactive-strike", "reactive-interference", "standard-bearers-sacrifice",
  "shield-warden", "shielded-recovery", "commanders-companion", "armored-regiment-training", "deceptive-tactics",
]);
