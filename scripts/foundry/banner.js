import { FLAG_SCOPE } from "../constants.js";
import { bannerRadius, hasFeat } from "../domain/feat-rules.js";
import {
  bannerCorner,
  bannerRangeToBounds,
  hasPlantBanner,
  hasClaimTheField,
  claimTheFieldRange,
  plantedBannerRadius,
} from "../domain/banner-placement.js";
import { activeTokenFor, setBannerActive } from "./runtime.js";
import { clearPlantedBannerEffects } from "./banner-effects.js";
import { registerOperation, requestOperation } from "./socket.js";
import { bannerBeneficiaries, frightenBannerBeneficiaries } from "./banner-loss.js";
import { createBannerObject, removeBannerObjectToken, syncBannerObject } from "./banner-object.js";
import { claimTheFieldAllowsAttempt } from "./claim-the-field.js";

const PLACEMENTS_FLAG = "plantedBanners";
const PLANT_OPERATION = "plant-banner";
const RETRIEVE_OPERATION = "retrieve-banner";
const REMOVE_OPERATION = "remove-planted-banner";
const DROP_OPERATION = "drop-carried-banner";
const PICKUP_OPERATION = "pickup-dropped-banner";
const REMOVAL_MODES = new Set(["dropped", "carried"]);
let interactionsRegistered = false;
let bannerOperationChain = Promise.resolve();

function serializeBannerOperation(handler) {
  return (...args) => {
    const operation = bannerOperationChain.then(() => handler(...args));
    bannerOperationChain = operation.catch(() => {});
    return operation;
  };
}

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
  if (placement) return placement.removed === true || placement.broken === true ? null : { ...placement, radius: bannerRadius(actor, { planted: true }), planted: true };
  const companion = hasFeat(actor, "commanders-companion") ? actor.getFlag?.(FLAG_SCOPE, "companion") : null;
  const token = companion?.banner ? globalThis.fromUuidSync?.(companion.tokenUuid)?.object : activeTokenFor(actor);
  return token ? { token, radius: bannerRadius(actor, { companion: companion?.banner, mascot: companion?.mascot }), planted: false } : null;
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

function actorMayTakeBanner(actor, commander, user) {
  if (!actor || !commander || actor.uuid === commander.uuid) return false;
  // NPC allegiance can be neutral or reflect a temporary alliance. The GM
  // adjudicates the hostile Interact without rewriting that actor's alliance.
  if (user?.isGM && actor.type === "npc") return true;
  if (typeof actor.isEnemyOf === "function") return actor.isEnemyOf(commander);
  if (typeof commander.isEnemyOf === "function") return commander.isEnemyOf(actor);
  return actor.alliance != null && commander.alliance != null && actor.alliance !== commander.alliance;
}

function tokenAdjacentToPlacement(token, placement, scene) {
  const bounds = token?.document?.mechanicalBounds ?? token?.mechanicalBounds ?? token?.bounds;
  if (!bounds) return false;
  const gridDistance = Number(scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5);
  const distance = bannerRangeToBounds(placement, bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance,
  });
  return withinBannerReach(token, placement, distance);
}

function tokenPosition(token) {
  const document = token?.document ?? token;
  return { elevation: Number(document?.elevation ?? 0), ...(document?.level ? { level: document.level } : {}) };
}

function withinBannerReach(token, position, distance) {
  const origin = tokenPosition(token);
  if (origin.level && position.level && origin.level !== position.level) return false;
  const actor = token?.actor ?? token?.document?.actor;
  const reach = Number(actor?.getReach?.({ action: "interact" }) ?? actor?.system?.attributes?.reach?.base ?? 5);
  return Math.hypot(distance, origin.elevation - Number(position.elevation ?? origin.elevation)) <= reach;
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
    if (!actorMayTakeBanner(actor, commander, user) || !tokenAdjacentToPlacement(token, placement, scene)) continue;
    removable.push({ commander, placement });
  }
  return removable;
}

