import { FLAG_SCOPE, MODULE_ID } from "../constants.js";
import { bannerRangeToBounds, plantBannerTemporaryHitPoints } from "../domain/banner-placement.js";
import { sceneBannerPlacements } from "./banner.js";

const PLANT_BANNER_EFFECT_UUID = "Compendium.pf2e.feat-effects.Item.KsUQjLQO62BY0lk4";
const TEMP_HP_RADIUS = 30;
const EFFECT_FLAG = "plantBannerTempHpOrigin";

let registered = false;
let operationChain = Promise.resolve();
const placementSnapshots = new Map();

function activeGM() {
  const users = globalThis.game?.users;
  return users?.activeGM
    ?? users?.find?.((user) => user.active && user.isGM)
    ?? null;
}

function mayManageEffects() {
  const user = globalThis.game?.user;
  const gm = activeGM();
  return user?.isGM === true && (!gm || gm.id === user.id);
}

function actorItems(actor) {
  return actor?.items ? Array.from(actor.items) : [];
}

function managedOrigin(item) {
  return item?.getFlag?.(FLAG_SCOPE, EFFECT_FLAG)
    ?? item?.flags?.[FLAG_SCOPE]?.[EFFECT_FLAG]
    ?? null;
}

function commanderFor(placement) {
  return globalThis.game?.actors?.get?.(placement.actorId)
    ?? (globalThis.canvas?.tokens?.placeables ?? []).find((token) => token.actor?.uuid === placement.actorUuid)?.actor
    ?? globalThis.fromUuidSync?.(placement.actorUuid)
    ?? null;
}

function plantBannerFeature(commander) {
  return actorItems(commander).find((item) => item.slug === "plant-banner") ?? null;
}

function tokenIsOtherAlly(commander, token) {
  const actor = token?.actor;
  if (!actor || actor.uuid === commander.uuid) return false;
  if (typeof actor.isAllyOf === "function") return actor.isAllyOf(commander);
  return actor.alliance != null && actor.alliance === commander.alliance;
}

function tokenInsideTempHpBurst(placement, token, scene) {
  const bounds = token?.document?.mechanicalBounds ?? token?.mechanicalBounds ?? token?.bounds;
  if (!bounds) return false;
  return bannerRangeToBounds(placement, bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance: scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
  }) <= TEMP_HP_RADIUS;
}

function tokensForActor(actor) {
  return (globalThis.canvas?.tokens?.placeables ?? []).filter((token) => token.actor?.uuid === actor.uuid);
}

function bestCommanderForActor(actor, scene) {
  let best = null;
  for (const placement of Object.values(sceneBannerPlacements(scene))) {
    if (placement.removed === true || placement.broken === true) continue;
    const commander = commanderFor(placement);
    if (!commander) continue;
    const inBurst = tokensForActor(actor).some((token) => tokenIsOtherAlly(commander, token)
      && tokenInsideTempHpBurst(placement, token, scene));
    if (!inBurst) continue;
    const amount = plantBannerTemporaryHitPoints(commander.level ?? commander.system?.details?.level?.value);
    if (!best || amount > best.amount) best = { commander, amount };
  }
  return best;
}

function effectStart(combatant = null) {
  return {
    value: globalThis.game?.time?.worldTime ?? 0,
    initiative: combatant?.initiative ?? globalThis.game?.combat?.combatant?.initiative ?? null,
  };
}

function effectDuration() {
  return { value: 1, unit: "rounds", expiry: "turn-start", sustained: false };
}

async function createTempHpEffect(actor, commander, scene, combatant = null) {
  const baseEffect = await globalThis.fromUuid?.(PLANT_BANNER_EFFECT_UUID);
  if (!baseEffect) throw new Error(`Missing PF2e effect: ${PLANT_BANNER_EFFECT_UUID}`);
  const source = baseEffect.toObject();
  delete source._id;
  source.system ??= {};
  source.system.context ??= {};
  source.system.context.origin = {
    actor: commander.uuid,
    item: plantBannerFeature(commander)?.uuid ?? null,
  };
  source.system.duration = effectDuration();
  source.system.start = effectStart(combatant);
  source.flags ??= {};
  source.flags[FLAG_SCOPE] ??= {};
  source.flags[FLAG_SCOPE][EFFECT_FLAG] = { commanderUuid: commander.uuid, sceneId: scene.id };
  return actor.createEmbeddedDocuments("Item", [source]);
}

function missingEmbeddedItemId(error) {
  return /^Item "([^"]+)" does not exist!$/.exec(error?.message ?? "")?.[1] ?? null;
}

async function deleteTempHpEffects(actor, effects) {
  let remaining = effects.map((effect) => effect.id);
  while (remaining.length) {
    try {
      await actor.deleteEmbeddedDocuments("Item", remaining);
      return;
    } catch (error) {
      const missingId = missingEmbeddedItemId(error);
      if (!missingId || !remaining.includes(missingId)) throw error;
      remaining = remaining.filter((itemId) => itemId !== missingId);
    }
  }
}

