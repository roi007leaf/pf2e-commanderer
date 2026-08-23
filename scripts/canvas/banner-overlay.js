import { MODULE_ID } from "../constants.js";
import {
  bannerCarrierToken,
  bannerDisplayPoint,
  sceneBannerPlacements,
} from "../foundry/banner.js";
import { bannerActive } from "../foundry/runtime.js";

const BANNER_SLUG = "commanders-banner";
const GOLD = 0xd6ad64;
const DARK = 0x101318;

let overlay = null;
let guidance = null;
let renderQueued = false;
let registered = false;

function canvasStage() {
  return globalThis.canvas?.stage
    ?? globalThis.canvas?.app?.stage
    ?? globalThis.canvas?.app?.renderer?.stage
    ?? null;
}

function canvasZoom() {
  const zoom = Number(globalThis.canvas?.stage?.scale?.x);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function auraFor(token) {
  return token?.auras?.get?.(BANNER_SLUG) ?? token?.document?.auras?.get?.(BANNER_SLUG) ?? null;
}

function auraRadiusPixels(token, aura) {
  const nativeRadius = Number(aura?.radiusPixels);
  if (Number.isFinite(nativeRadius) && nativeRadius > 0) return nativeRadius;
  const radius = Number(aura?.radius ?? 30);
  const gridSize = Number(globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100);
  const gridDistance = Number(globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  const bounds = token?.mechanicalBounds ?? token?.bounds;
  return (Number(bounds?.width ?? token?.w ?? gridSize) / 2) + (radius / gridDistance) * gridSize;
}

function rangeRadiusPixels(radius) {
  const gridSize = Number(globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100);
  const gridDistance = Number(globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  return Number(radius) / gridDistance * gridSize;
}

function addBoundaryAt(container, point, radius, emphasized) {
  const Graphics = globalThis.PIXI?.Graphics;
  if (!Graphics) return;
  const ring = new Graphics();
  if (emphasized) {
    ring.beginFill(GOLD, 0.055);
    ring.drawCircle(point.x, point.y, radius);
    ring.endFill();
  }
  ring.lineStyle(emphasized ? 5 : 4, DARK, emphasized ? 0.78 : 0.52);
  ring.drawCircle(point.x, point.y, radius);
  ring.lineStyle(emphasized ? 2.5 : 1.5, GOLD, emphasized ? 0.98 : 0.58);
  ring.drawCircle(point.x, point.y, radius);
  container.addChild(ring);
}

function addBoundary(container, token, aura, emphasized) {
  addBoundaryAt(container, token.center, auraRadiusPixels(token, aura), emphasized);
}

function addBannerPin(container, token) {
  const { Container, Graphics } = globalThis.PIXI ?? {};
  if (!Container || !Graphics) return;
  const zoom = canvasZoom();
  const bounds = token.mechanicalBounds ?? token.bounds;
  const pin = new Container();
  const plate = new Graphics();
  plate.beginFill(DARK, 0.94);
  plate.lineStyle(1.5, GOLD, 0.95);
  plate.drawCircle(0, 0, 10);
  plate.endFill();
  plate.lineStyle(1.5, GOLD, 1);
  plate.moveTo(-3, 5);
  plate.lineTo(-3, -5);
  plate.beginFill(GOLD, 0.95);
  plate.moveTo(-2, -5);
  plate.lineTo(5, -2);
  plate.lineTo(-2, 1);
  plate.closePath();
  plate.endFill();
  pin.addChild(plate);
  pin.position.set(bounds.x + bounds.width / 2, bounds.y - 7 / zoom);
  pin.scale.set(1 / zoom);
  container.addChild(pin);
}

function addPlantedBanner(container, placement, active) {
  const { Container, Graphics } = globalThis.PIXI ?? {};
  if (!Container || !Graphics) return;
  const zoom = canvasZoom();
  const marker = new Container();
  const standard = new Graphics();
  const removed = placement.removed === true;
  const carried = removed && placement.removalMode === "carried";
  const color = active ? GOLD : 0x8a887f;

  standard.beginFill(DARK, 0.45);
  standard.drawCircle(0, 3, 13);
  standard.endFill();
  standard.lineStyle(3.5, DARK, 0.92);
  standard.moveTo(0, 11);
  standard.lineTo(0, -18);
  standard.lineStyle(2, color, 1);
  standard.moveTo(0, 11);
  standard.lineTo(0, -18);
  standard.beginFill(color, active ? 0.96 : 0.75);
  standard.moveTo(1, -17);
  standard.lineTo(16, -12);
  standard.lineTo(1, -6);
  standard.closePath();
  standard.endFill();
  standard.beginFill(DARK, 0.96);
  standard.lineStyle(1.5, color, 0.9);
  standard.drawCircle(0, 0, 5);
  standard.endFill();

  if (removed && !carried) {
    standard.rotation = -Math.PI / 3;
    const disabled = new Graphics();
    disabled.beginFill(DARK, 0.94);
    disabled.lineStyle(1.5, 0xa14945, 0.95);
    disabled.drawCircle(8, 8, 7);
    disabled.endFill();
    disabled.lineStyle(2, 0xd77a72, 1);
    disabled.moveTo(4, 4);
    disabled.lineTo(12, 12);
    disabled.moveTo(12, 4);
    disabled.lineTo(4, 12);
    marker.addChild(standard, disabled);
  } else {
    marker.addChild(standard);
  }
  marker.name = carried
    ? `${MODULE_ID}-carried-banner`
    : removed ? `${MODULE_ID}-fallen-banner` : `${MODULE_ID}-planted-banner`;
  marker.position.set(Number(placement.x), Number(placement.y));
  marker.scale.set(1 / zoom);
  container.addChild(marker);
}

function addMovementCue(container, token) {
  const Graphics = globalThis.PIXI?.Graphics;
  if (!Graphics) return;
  const zoom = canvasZoom();
  const bounds = token.mechanicalBounds ?? token.bounds;
  const center = token.center ?? {
    x: Number(bounds.x) + Number(bounds.width) / 2,
    y: Number(bounds.y) + Number(bounds.height) / 2,
  };
  const radius = Math.max(Number(bounds.width), Number(bounds.height)) / 2 + 10 / zoom;
  const cue = new Graphics();
  cue.lineStyle(6 / zoom, DARK, 0.82);
  cue.drawCircle(center.x, center.y, radius);
  cue.lineStyle(2.5 / zoom, GOLD, 1);
  cue.drawCircle(center.x, center.y, radius);

  const notch = 7 / zoom;
  const gap = 3 / zoom;
  for (const [x, y, dx, dy] of [
    [center.x, center.y - radius, 0, -1],
    [center.x + radius, center.y, 1, 0],
    [center.x, center.y + radius, 0, 1],
    [center.x - radius, center.y, -1, 0],
  ]) {
    cue.moveTo(x + dx * gap - dy * notch / 2, y + dy * gap + dx * notch / 2);
    cue.lineTo(x + dx * (gap + notch), y + dy * (gap + notch));
    cue.lineTo(x + dx * gap + dy * notch / 2, y + dy * gap - dx * notch / 2);
  }
  container.addChild(cue);
}

function placementActor(placement) {
  return globalThis.game?.actors?.get?.(placement.actorId)
    ?? globalThis.fromUuidSync?.(placement.actorUuid)
    ?? null;
}

function placementActive(placement) {
  if (placement.removed === true) return false;
  const actor = placementActor(placement);
  return actor ? bannerActive(actor) : true;
}

function setNativeAuraVisible(token, visible) {
  const aura = auraFor(token);
  if (!aura || !aura.token) return;
  aura.visible = visible;
  if (aura.textureContainer) aura.textureContainer.visible = visible;
}

function syncNativeAuraVisibility(placements) {
  const plantedActorIds = new Set(placements.map((placement) => placement.actorId));
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    setNativeAuraVisible(token, !plantedActorIds.has(token.actor?.id));
  }
}

function bannerTokens(placements) {
  const plantedActorIds = new Set(placements.map((placement) => placement.actorId));
  return (globalThis.canvas?.tokens?.placeables ?? [])
    .filter((token) => token?.isVisible !== false && auraFor(token) && !plantedActorIds.has(token.actor?.id));
}

function ensureOverlay() {
  const stage = canvasStage();
  const Container = globalThis.PIXI?.Container;
  if (!stage?.addChild || !Container) return null;
  if (overlay?.parent !== stage) {
    overlay?.destroy?.({ children: true });
    overlay = new Container();
    overlay.name = `${MODULE_ID}-banner-overlay`;
    overlay.eventMode = "none";
    overlay.interactive = false;
    overlay.interactiveChildren = false;
    stage.addChild(overlay);
  }
  return overlay;
}

export function renderBannerOverlay() {
  renderQueued = false;
  if (!globalThis.canvas?.ready) return;
  const container = ensureOverlay();
  if (!container) return;
  for (const child of container.removeChildren()) child.destroy?.({ children: true });

  const placements = Object.values(sceneBannerPlacements());
  syncNativeAuraVisibility(placements);
  for (const token of bannerTokens(placements)) {
    const aura = auraFor(token);
    const gathering = guidance?.commanderTokenId === token.id || guidance?.commanderActorId === token.actor?.id;
    addBoundary(container, token, aura, gathering);
    addBannerPin(container, token);
  }

  for (const placement of placements) {
    const active = placementActive(placement);
    const gathering = guidance?.commanderActorId === placement.actorId;
    if (active) addBoundaryAt(container, placement, rangeRadiusPixels(placement.radius ?? 40), gathering);
    const carrier = bannerCarrierToken(placement);
    if (placement.removalMode === "carried" && (!carrier || carrier.isVisible === false)) continue;
    addPlantedBanner(container, { ...placement, ...bannerDisplayPoint(placement) }, active);
  }

  if (guidance?.movingTokenId) {
    const movingToken = (globalThis.canvas?.tokens?.placeables ?? [])
      .find((token) => token.id === guidance.movingTokenId && token.isVisible !== false);
    if (movingToken) addMovementCue(container, movingToken);
  }
}

export function scheduleBannerOverlayRender() {
  if (renderQueued) return;
  renderQueued = true;
  const render = () => renderBannerOverlay();
  if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(render);
  else globalThis.setTimeout(render, 0);
}

export function showGatherGuidance(commanderToken, commanderActor = commanderToken?.actor, movingToken = null) {
  const key = Symbol("gather-guidance");
  guidance = {
    key,
    commanderTokenId: commanderToken?.id ?? null,
    commanderActorId: commanderActor?.id ?? null,
    movingTokenId: movingToken?.id ?? null,
  };
  renderBannerOverlay();
  return () => {
    if (guidance?.key !== key) return;
    guidance = null;
    renderBannerOverlay();
  };
}

function destroyOverlay() {
  guidance = null;
  renderQueued = false;
  overlay?.parent?.removeChild?.(overlay);
  overlay?.destroy?.({ children: true });
  overlay = null;
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) setNativeAuraVisible(token, true);
}

export function registerBannerOverlay() {
  if (registered) return;
  registered = true;
  Hooks.on("canvasReady", renderBannerOverlay);
  Hooks.on("canvasTearDown", destroyOverlay);
  Hooks.on("refreshToken", scheduleBannerOverlayRender);
  Hooks.on("updateToken", scheduleBannerOverlayRender);
  Hooks.on("createToken", scheduleBannerOverlayRender);
  Hooks.on("deleteToken", scheduleBannerOverlayRender);
  Hooks.on("updateActor", scheduleBannerOverlayRender);
  Hooks.on("createItem", scheduleBannerOverlayRender);
  Hooks.on("updateItem", scheduleBannerOverlayRender);
  Hooks.on("deleteItem", scheduleBannerOverlayRender);
  Hooks.on("updateScene", scheduleBannerOverlayRender);
  Hooks.on(`${MODULE_ID}.bannerPlacementChanged`, renderBannerOverlay);
  Hooks.on("canvasPan", scheduleBannerOverlayRender);
}