export function carriedBanners(token, scene = globalThis.canvas?.scene, user = globalThis.game?.user) {
  const actor = token?.actor ?? token?.document?.actor;
  const tokenUuid = token?.document?.uuid ?? token?.uuid;
  if (!scene || !tokenUuid || !userOwnsActor(user, actor)) return [];
  return Object.values(sceneBannerPlacements(scene))
    .filter((placement) => placement?.removed === true
      && placement.removalMode === "carried"
      && placement.carrierTokenUuid === tokenUuid)
    .map((placement) => ({ commander: commanderForPlacement(placement), placement }));
}

export function pickupableDroppedBanners(token, scene = globalThis.canvas?.scene, user = globalThis.game?.user) {
  const actor = token?.actor ?? token?.document?.actor;
  if (!scene || !userOwnsActor(user, actor)) return [];
  const pickupable = [];
  for (const placement of Object.values(sceneBannerPlacements(scene))) {
    if (placement?.removed !== true || placement.removalMode !== "dropped") continue;
    const commander = commanderForPlacement(placement);
    if (!actorMayTakeBanner(actor, commander, user) || !tokenAdjacentToPlacement(token, placement, scene)) continue;
    pickupable.push({ commander, placement });
  }
  return pickupable;
}

export async function removePlantedBannerAsEnemy({ scene, commanderActorId, enemyToken, user, mode = "dropped" }) {
  if (!REMOVAL_MODES.has(mode)) throw new Error("Choose whether the enemy pulls down or takes the banner.");
  const target = removableEnemyBanners(enemyToken, scene, user)
    .find(({ placement }) => placement.actorId === commanderActorId);
  if (!target) throw new Error("This token cannot remove that banner. It must be an adjacent enemy you own.");
  if (!await claimTheFieldAllowsAttempt(target.commander, enemyToken.actor ?? enemyToken.document?.actor, target.placement)) return false;

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
  const beneficiaries = mode === "carried" ? bannerBeneficiaries(current.actorUuid, scene) : [];
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  await frightenBannerBeneficiaries(beneficiaries);
  await syncBannerObject(scene, removed);
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

function commanderOperationContext(payload, userId) {
  const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
  const user = globalThis.game?.users?.get?.(userId);
  const token = sceneToken(scene, payload.tokenUuid);
  const actor = token?.actor ?? token?.document?.actor;
  if (!scene || !user || !token || !actor
    || actor.id !== payload.actorId
    || actor.uuid !== payload.actorUuid
    || !userOwnsActor(user, actor)) {
    throw new Error("Commander banner request is no longer valid or you do not own that actor.");
  }
  return { scene, user, token, actor };
}

async function handlePlantBanner(payload, userId) {
  const { scene, token, actor } = commanderOperationContext(payload, userId);
  return plantBanner(actor, payload.corner, scene, { token });
}

async function handleRetrieveBanner(payload, userId) {
  if (payload.force === true) {
    const user = globalThis.game?.users?.get?.(userId);
    if (!user?.isGM) throw new Error("Only a GM can force banner retrieval.");
    const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
    const placement = sceneBannerPlacements(scene)[payload.actorId];
    if (!scene || placement?.actorUuid !== payload.actorUuid) throw new Error("Banner request is no longer valid.");
    const actor = commanderForPlacement(placement);
    if (!actor) throw new Error("The banner's commander no longer exists.");
    return retrieveBanner(actor, scene, { force: true });
  }
  const { scene, actor } = commanderOperationContext(payload, userId);
  return retrieveBanner(actor, scene);
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

function droppedPlacement(placement, token, userId = null) {
  const point = tokenAnchor(token);
  if (!point) throw new Error("The banner carrier has no valid canvas position.");
  const actor = token?.actor ?? token?.document?.actor;
  const tokenUuid = token?.document?.uuid ?? token?.uuid ?? null;
  return {
    ...placement,
    ...point,
    ...tokenPosition(token),
    removalMode: "dropped",
    carrierTokenUuid: null,
    droppedAt: Number(globalThis.game?.time?.worldTime ?? 0),
    droppedBy: {
      actorUuid: actor?.uuid ?? null,
      actorName: actor?.name ?? null,
      tokenUuid,
      userId,
    },
  };
}

export async function dropCarriedBanner({ scene, commanderActorId, carrierToken, user }) {
  const target = carriedBanners(carrierToken, scene, user)
    .find(({ placement }) => placement.actorId === commanderActorId);
  if (!target) throw new Error("This token does not carry that banner, or you do not own it.");

  const placements = clone(sceneBannerPlacements(scene));
  const current = placements[commanderActorId];
  const carrierTokenUuid = carrierToken?.document?.uuid ?? carrierToken?.uuid;
  if (current?.removed !== true
    || current.removalMode !== "carried"
    || current.carrierTokenUuid !== carrierTokenUuid
    || current.actorUuid !== target.placement.actorUuid) {
    throw new Error("That banner is no longer carried by this token.");
  }
  const dropped = droppedPlacement(current, carrierToken, user.id);
  placements[commanderActorId] = dropped;
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  await syncBannerObject(scene, dropped);
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, target.commander, dropped);
  return dropped;
}

async function handleCarriedBannerDrop(payload, userId) {
  const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
  const user = globalThis.game?.users?.get?.(userId);
  const carrierToken = sceneToken(scene, payload.carrierTokenUuid);
  if (!scene || !user || !carrierToken) throw new Error("Banner drop request is no longer valid.");
  return dropCarriedBanner({
    scene,
    commanderActorId: payload.commanderActorId,
    carrierToken,
    user,
  });
}

export async function pickupDroppedBannerAsEnemy({ scene, commanderActorId, enemyToken, user }) {
  const target = pickupableDroppedBanners(enemyToken, scene, user)
    .find(({ placement }) => placement.actorId === commanderActorId);
  if (!target) throw new Error("This token cannot pick up that banner. It must be an adjacent enemy you own.");

  const placements = clone(sceneBannerPlacements(scene));
  const current = placements[commanderActorId];
  if (current?.removed !== true
    || current.removalMode !== "dropped"
    || current.actorUuid !== target.placement.actorUuid) {
    throw new Error("That banner is no longer available to pick up.");
  }
  const enemyActor = enemyToken.actor ?? enemyToken.document?.actor;
  const enemyTokenUuid = enemyToken.document?.uuid ?? enemyToken.uuid ?? null;
  const pickedUp = {
    ...current,
    removalMode: "carried",
    carrierTokenUuid: enemyTokenUuid,
    pickedUpAt: Number(globalThis.game?.time?.worldTime ?? 0),
    pickedUpBy: {
      actorUuid: enemyActor?.uuid ?? null,
      actorName: enemyActor?.name ?? null,
      tokenUuid: enemyTokenUuid,
      userId: user.id,
    },
  };
  placements[commanderActorId] = pickedUp;
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  await syncBannerObject(scene, pickedUp);
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, target.commander, pickedUp);
  return pickedUp;
}

