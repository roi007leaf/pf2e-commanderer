import { FLAG_SCOPE } from "../constants.js";
import {
  bannerCorner,
  bannerRangeToBounds,
  hasPlantBanner,
  plantedBannerRadius,
} from "../domain/banner-placement.js";
import { activeTokenFor, setBannerActive } from "./runtime.js";
import { registerOperation, requestOperation } from "./socket.js";

const PLACEMENTS_FLAG = "plantedBanners";
const REMOVE_OPERATION = "remove-planted-banner";
const REMOVAL_MODES = new Set(["dropped", "carried"]);
let interactionsRegistered = false;

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
  if (placement) return placement.removed === true ? null : { ...placement, planted: true };
  const token = activeTokenFor(actor);
  return token ? { token, radius: 30, planted: false } : null;
}

function commanderForPlacement(placement) {
  return globalThis.game?.actors?.get?.(placement.actorId)
    ?? (globalThis.canvas?.tokens?.placeables ?? [])
      .find((token) => token.actor?.uuid === placement.actorUuid)?.actor
    ?? globalThis.fromUuidSync?.(placement.actorUuid)
    ?? null;
}

function userOwnsActor(user, actor) {
  return user?.isGM === true || actor?.testUserPermission?.(user, "OWNER") === true;
}

function actorIsEnemy(actor, commander) {
  if (!actor || !commander || actor.uuid === commander.uuid) return false;
  if (typeof actor.isEnemyOf === "function") return actor.isEnemyOf(commander);
  if (typeof commander.isEnemyOf === "function") return commander.isEnemyOf(actor);
  return actor.alliance != null && commander.alliance != null && actor.alliance !== commander.alliance;
}

function tokenAdjacentToPlacement(token, placement, scene) {
  const bounds = token?.document?.mechanicalBounds ?? token?.mechanicalBounds ?? token?.bounds;
  if (!bounds) return false;
  const gridDistance = Number(scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  return bannerRangeToBounds(placement, bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance,
  }) <= gridDistance;
}

function tokenBounds(token) {
  return token?.document?.mechanicalBounds ?? token?.mechanicalBounds ?? token?.bounds ?? null;
}

function tokenAnchor(token) {
  const bounds = tokenBounds(token);
  if (!bounds) return null;
  return {
    x: Number(bounds.x) + Number(bounds.width) / 2,
    y: Number(bounds.y),
  };
}

function boundsRange(left, right, scene) {
  const dx = Math.max(
    Number(left.x) - (Number(right.x) + Number(right.width)),
    Number(right.x) - (Number(left.x) + Number(left.width)),
    0
  );
  const dy = Math.max(
    Number(left.y) - (Number(right.y) + Number(right.height)),
    Number(right.y) - (Number(left.y) + Number(left.height)),
    0
  );
  const gridSize = Number(globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100);
  const gridDistance = Number(scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  return Math.hypot(dx, dy) * gridDistance / gridSize;
}

export function bannerCarrierToken(placement, scene = globalThis.canvas?.scene) {
  if (placement?.removed !== true || placement.removalMode !== "carried" || !placement.carrierTokenUuid) return null;
  return sceneToken(scene, placement.carrierTokenUuid);
}

export function bannerDisplayPoint(placement, scene = globalThis.canvas?.scene) {
  const carrierPoint = tokenAnchor(bannerCarrierToken(placement, scene));
  return carrierPoint ?? { x: Number(placement?.x), y: Number(placement?.y) };
}

export function removableEnemyBanners(token, scene = globalThis.canvas?.scene, user = globalThis.game?.user) {
  const actor = token?.actor ?? token?.document?.actor;
  if (!scene || !userOwnsActor(user, actor)) return [];
  const removable = [];
  for (const placement of Object.values(sceneBannerPlacements(scene))) {
    if (placement?.removed === true) continue;
    const commander = commanderForPlacement(placement);
    if (!actorIsEnemy(actor, commander) || !tokenAdjacentToPlacement(token, placement, scene)) continue;
    removable.push({ commander, placement });
  }
  return removable;
}

export async function removePlantedBannerAsEnemy({ scene, commanderActorId, enemyToken, user, mode = "dropped" }) {
  if (!REMOVAL_MODES.has(mode)) throw new Error("Choose whether the enemy pulls down or takes the banner.");
  const target = removableEnemyBanners(enemyToken, scene, user)
    .find(({ placement }) => placement.actorId === commanderActorId);
  if (!target) throw new Error("This token cannot remove that banner. It must be an adjacent enemy you own.");

  const placements = clone(sceneBannerPlacements(scene));
  const current = placements[commanderActorId];
  if (!current || current.removed === true || current.actorUuid !== target.placement.actorUuid) {
    throw new Error("That banner is no longer available to remove.");
  }
  const enemyActor = enemyToken.actor ?? enemyToken.document?.actor;
  const enemyTokenUuid = enemyToken.document?.uuid ?? enemyToken.uuid ?? null;
  const removed = {
    ...current,
    removed: true,
    removalMode: mode,
    carrierTokenUuid: mode === "carried" ? enemyTokenUuid : null,
    removedAt: Number(globalThis.game?.time?.worldTime ?? 0),
    removedBy: {
      actorUuid: enemyActor.uuid,
      actorName: enemyActor.name,
      tokenUuid: enemyTokenUuid,
      userId: user.id,
    },
  };
  placements[commanderActorId] = removed;
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, target.commander, removed);
  return removed;
}

