import { FLAG_SCOPE } from "../constants.js";

// Capture actual benefit holders before scene updates schedule aura cleanup.
export function bannerBeneficiaries(commanderUuid, scene) {
  const actors = new Map();
  for (const token of scene?.tokens ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor);
  }
  if (scene?.id === globalThis.canvas?.scene?.id) {
    for (const token of globalThis.canvas?.tokens?.placeables ?? []) {
      if (token.actor) actors.set(token.actor.uuid, token.actor);
    }
  }
  return [...actors.values()].filter((actor) => [...(actor.items ?? [])].some((item) => {
    if (item.isExpired || item.system?.disabled) return false;
    const origin = item.getFlag?.(FLAG_SCOPE, "plantedBannerOrigin")
      ?? item.flags?.[FLAG_SCOPE]?.plantedBannerOrigin;
    const native = item.flags?.pf2e?.aura;
    return (origin?.commanderUuid === commanderUuid && origin.sceneId === scene.id)
      || (native?.slug === "commanders-banner" && native.origin === commanderUuid);
  }));
}

export async function frightenBannerBeneficiaries(actors) {
  const results = await Promise.allSettled(actors.map(async (actor) => {
    if (actor.hasCondition?.("frightened") || actor.isImmuneTo?.("frightened")) return;
    const options = new Set(["item:trait:emotion", "item:trait:mental", "item:trait:visual"]);
    if (actor.attributes?.immunities?.some((immunity) => immunity.test?.(options))) return;
    await actor.increaseCondition("frightened", { value: 1, max: 1 });
  }));
  const errors = results.filter((result) => result.status === "rejected");
  if (errors.length) {
    console.error(`${FLAG_SCOPE} | Banner lost: some frightened conditions failed`, errors);
    globalThis.ui?.notifications?.error("Banner lost, but some frightened conditions could not be applied. GM: check affected allies.");
  }
}