function managedEffects(actor) {
  return actorItems(actor).filter((item) => managedOrigin(item));
}

async function replaceTempHpEffect(actor, commander, scene, combatant = null) {
  const existing = managedEffects(actor);
  if (existing.length) await deleteTempHpEffects(actor, existing);
  if (commander) await createTempHpEffect(actor, commander, scene, combatant);
}

export async function grantInitialPlantBannerTempHp(scene, placement) {
  if (!mayManageEffects() || !scene || !placement || placement.removed === true || placement.broken === true) return 0;
  const commander = commanderFor(placement);
  if (!commander) return 0;
  const recipients = new Map();
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (!tokenIsOtherAlly(commander, token) || !tokenInsideTempHpBurst(placement, token, scene)) continue;
    recipients.set(token.actor.uuid, token.actor);
  }
  for (const actor of recipients.values()) {
    const sameSource = managedEffects(actor)
      .filter((effect) => managedOrigin(effect)?.commanderUuid === commander.uuid);
    if (sameSource.length) await deleteTempHpEffects(actor, sameSource);
    await createTempHpEffect(actor, commander, scene);
  }
  return recipients.size;
}

function actorsToInspect() {
  const actors = new Map();
  const worldActors = globalThis.game?.actors?.contents
    ?? (globalThis.game?.actors ? Array.from(globalThis.game.actors) : []);
  for (const actor of worldActors) actors.set(actor.uuid, actor);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor);
  }
  return actors.values();
}

export async function removePlantBannerTempHp(scene, commanderUuid) {
  if (!mayManageEffects() || !scene || !commanderUuid) return 0;
  let removed = 0;
  for (const actor of actorsToInspect()) {
    const effects = managedEffects(actor).filter((effect) => {
      const origin = managedOrigin(effect);
      return origin.commanderUuid === commanderUuid && origin.sceneId === scene.id;
    });
    if (!effects.length) continue;
    removed += effects.length;
    await deleteTempHpEffects(actor, effects);
  }
  return removed;
}

export async function refreshPlantBannerTempHpForTurn(combatant, scene = globalThis.canvas?.scene) {
  const actor = combatant?.actor;
  if (!mayManageEffects() || !actor || !scene) return false;
  const best = bestCommanderForActor(actor, scene);
  const existing = managedEffects(actor);
  const current = existing.length === 1 ? managedOrigin(existing[0]) : null;

  if (!best) {
    if (existing.length) await deleteTempHpEffects(actor, existing);
    return false;
  }
  if (current?.commanderUuid === best.commander.uuid && current.sceneId === scene.id) {
    await existing[0].update({
      "system.duration": effectDuration(),
      "system.start": effectStart(combatant),
    });
  } else {
    await replaceTempHpEffect(actor, best.commander, scene, combatant);
  }
  return true;
}

function placementSignature(placement) {
  return [placement.actorUuid, placement.x, placement.y, placement.radius, placement.corner, placement.removed === true, placement.broken === true].join(":");
}

function snapshotPlacements(scene) {
  return new Map(Object.entries(sceneBannerPlacements(scene))
    .map(([actorId, placement]) => [actorId, placementSignature(placement)]));
}

async function handleSceneUpdate(scene) {
  if (!mayManageEffects() || !scene || scene.id !== globalThis.canvas?.scene?.id) return;
  const previous = placementSnapshots.get(scene.id) ?? new Map();
  const placements = sceneBannerPlacements(scene);
  const current = snapshotPlacements(scene);
  placementSnapshots.set(scene.id, current);
  for (const [actorId, placement] of Object.entries(placements)) {
    if (previous.get(actorId) === current.get(actorId)) continue;
    if (placement.removed === true || placement.broken === true) await removePlantBannerTempHp(scene, placement.actorUuid);
    else await grantInitialPlantBannerTempHp(scene, placement);
  }
}

function queue(operation) {
  operationChain = operationChain.then(operation).catch((error) => {
    console.error(`${MODULE_ID} | Failed to synchronize Plant Banner temporary HP`, error);
  });
}

export function registerPlantBannerTempHp() {
  if (registered) return;
  registered = true;
  const scene = globalThis.canvas?.scene;
  if (scene) placementSnapshots.set(scene.id, snapshotPlacements(scene));
  globalThis.Hooks?.on?.("canvasReady", () => {
    const activeScene = globalThis.canvas?.scene;
    if (activeScene) placementSnapshots.set(activeScene.id, snapshotPlacements(activeScene));
  });
  globalThis.Hooks?.on?.("updateScene", (updatedScene) => queue(() => handleSceneUpdate(updatedScene)));
  globalThis.Hooks?.on?.("pf2e.startTurn", (combatant) => {
    queue(() => refreshPlantBannerTempHpForTurn(combatant));
  });
}
