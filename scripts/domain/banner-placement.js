import { bannerRadius } from "./feat-rules.js";
const CORNERS = new Set(["nw", "ne", "sw", "se"]);

export function hasClaimTheField(actor) {
  return hasPlantBanner(actor) && actor.items.some((item) => item.slug === "claim-the-field");
}

export function claimTheFieldRange(actor) {
  const itemId = actor?.getFlag?.("pf2e-commanderer", "bannerConfiguration")?.itemId;
  const weapon = actor?.items?.find((item) => item.id === itemId && item.type === "weapon");
  if (!weapon) return 0;
  const traits = weapon.system?.traits?.value ?? [];
  const thrown = traits.find((trait) => /^thrown-\d+$/.test(trait));
  const range = thrown ? Number(thrown.slice(7))
    : weapon.isThrown || traits.includes("thrown") ? Number(weapon.range?.increment ?? weapon.system?.range) : 0;
  return Number.isFinite(range) && range > 0 ? range : 0;
}

export function hasPlantBanner(actor) {
  return actor?.items?.some((item) => item.slug === "plant-banner") === true;
}

export function plantedBannerRadius(actor) {
  return bannerRadius(actor, { planted: true });
}

export function plantBannerTemporaryHitPoints(level) {
  const commanderLevel = Math.max(1, Math.trunc(Number(level) || 1));
  return 4 * (1 + Math.floor(commanderLevel / 4));
}

export function bannerCorner(bounds, corner) {
  if (!CORNERS.has(corner)) throw new Error("Choose a valid corner for Plant Banner.");
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (![x, y, width, height].every(Number.isFinite)) throw new Error("Commander token bounds are unavailable.");
  return {
    x: x + (corner.endsWith("e") ? width : 0),
    y: y + (corner.startsWith("s") ? height : 0),
  };
}

export function bannerRangeToBounds(point, bounds, { gridSize = 100, gridDistance = 5 } = {}) {
  const x = Math.max(Number(bounds?.x), Math.min(Number(point?.x), Number(bounds?.x) + Number(bounds?.width)));
  const y = Math.max(Number(bounds?.y), Math.min(Number(point?.y), Number(bounds?.y) + Number(bounds?.height)));
  const pixels = Math.hypot(Number(point?.x) - x, Number(point?.y) - y);
  return pixels * Number(gridDistance) / Number(gridSize);
}
