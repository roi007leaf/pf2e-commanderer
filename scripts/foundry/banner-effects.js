import { FLAG_SCOPE, MODULE_ID } from "../constants.js";
import { bannerRangeToBounds } from "../domain/banner-placement.js";
import { sceneBannerPlacements } from "./banner.js";
import { setBannerActive } from "./runtime.js";

const BANNER_EFFECT_UUID = "Compendium.pf2e.feat-effects.Item.JZWi6512m9RlMrNO";
const BANNER_SLUG = "commanders-banner";
const EFFECT_FLAG = "plantedBannerOrigin";

let registered = false;
let syncQueued = false;
let pendingScene = null;
let syncChain = Promise.resolve();

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

function actorsCollection() {
  const actors = globalThis.game?.actors;
  return actors?.contents ?? (actors ? Array.from(actors) : []);
}

function actorItems(actor) {
  return actor?.items ? Array.from(actor.items) : [];
}

function managedOrigin(item) {
  return item?.getFlag?.(FLAG_SCOPE, EFFECT_FLAG)
    ?? item?.flags?.[FLAG_SCOPE]?.[EFFECT_FLAG]
    ?? null;
}

function nativeAuraOrigin(item) {
  return item?.flags?.pf2e?.aura ?? null;
}

function commanderFor(placement) {
  return globalThis.game?.actors?.get?.(placement.actorId)
    ?? (globalThis.canvas?.tokens?.placeables ?? []).find((token) => token.actor?.uuid === placement.actorUuid)?.actor
    ?? globalThis.fromUuidSync?.(placement.actorUuid)
    ?? null;
}

function tokenIsAlly(commander, token) {
  const actor = token?.actor;
  if (!actor) return false;
  if (actor.uuid === commander.uuid) return true;
  if (typeof actor.isAllyOf === "function") return actor.isAllyOf(commander);
  return actor.alliance != null && actor.alliance === commander.alliance;
}

function tokenInside(placement, token, scene) {
  const bounds = token?.mechanicalBounds ?? token?.bounds;
  if (!bounds) return false;
  return bannerRangeToBounds(placement, bounds, {
    gridSize: globalThis.canvas?.grid?.size ?? globalThis.canvas?.dimensions?.size ?? 100,
    gridDistance: scene?.grid?.distance ?? globalThis.canvas?.dimensions?.distance ?? 5,
  }) <= Number(placement.radius ?? 40);
}

function effectStart(commander) {
  const combatant = globalThis.game?.combat?.combatants?.find?.((entry) => entry.actor?.uuid === commander.uuid);
  return {
    value: globalThis.game?.time?.worldTime ?? 0,
    initiative: combatant?.initiative ?? globalThis.game?.combat?.combatant?.initiative ?? null,
  };
}

function bannerFeature(commander) {
  return actorItems(commander).find((item) => item.slug === "commanders-banner") ?? null;
}

function expectedRecipients(scene) {
  const expected = new Map();
  const tokens = globalThis.canvas?.tokens?.placeables ?? [];
  for (const placement of Object.values(sceneBannerPlacements(scene))) {
    const commander = commanderFor(placement);
    if (!commander) continue;
    for (const token of tokens) {
      if (!tokenIsAlly(commander, token) || !tokenInside(placement, token, scene)) continue;
      let commanders = expected.get(token.actor.uuid);
      if (!commanders) expected.set(token.actor.uuid, commanders = new Map());
      commanders.set(commander.uuid, commander);
    }
  }
  return expected;
}

function actorsToInspect() {
  const actors = new Map();
  for (const actor of actorsCollection()) actors.set(actor.uuid, actor);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor);
  }
  return actors;
}

