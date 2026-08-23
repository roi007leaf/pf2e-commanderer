const PLANTED_RADIUS = 40;
const CORNERS = new Set(["nw", "ne", "sw", "se"]);

export function hasPlantBanner(actor) {
  return actor?.items?.some((item) => item.slug === "plant-banner") === true;
}

export function plantedBannerRadius() {
  return PLANTED_RADIUS;
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