function sceneToken(scene, tokenUuid) {
  const tokenId = String(tokenUuid ?? "").split(".").at(-1);
  const document = scene?.tokens?.get?.(tokenId)
    ?? (globalThis.canvas?.tokens?.placeables ?? []).find((token) => token.document?.uuid === tokenUuid)?.document
    ?? null;
  return document?.object ?? (document ? { actor: document.actor, document } : null);
}

async function handleEnemyBannerRemoval(payload, userId) {
  const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
  const user = globalThis.game?.users?.get?.(userId);
  const enemyToken = sceneToken(scene, payload.enemyTokenUuid);
  if (!scene || !user || !enemyToken) throw new Error("Banner removal request is no longer valid.");
  return removePlantedBannerAsEnemy({
    scene,
    commanderActorId: payload.commanderActorId,
    enemyToken,
    user,
    mode: payload.mode,
  });
}

export async function dropCarriedBannersForToken(tokenDocument, scene = tokenDocument?.parent) {
  if (!scene || !tokenDocument?.uuid) return 0;
  const point = tokenAnchor(tokenDocument.object ?? { document: tokenDocument });
  if (!point) return 0;
  const placements = clone(sceneBannerPlacements(scene));
  const dropped = [];
  for (const [actorId, placement] of Object.entries(placements)) {
    if (placement.removalMode !== "carried" || placement.carrierTokenUuid !== tokenDocument.uuid) continue;
    placements[actorId] = {
      ...placement,
      ...point,
      removalMode: "dropped",
      carrierTokenUuid: null,
      droppedAt: Number(globalThis.game?.time?.worldTime ?? 0),
    };
    dropped.push(placements[actorId]);
  }
  if (!dropped.length) return 0;
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  for (const placement of dropped) {
    globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, commanderForPlacement(placement), placement);
  }
  return dropped.length;
}

function mayManagePlacements() {
  const user = globalThis.game?.user;
  const activeGM = globalThis.game?.users?.activeGM
    ?? globalThis.game?.users?.find?.((candidate) => candidate.active && candidate.isGM);
  return user?.isGM === true && (!activeGM || activeGM.id === user.id);
}

export function registerBannerInteractions() {
  if (interactionsRegistered) return;
  interactionsRegistered = true;
  registerOperation(REMOVE_OPERATION, handleEnemyBannerRemoval);
  globalThis.Hooks?.on?.("deleteToken", (tokenDocument) => {
    if (!mayManagePlacements()) return;
    dropCarriedBannersForToken(tokenDocument).catch((error) => {
      console.error(`${FLAG_SCOPE} | Could not drop a carried banner from a deleted token`, error);
    });
  });
}

export function requestEnemyBannerRemoval(enemyToken, commanderActorId, mode, scene = globalThis.canvas?.scene) {
  const enemyTokenUuid = enemyToken?.document?.uuid ?? enemyToken?.uuid;
  if (!scene?.id || !enemyTokenUuid) throw new Error("Use an enemy token on the active scene.");
  if (!REMOVAL_MODES.has(mode)) throw new Error("Choose whether to pull down or take the banner.");
  return requestOperation(REMOVE_OPERATION, {
    sceneId: scene.id,
    commanderActorId,
    enemyTokenUuid,
    mode,
  }, { gmRequired: true });
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
  const token = sceneToken(scene, placement?.tokenUuid) ?? activeTokenFor(actor);
  if (!placement || !token) return false;
  const carrier = bannerCarrierToken(placement, scene);
  const distance = carrier
    ? boundsRange(tokenBounds(carrier), tokenBounds(token), scene)
    : bannerRangeToBounds(bannerDisplayPoint(placement, scene), tokenBounds(token), {
        gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
        gridDistance: scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
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

export async function retrieveBanner(actor, scene = globalThis.canvas?.scene, { allowCarried = false } = {}) {
  const placement = scene ? plantedBanner(actor, scene) : null;
  if (!scene || !placement) return false;
  if (placement.removalMode === "carried" && !allowCarried) {
    throw new Error("A GM must rule the check to recover a banner carried by an enemy.");
  }
  if (!canRetrieveBanner(actor, scene)) {
    const message = placement.removalMode === "carried"
      ? `Move adjacent to ${placement.removedBy?.actorName ?? "the banner carrier"} before retrieving it.`
      : "Move adjacent to the planted banner before retrieving it.";
    throw new Error(message);
  }
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
