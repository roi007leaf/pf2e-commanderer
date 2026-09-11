import { FLAG_SCOPE } from "../constants.js";
import { bannerObjectStats } from "../domain/banner-object.js";
import { bannerBeneficiaries, frightenBannerBeneficiaries } from "./banner-loss.js";

const OBJECT_FLAG = "bannerObject";
const BANNER_IMAGE = `modules/${FLAG_SCOPE}/assets/banner.svg`;
let registered = false;
let chain = Promise.resolve();

export function bannerObjectActor(placement, commander = null) {
  return globalThis.game?.actors?.get?.(placement?.objectActorId)
    ?? (commander ? globalThis.game?.actors?.find?.((candidate) => candidate.getFlag?.(FLAG_SCOPE, OBJECT_FLAG)?.commanderUuid === commander.uuid) : null)
    ?? null;
}

export function bannerObjectSource(commander, stats) {
  return {
    name: `${commander.name}'s Banner`, type: "hazard", img: BANNER_IMAGE,
    ownership: { default: commander.ownership?.default >= 3 ? 2 : 0, ...Object.fromEntries(Object.entries(commander.ownership ?? {})
      .filter(([id, level]) => id !== "default" && level >= 3).map(([id]) => [id, 2])) },
    flags: { [FLAG_SCOPE]: { [OBJECT_FLAG]: { commanderUuid: commander.uuid } } },
    system: {
      details: { level: { value: 0 }, isComplex: false,
        description: "<p>Unattended commander banner. Apply damage normally; PF2e applies Hardness and object immunities. Objects automatically fail applicable saves. The GM determines whether an effect can target this object.</p>" },
      traits: { size: { value: "tiny" }, value: [], rarity: "common" },
      attributes: { ac: { value: stats.ac }, hardness: stats.hardness + stats.bonus,
        hp: { value: stats.hp, max: stats.hp }, emitsSound: false },
      saves: { fortitude: { value: null }, reflex: { value: null }, will: { value: null } },
    },
    prototypeToken: { name: `${commander.name}'s Banner`, actorLink: true, width: 0.5, height: 0.5,
      texture: { src: BANNER_IMAGE }, disposition: 0, sight: { enabled: false },
      bar1: { attribute: "attributes.hp" }, displayBars: 20 },
  };
}

export async function createBannerObject(commander, scene, placement) {
  for (const otherScene of globalThis.game.scenes ?? []) {
    const existing = otherScene.getFlag(FLAG_SCOPE, "plantedBanners")?.[commander.id];
    if (existing?.actorUuid === commander.uuid) throw new Error("Retrieve this commander's banner from its existing scene first.");
  }
  const configuration = commander.getFlag?.(FLAG_SCOPE, "bannerConfiguration") ?? {};
  const stats = bannerObjectStats(commander, configuration);
  let actor = globalThis.game.actors.find((candidate) => candidate.getFlag?.(FLAG_SCOPE, OBJECT_FLAG)?.commanderUuid === commander.uuid);
  const created = !actor;
  if (actor && Number(actor.system.attributes.hp.value) <= 0) {
    throw new Error("This banner is destroyed. The GM must replace it before planting again.");
  }
  if (actor) {
    await actor.update({ "system.attributes.hardness": stats.hardness + stats.bonus,
      "system.attributes.ac.value": stats.ac, "system.attributes.hp.max": stats.hp,
      "system.attributes.hp.value": Math.min(actor.system.attributes.hp.value, stats.hp) });
  } else actor = await Actor.implementation.create(bannerObjectSource(commander, stats));
  try {
    const size = Number(scene.grid.size ?? globalThis.canvas?.grid?.size ?? 100);
    const token = await actor.getTokenDocument({ x: placement.x - size / 4, y: placement.y - size / 4,
      flags: { [FLAG_SCOPE]: { [OBJECT_FLAG]: { commanderUuid: commander.uuid } } } });
    const [document] = await scene.createEmbeddedDocuments("Token", [token.toObject()]);
    return { objectActorId: actor.id, objectTokenId: document.id, objectBaseHardness: stats.hardness,
      broken: actor.system.attributes.hp.value <= Math.floor(actor.system.attributes.hp.max / 2) };
  } catch (error) {
    if (created) await actor.delete();
    throw error;
  }
}

