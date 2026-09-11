import { FLAG_SCOPE, MODULE_ID } from "../constants.js";
import { isTacticItem } from "../domain/tactics.js";
import { preparedCapacity } from "../domain/rules.js";

export function notify(level, message) {
  ui.notifications?.[level]?.(message);
}

export function hasCommanderFeatures(actor) {
  if (!actor) return false;
  const items = actor.items ?? [];
  return actor.class?.slug === "commander"
    || items.some((item) => ["commander-dedication", "tactics"].includes(item.slug))
    || items.some(isTacticItem);
}

export function hasDrilledReactions(actor) {
  return actor?.items?.some((item) => item.slug === "drilled-reactions") === true;
}

export function bannerActive(actor) {
  const placement = globalThis.canvas?.scene?.getFlag?.(FLAG_SCOPE, "plantedBanners")?.[actor?.id];
  if (placement?.actorUuid === actor?.uuid) return placement.removed !== true && placement.broken !== true;
  return actor?.rollOptions?.all?.["commanders-banner"] === true;
}

export function bannerToggle(actor) {
  for (const item of actor?.items ?? []) {
    const rule = item.system?.rules?.find((candidate) => candidate.key === "RollOption"
      && candidate.option === "commanders-banner"
      && candidate.toggleable === true);
    if (rule) {
      return {
        domain: rule.domain ?? "all",
        option: rule.option,
        itemId: item.id,
      };
    }
  }
  return null;
}

export async function setBannerActive(actor, active) {
  const object = globalThis.game?.actors?.find?.((candidate) => candidate.getFlag?.(FLAG_SCOPE, "bannerObject")?.commanderUuid === actor.uuid);
  const hp = object?.system?.attributes?.hp;
  if (active && hp && hp.value <= Math.floor(hp.max / 2)) {
    throw new Error("Repair or replace this commander's banner before displaying it.");
  }
  const toggle = bannerToggle(actor);
  if (!toggle || typeof actor?.toggleRollOption !== "function") {
    throw new Error("This actor has no toggleable Commander's Banner feature.");
  }
  await actor.toggleRollOption(toggle.domain, toggle.option, toggle.itemId, Boolean(active));
  return Boolean(active);
}

export function activeTokenFor(actor) {
  if (actor?.token?.object) return actor.token.object;
  return actor?.getActiveTokens?.()?.[0] ?? null;
}

export function ownedTactics(actor) {
  return actor?.items?.filter(isTacticItem).sort((a, b) => a.name.localeCompare(b.name)) ?? [];
}

export function getDailiesApi() {
  const module = game.modules.get("pf2e-dailies");
  if (!module?.active) return null;
  return game.dailies?.api ?? module.api ?? {};
}

export function dailiesPreparationActor(actor) {
  return actor?.token?.baseActor ?? actor;
}

function storedDailiesTacticIds(actor) {
  const selections = actor?.getFlag?.("pf2e-dailies", "extra.dailies.commander-tactics.tactics")
    ?? actor?.flags?.["pf2e-dailies"]?.extra?.dailies?.["commander-tactics"]?.tactics
    ?? actor?.getFlag?.("pf2e-dailies", "dailies.commander-tactics")
    ?? actor?.flags?.["pf2e-dailies"]?.dailies?.["commander-tactics"];
  const values = Array.isArray(selections)
    ? selections
    : Object.values(selections ?? {});
  return values.filter((id) => typeof id === "string" && id.length > 0);
}

export function preparedTacticIds(actor) {
  const dailies = getDailiesApi();
  const preparationActor = dailiesPreparationActor(actor);
  if (typeof dailies?.getCommanderTactics === "function") {
    return new Set(dailies.getCommanderTactics(preparationActor) ?? []);
  }
  if (dailies) return new Set(storedDailiesTacticIds(preparationActor));
  return new Set(actor.getFlag(FLAG_SCOPE, "preparedTactics") ?? []);
}

export function preparationLimit(actor) {
  const level = actor?.level ?? actor?.system?.details?.level?.value ?? 1;
  const efficientPreparation = actor?.items?.some((item) => item.slug === "efficient-preparation") === true;
  const tacticalExcellence = actor?.items?.filter((item) => item.slug === "tactical-excellence").length ?? 0;
  return preparedCapacity({
    level,
    commander: actor?.class?.slug === "commander",
    efficientPreparation,
    tacticalExcellence,
  });
}

export async function togglePreparedTactic(actor, itemId) {
  const dailies = getDailiesApi();
  const preparationActor = dailies ? dailiesPreparationActor(actor) : actor;
  const ids = preparedTacticIds(actor);
  if (ids.has(itemId)) ids.delete(itemId);
  else {
    const limit = preparationLimit(preparationActor);
    if (ids.size >= limit) {
      notify("warn", `This actor can prepare ${limit} tactics.`);
      return false;
    }
    ids.add(itemId);
  }
  if (dailies) {
    await preparationActor.setFlag(
      "pf2e-dailies",
      "extra.dailies.commander-tactics.tactics",
      [...ids]
    );
  } else {
    await actor.setFlag(FLAG_SCOPE, "preparedTactics", [...ids]);
  }
  return true;
}

export function classDC(actor) {
  return Number(
    actor?.attributes?.classDC?.value
    ?? actor?.system?.attributes?.classDC?.value
    ?? actor?.system?.proficiencies?.classDCs?.commander?.dc
    ?? 10
  );
}

export function actorLevel(actor) {
  return Number(actor?.level ?? actor?.system?.details?.level?.value ?? 0);
}

export function actorCanUserModify(actor, user = game.user) {
  return user?.isGM === true || actor?.testUserPermission?.(user, "OWNER") === true;
}

export function commanderFlag(path) {
  return `flags.${MODULE_ID}.${path}`;
}

export function escapeHtml(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}
