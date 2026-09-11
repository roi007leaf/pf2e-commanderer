import { MODULE_ID } from "../constants.js";

const SUMMONS = "pf2e-summons-assistant";
const RANGE_EFFECT = `Compendium.${SUMMONS}.pf2e-summons-assistant-items.Item.vnFV2b3aYdvGeVkM`;
const TEMP_EFFECT = `Compendium.${SUMMONS}.pf2e-summons-assistant-items.Item.uxS1nDflB45y3PPl`;

function sourceId(item) {
  return item.sourceId ?? item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
}

function commanderFromRange(item) {
  const uuid = item.flags?.pf2e?.aura?.origin ?? item.system?.context?.origin?.actor;
  const banner = uuid ? globalThis.fromUuidSync?.(uuid) : null;
  const summoner = banner?.getFlag?.(SUMMONS, "summoner");
  return (summoner?.uuid ? globalThis.fromUuidSync?.(summoner.uuid) : null) ?? banner;
}

function otherAlly(actor, commander) {
  if (!actor || !commander || actor.uuid === commander.uuid) return false;
  return typeof actor.isAllyOf === "function" ? actor.isAllyOf(commander)
    : actor.alliance != null && actor.alliance === commander.alliance;
}

export function bannerRecipientAllowed(item) {
  const actor = item.actor ?? item.parent;
  if (!actor) return true;
  if (sourceId(item) === RANGE_EFFECT) {
    const commander = commanderFromRange(item);
    return !commander || otherAlly(actor, commander);
  }
  if (sourceId(item) !== TEMP_EFFECT) return true;
  const ranges = [...(actor.items ?? [])].filter((effect) => sourceId(effect) === RANGE_EFFECT);
  const commanders = ranges.map(commanderFromRange);
  // A manually applied effect or unresolved origin is not evidence of an enemy grant.
  if (!commanders.length || commanders.some((commander) => !commander)) return true;
  return commanders.some((commander) => otherAlly(actor, commander));
}

export function registerBannerRecipientGuard() {
  Hooks.on("preCreateItem", (item) => {
    if (!bannerRecipientAllowed(item)) return false;
  });
  const gm = game.users?.activeGM;
  if (!game.user.isGM || (gm && gm.id !== game.user.id)) return;
  // Remove only identifiable invalid temporary-HP effects. Leave range markers
  // as provenance until the owning module removes them, so future renewals are blocked.
  const actors = new Map();
  for (const actor of game.actors ?? []) actors.set(actor.uuid, actor);
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor);
  }
  for (const actor of actors.values()) {
    const ids = [...actor.items].filter((item) => sourceId(item) === TEMP_EFFECT && !bannerRecipientAllowed(item)).map((item) => item.id);
    if (ids.length) actor.deleteEmbeddedDocuments("Item", ids).catch((error) => {
      console.error(`${MODULE_ID} | Could not remove opposition banner temporary HP`, error);
    });
  }
}