export async function removeBannerObjectToken(scene, placement) {
  if (placement?.objectTokenId && scene.tokens?.get?.(placement.objectTokenId)) {
    await scene.deleteEmbeddedDocuments("Token", [placement.objectTokenId], { commanderBannerCleanup: true });
  }
}

export async function syncBannerObject(scene, placement) {
  const actor = bannerObjectActor(placement);
  if (actor && placement.removed && actor.system.attributes.hardness !== placement.objectBaseHardness) {
    await actor.update({ "system.attributes.hardness": placement.objectBaseHardness });
  }
  const token = scene.tokens?.get?.(placement.objectTokenId);
  if (!token) return;
  const size = Number(scene.grid.size ?? globalThis.canvas?.grid?.size ?? 100);
  const hidden = placement.removalMode === "carried";
  await token.update({ x: placement.x - size / 4, y: placement.y - size / 4, hidden }, { commanderBannerSync: true });
}

export async function destroyBannerObject(actor) {
  const hp = actor.system?.attributes?.hp;
  const destroyedNow = Number(hp?.value) <= 0;
  const broken = Number(hp?.value) <= Math.floor(Number(hp?.max) / 2);
  const origin = actor.getFlag?.(FLAG_SCOPE, OBJECT_FLAG);
  if (!origin) return;
  for (const scene of globalThis.game?.scenes ?? []) {
    const placements = scene.getFlag(FLAG_SCOPE, "plantedBanners") ?? {};
    const entry = Object.entries(placements).find(([, placement]) => placement.objectActorId === actor.id);
    if (!entry || entry[1].removalMode === "destroyed") continue;
    const [id, placement] = entry;
    if (!destroyedNow && Boolean(placement.broken) === broken) continue;
    const recipients = placement.removed ? [] : bannerBeneficiaries(origin.commanderUuid, scene);
    const destroyed = destroyedNow
      ? { ...placement, broken, removed: true, removalMode: "destroyed", carrierTokenUuid: null }
      : { ...placement, broken };
    await scene.setFlag(FLAG_SCOPE, "plantedBanners", { ...placements, [id]: destroyed });
    if (destroyedNow) await frightenBannerBeneficiaries(recipients);
    await syncBannerObject(scene, destroyed);
    globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, null, destroyed);
  }
}

export async function replaceDestroyedBanner(commander, scene = globalThis.canvas?.scene) {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a GM can replace a destroyed banner.");
  const placements = scene?.getFlag(FLAG_SCOPE, "plantedBanners") ?? {};
  const placement = placements[commander.id];
  if (placement?.actorUuid !== commander.uuid || placement.removalMode !== "destroyed") {
    throw new Error("This commander has no destroyed banner to replace.");
  }
  await removeBannerObjectToken(scene, placement);
  const object = bannerObjectActor(placement);
  if (object) await object.update({ "system.attributes.hp.value": object.system.attributes.hp.max });
  await scene.update({ [`flags.${FLAG_SCOPE}.plantedBanners.-=${commander.id}`]: null });
  globalThis.Hooks?.callAll?.(`${FLAG_SCOPE}.bannerPlacementChanged`, commander, null);
}

export function registerBannerObjects() {
  if (registered) return;
  registered = true;
  // Veto individual documents, so bulk-add still includes ordinary creatures.
  // Runs on the initiating client for HUD, tracker, and API creation alike.
  Hooks.on("preCreateCombatant", (combatant) => {
    if (combatant.actor?.getFlag?.(FLAG_SCOPE, OBJECT_FLAG)
      || combatant.token?.getFlag?.(FLAG_SCOPE, OBJECT_FLAG)) return false;
  });
  Hooks.on("updateActor", (actor) => {
    if (!game.user.isGM || (game.users.activeGM && game.users.activeGM.id !== game.user.id)) return;
    if (!actor.getFlag?.(FLAG_SCOPE, OBJECT_FLAG)) return;
    chain = chain.then(() => destroyBannerObject(actor)).catch((error) => {
      console.error(`${FLAG_SCOPE} | Banner destruction failed`, error);
      ui.notifications.error("Could not finish banner destruction. Check the banner and affected allies.");
    });
  });
  Hooks.on("preUpdateToken", (token, changes, options) => {
    if (!token.getFlag?.(FLAG_SCOPE, OBJECT_FLAG) || options.commanderBannerSync) return;
    if (changes.x !== undefined || changes.y !== undefined) {
      ui.notifications.warn("Use Retrieve or the enemy Interact controls to move this banner.");
      return false;
    }
  });
}