async function handleDroppedBannerPickup(payload, userId) {
  const scene = globalThis.game?.scenes?.get?.(payload.sceneId);
  const user = globalThis.game?.users?.get?.(userId);
  const enemyToken = sceneToken(scene, payload.enemyTokenUuid);
  if (!scene || !user || !enemyToken) throw new Error("Banner pickup request is no longer valid.");
  return pickupDroppedBannerAsEnemy({
    scene,
    commanderActorId: payload.commanderActorId,
    enemyToken,
    user,
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
    placements[actorId] = droppedPlacement(placement, tokenDocument.object ?? { document: tokenDocument });
    dropped.push(placements[actorId]);
  }
  if (!dropped.length) return 0;
  await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  for (const placement of dropped) {
    await syncBannerObject(scene, placement);
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
  registerOperation(PLANT_OPERATION, serializeBannerOperation(handlePlantBanner));
  registerOperation(RETRIEVE_OPERATION, serializeBannerOperation(handleRetrieveBanner));
  registerOperation(REMOVE_OPERATION, serializeBannerOperation(handleEnemyBannerRemoval));
  registerOperation(DROP_OPERATION, serializeBannerOperation(handleCarriedBannerDrop));
  registerOperation(PICKUP_OPERATION, serializeBannerOperation(handleDroppedBannerPickup));
  globalThis.Hooks?.on?.("deleteToken", (tokenDocument) => {
    if (!mayManagePlacements()) return;
    dropCarriedBannersForToken(tokenDocument).catch((error) => {
      console.error(`${FLAG_SCOPE} | Could not drop a carried banner from a deleted token`, error);
    });
  });
}

export function requestPlantBanner(actor, corner, scene = globalThis.canvas?.scene) {
  if (!hasPlantBanner(actor)) throw new Error("This commander does not have the Plant Banner feat.");
  if (!scene?.id || globalThis.canvas?.ready !== true) {
    throw new Error("Open an active scene before planting the banner.");
  }
  const token = activeTokenFor(actor);
  const tokenUuid = token?.document?.uuid ?? token?.uuid;
  if (!tokenUuid) throw new Error("Place this commander on the active scene before planting the banner.");
  return requestOperation(PLANT_OPERATION, {
    sceneId: scene.id,
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenUuid,
    corner,
  }, { gmRequired: true });
}

export function requestRetrieveBanner(actor, scene = globalThis.canvas?.scene, { force = false } = {}) {
  if (force && !globalThis.game?.user?.isGM) throw new Error("Only a GM can force banner retrieval.");
  const placement = plantedBanner(actor, scene);
  const token = sceneToken(scene, placement?.tokenUuid) ?? activeTokenFor(actor);
  const tokenUuid = token?.document?.uuid ?? token?.uuid;
  if (!scene?.id || !placement || (!tokenUuid && !force)) return false;
  return requestOperation(RETRIEVE_OPERATION, {
    sceneId: scene.id,
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenUuid,
    force,
  }, { gmRequired: true });
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
  }, { gmRequired: true, timeoutMs: 120_000 });
}

