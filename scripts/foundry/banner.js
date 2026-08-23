import { FLAG_SCOPE } from "../constants.js";
import {
  bannerCorner,
  bannerRangeToBounds,
  hasPlantBanner,
  plantedBannerRadius,
} from "../domain/banner-placement.js";
import { activeTokenFor, setBannerActive } from "./runtime.js";

const PLACEMENTS_FLAG = "plantedBanners";

function clone(value) {
  if (typeof globalThis.foundry?.utils?.deepClone === "function") return foundry.utils.deepClone(value);
  return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function sceneBannerPlacements(scene = globalThis.canvas?.scene) {
  const placements = scene?.getFlag?.(FLAG_SCOPE, PLACEMENTS_FLAG);
  return placements && typeof placements === "object" ? placements : {};
}

export function plantedBanner(actor, scene = globalThis.canvas?.scene) {
  if (!actor?.id) return null;
  const placement = sceneBannerPlacements(scene)[actor.id];
  return placement?.actorUuid === actor.uuid ? placement : null;
}

export function bannerOrigin(actor) {
  const placement = plantedBanner(actor);
  if (placement) return { ...placement, planted: true };
  const token = activeTokenFor(actor);
  return token ? { token, radius: 30, planted: false } : null;
}

export function bannerRangeToToken(actor, token) {
  const origin = bannerOrigin(actor);
  if (!origin || !token) return Number.POSITIVE_INFINITY;
  if (!origin.planted) return origin.token.id === token.id ? 0 : origin.token.distanceTo(token);
  const bounds = token.mechanicalBounds ?? token.bounds;
  return bannerRangeToBounds(origin, bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance: globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
  });
}

export function canRetrieveBanner(actor, scene = globalThis.canvas?.scene) {
  const placement = plantedBanner(actor, scene);
  const token = activeTokenFor(actor);
  if (!placement || !token) return false;
  const distance = bannerRangeToBounds(placement, token.mechanicalBounds ?? token.bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance: globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
  });
  const adjacentDistance = Number(globalThis.canvas?.scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  return distance <= adjacentDistance;
}

export async function plantBanner(actor, corner, scene = globalThis.canvas?.scene) {
  if (!hasPlantBanner(actor)) throw new Error("This commander does not have the Plant Banner feat.");
  if (!scene || globalThis.canvas?.ready !== true) throw new Error("Open an active scene before planting the banner.");
  const token = activeTokenFor(actor);
  if (!token) throw new Error("Place this commander on the active scene before planting the banner.");
  const point = bannerCorner(token.mechanicalBounds ?? token.bounds, corner);

  const placements = clone(sceneBannerPlacements(scene));
  const placement = {
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenUuid: token.document?.uuid ?? null,
    x: point.x,
    y: point.y,
    radius: plantedBannerRadius(actor),
    corner,
  };
  placements[actor.id] = placement;
  const suppressNativeAura = actor?.rollOptions?.all?.["commanders-banner"] === true;
  if (suppressNativeAura) await setBannerActive(actor, false);
  try {
    await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  } catch (error) {
    if (suppressNativeAura) await setBannerActive(actor, true);
    throw error;
  }
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, actor, placement);
  return placement;
}

export async function retrieveBanner(actor, scene = globalThis.canvas?.scene) {
  const placement = scene ? plantedBanner(actor, scene) : null;
  if (!scene || !placement) return false;
  if (!canRetrieveBanner(actor, scene)) throw new Error("Move adjacent to the planted banner before retrieving it.");
  const restoreNativeAura = actor?.rollOptions?.all?.["commanders-banner"] !== true;
  const placements = clone(sceneBannerPlacements(scene));
  delete placements[actor.id];
  try {
    if (Object.keys(placements).length) await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
    else await scene.unsetFlag(FLAG_SCOPE, PLACEMENTS_FLAG);
  } catch (error) {
    throw error;
  }
  try {
    if (restoreNativeAura) await setBannerActive(actor, true);
  } catch (error) {
    placements[actor.id] = placement;
    await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
    throw error;
  }
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, actor, null);
  return true;
}