async function createBannerEffect(actor, commander, sceneId, baseEffect) {
  const source = baseEffect.toObject();
  delete source._id;
  source.system ??= {};
  source.system.context ??= {};
  source.system.context.origin = {
    actor: commander.uuid,
    item: bannerFeature(commander)?.uuid ?? null,
  };
  source.system.duration ??= {};
  source.system.duration.unit = "unlimited";
  source.system.duration.expiry = null;
  source.system.start = effectStart(commander);
  source.flags ??= {};
  source.flags[FLAG_SCOPE] ??= {};
  source.flags[FLAG_SCOPE][EFFECT_FLAG] = { commanderUuid: commander.uuid, sceneId };
  await actor.createEmbeddedDocuments("Item", [source]);
}

export async function syncPlantedBannerEffects(scene = globalThis.canvas?.scene) {
  if (!mayManageEffects() || !scene || scene.id !== globalThis.canvas?.scene?.id) return;
  const placements = Object.values(sceneBannerPlacements(scene));
  for (const placement of placements) {
    const commander = commanderFor(placement);
    if (commander?.rollOptions?.all?.[BANNER_SLUG] === true) {
      try {
        await setBannerActive(commander, false);
      } catch (error) {
        console.warn(`${MODULE_ID} | Could not suppress carried banner aura for ${commander.name}`, error);
      }
    }
  }
  const plantedCommanderUuids = new Set(placements.map((placement) => placement.actorUuid));
  const expected = expectedRecipients(scene);
  const actors = actorsToInspect();
  let baseEffect = null;

  for (const actor of actors.values()) {
    const wanted = expected.get(actor.uuid) ?? new Map();
    const existingByCommander = new Map();
    const removals = [];

    for (const item of actorItems(actor)) {
      const nativeOrigin = nativeAuraOrigin(item);
      if (nativeOrigin?.slug === BANNER_SLUG && plantedCommanderUuids.has(nativeOrigin.origin)) {
        removals.push(item.id);
        continue;
      }
      const origin = managedOrigin(item);
      if (!origin || origin.sceneId !== scene.id) continue;
      if (!wanted.has(origin.commanderUuid) || existingByCommander.has(origin.commanderUuid)) removals.push(item.id);
      else existingByCommander.set(origin.commanderUuid, item);
    }

    if (removals.length) await actor.deleteEmbeddedDocuments("Item", removals);
    for (const [commanderUuid, commander] of wanted) {
      if (existingByCommander.has(commanderUuid)) continue;
      baseEffect ??= await globalThis.fromUuid?.(BANNER_EFFECT_UUID);
      if (!baseEffect) throw new Error(`Missing PF2e effect: ${BANNER_EFFECT_UUID}`);
      await createBannerEffect(actor, commander, scene.id, baseEffect);
    }
  }
}

function reportSyncError(error) {
  console.error(`${MODULE_ID} | Failed to synchronize planted banner effects`, error);
}

function scheduleSync(scene = globalThis.canvas?.scene) {
  if (!mayManageEffects()) return;
  pendingScene = scene;
  if (syncQueued) return;
  syncQueued = true;
  globalThis.setTimeout(() => {
    syncQueued = false;
    const nextScene = pendingScene;
    pendingScene = null;
    syncChain = syncChain.then(() => syncPlantedBannerEffects(nextScene)).catch(reportSyncError);
  }, 0);
}

export function registerPlantedBannerEffects() {
  if (registered) return;
  registered = true;
  globalThis.Hooks?.on?.("canvasReady", () => scheduleSync());
  globalThis.Hooks?.on?.("updateToken", () => scheduleSync());
  globalThis.Hooks?.on?.("createToken", () => scheduleSync());
  globalThis.Hooks?.on?.("deleteToken", () => scheduleSync());
  globalThis.Hooks?.on?.("updateActor", () => scheduleSync());
  globalThis.Hooks?.on?.("updateScene", (scene) => {
    if (scene?.id === globalThis.canvas?.scene?.id) scheduleSync(scene);
  });
  globalThis.Hooks?.on?.(`${MODULE_ID}.bannerPlacementChanged`, () => scheduleSync());
  scheduleSync();
}