export function requestCarriedBannerDrop(carrierToken, commanderActorId, scene = globalThis.canvas?.scene) {
  const carrierTokenUuid = carrierToken?.document?.uuid ?? carrierToken?.uuid;
  if (!scene?.id || !carrierTokenUuid) throw new Error("Use the banner carrier on the active scene.");
  return requestOperation(DROP_OPERATION, {
    sceneId: scene.id,
    commanderActorId,
    carrierTokenUuid,
  }, { gmRequired: true });
}

export function requestDroppedBannerPickup(enemyToken, commanderActorId, scene = globalThis.canvas?.scene) {
  const enemyTokenUuid = enemyToken?.document?.uuid ?? enemyToken?.uuid;
  if (!scene?.id || !enemyTokenUuid) throw new Error("Use an adjacent enemy on the active scene.");
  return requestOperation(PICKUP_OPERATION, {
    sceneId: scene.id,
    commanderActorId,
    enemyTokenUuid,
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
  if (placement?.removalMode === "destroyed") return false;
  const token = sceneToken(scene, placement?.tokenUuid) ?? activeTokenFor(actor);
  if (!placement || !token) return false;
  const carrier = bannerCarrierToken(placement, scene);
  if (!tokenBounds(token) || (carrier && !tokenBounds(carrier))) return false;
  const distance = carrier
    ? boundsRange(tokenBounds(carrier), tokenBounds(token), scene)
    : bannerRangeToBounds(bannerDisplayPoint(placement, scene), tokenBounds(token), {
        gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
        gridDistance: scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
      });
  return withinBannerReach(token, carrier ? tokenPosition(carrier) : placement, distance);
}

export async function plantBanner(actor, corner, scene = globalThis.canvas?.scene, { token = activeTokenFor(actor) } = {}) {
  if (!hasPlantBanner(actor)) throw new Error("This commander does not have the Plant Banner feat.");
  if (!scene) throw new Error("Open an active scene before planting the banner.");
  if (!token) throw new Error("Place this commander on the active scene before planting the banner.");
  const mapPoint = typeof corner === "object" && corner !== null;
  const range = hasClaimTheField(actor) ? claimTheFieldRange(actor) : 0;
  const claimed = range > 0;
  if (mapPoint && !hasClaimTheField(actor)) throw new Error("This commander does not have Claim the Field.");
  if (mapPoint && !claimed) throw new Error("Configure the banner's affixed item as a thrown weapon first.");
  let point;
  if (claimed) {
    point = mapPoint ? { x: corner.x, y: corner.y } : bannerCorner(tokenBounds(token), corner);
    if (![point.x, point.y].every(Number.isFinite)) throw new Error("Choose a valid map corner.");
    const grid = scene.grid;
    const snapped = grid.getSnappedPoint(point, { mode: CONST.GRID_SNAPPING_MODES.VERTEX });
    if (Math.hypot(snapped.x - point.x, snapped.y - point.y) > 0.01) throw new Error("Choose a grid corner.");
    const bounds = tokenBounds(token);
    const origin = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    const distance = grid.measurePath([origin, point]).distance;
    if (!Number.isFinite(distance) || distance > range) throw new Error(`Place the banner within the weapon's first range increment (${range} feet).`);
  } else point = bannerCorner(tokenBounds(token), corner);

  const placements = clone(sceneBannerPlacements(scene));
  if (placements[actor.id]) throw new Error("Retrieve the existing banner before planting it again.");
  const placement = {
    actorId: actor.id,
    actorUuid: actor.uuid,
    tokenUuid: token.document?.uuid ?? null,
    x: point.x,
    y: point.y,
    ...tokenPosition(token),
    radius: plantedBannerRadius(actor),
    corner: mapPoint ? null : corner,
    ...(claimed ? { claimTheField: true } : {}),
  };
  placements[actor.id] = placement;
  const suppressNativeAura = actor?.rollOptions?.all?.["commanders-banner"] === true;
  if (typeof scene.createEmbeddedDocuments === "function") {
    Object.assign(placement, await createBannerObject(actor, scene, placement));
  }
  try {
    if (suppressNativeAura) await setBannerActive(actor, false);
    await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
  } catch (error) {
    await removeBannerObjectToken(scene, placement);
    if (suppressNativeAura) await setBannerActive(actor, true);
    throw error;
  }
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, actor, placement);
  return placement;
}

export async function retrieveBanner(actor, scene = globalThis.canvas?.scene, { allowCarried = false, force = false } = {}) {
  if (force && !globalThis.game?.user?.isGM) throw new Error("Only a GM can force banner retrieval.");
  const placement = scene ? plantedBanner(actor, scene) : null;
  if (!scene || !placement) return false;
  if (placement.removalMode === "destroyed") throw new Error("A destroyed banner must be replaced by the GM.");
  if (placement.removalMode === "carried" && !allowCarried && !force) {
    throw new Error("A GM must rule the check to recover a banner carried by an enemy.");
  }
  if (!force && !canRetrieveBanner(actor, scene)) {
    const message = placement.removalMode === "carried"
      ? `Move within unarmed reach of ${placement.removedBy?.actorName ?? "the banner carrier"} before retrieving it.`
      : "Move within unarmed reach of the planted banner before retrieving it.";
    throw new Error(message);
  }
  const restoreNativeAura = !placement.broken && placement.removalMode !== "destroyed" && actor?.rollOptions?.all?.["commanders-banner"] !== true;
  const placements = clone(sceneBannerPlacements(scene));
  delete placements[actor.id];
  try {
    if (typeof scene.update === "function") await scene.update({ [`flags.${FLAG_SCOPE}.${PLACEMENTS_FLAG}.-=${actor.id}`]: null });
    else if (Object.keys(placements).length) await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
    else await scene.unsetFlag(FLAG_SCOPE, PLACEMENTS_FLAG);
  } catch (error) {
    throw error;
  }
  try {
    await clearPlantedBannerEffects(actor.uuid, scene);
  } catch (error) {
    placements[actor.id] = placement;
    await scene.setFlag(FLAG_SCOPE, PLACEMENTS_FLAG, placements);
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
  await removeBannerObjectToken(scene, placement);
  return true;
}
