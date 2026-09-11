import { FLAG_SCOPE } from "../constants.js";
import { squadCapacity } from "../domain/rules.js";
import { rankSquadCandidates } from "../domain/squad-readiness.js";
import { activeTokenFor, bannerActive, notify } from "./runtime.js";
import { bannerOrigin, bannerRangeToToken } from "./banner.js";

export function intelligenceModifier(actor) {
  return Number(actor?.abilities?.int?.mod ?? actor?.system?.abilities?.int?.mod ?? 0);
}

export function squadLimit(actor) {
  const override = actor.getFlag?.(FLAG_SCOPE, "squadLimit");
  if (Number.isInteger(override) && override >= 0) return override;
  return squadCapacity(intelligenceModifier(actor));
}

export async function setSquadLimit(actor, value) {
  if (!globalThis.game?.user?.isGM) throw new Error("Only a GM can change squad limits.");
  if (value === "" || value === null) return actor.unsetFlag(FLAG_SCOPE, "squadLimit");
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 0) throw new Error("Squad limit must be a nonnegative integer.");
  await actor.setFlag(FLAG_SCOPE, "squadLimit", limit);
}

export function storedSquad(actor) {
  return actor.getFlag(FLAG_SCOPE, "squad") ?? [];
}

function tokenIsAlliedCandidate(commander, token) {
  const actor = token?.actor;
  if (!actor || actor.uuid === commander.uuid) return false;
  if (token.document?.hidden && !game.user.isGM) return false;
  if (typeof actor.isAllyOf === "function") return actor.isAllyOf(commander);
  return actor.alliance != null && actor.alliance === commander.alliance;
}

function referenceFromToken(token) {
  return {
    actorUuid: token.actor.uuid,
    tokenUuid: token.document.uuid,
    name: token.name,
    img: token.document.texture?.src ?? token.actor.img,
  };
}

export function sceneSquadCandidates(actor) {
  const auraActive = bannerActive(actor);
  const origin = bannerOrigin(actor);
  const current = new Set(storedSquad(actor).map((entry) => entry.actorUuid));
  const targeted = new Set([...(game.user.targets ?? [])].flatMap((token) => token.actor?.uuid ?? []));
  const candidates = (canvas?.tokens?.placeables ?? [])
    .filter((token) => tokenIsAlliedCandidate(actor, token))
    .map((token) => {
      const distance = bannerRangeToToken(actor, token);
      return {
        ...referenceFromToken(token),
        current: current.has(token.actor.uuid),
        targeted: targeted.has(token.actor.uuid),
        auraActive,
        inBannerAura: auraActive && Number.isFinite(distance) && distance <= (origin?.radius ?? 30),
        distance,
      };
    });

  return rankSquadCandidates(candidates);
}

export async function setTargetedSquad(actor) {
  const tokens = [...(game.user.targets ?? [])].filter((token) => tokenIsAlliedCandidate(actor, token));
  const unique = Array.from(new Map(tokens.map((token) => [token.actor.uuid, token])).values());
  if (!unique.length) {
    notify("warn", "Target one or more allied creature tokens to set the squad.");
    return false;
  }
  if (unique.length > squadLimit(actor)) {
    notify("warn", `Squad limit is ${squadLimit(actor)}. Target no more than that many creatures.`);
    return false;
  }
  const squad = unique.map(referenceFromToken);
  await actor.setFlag(FLAG_SCOPE, "squad", squad);
  notify("info", `Squad updated: ${squad.length}/${squadLimit(actor)} members.`);
  return true;
}

export async function toggleSquadMember(actor, actorUuid) {
  const squad = storedSquad(actor);
  const existing = squad.find((entry) => entry.actorUuid === actorUuid);
  if (existing) {
    await actor.setFlag(FLAG_SCOPE, "squad", squad.filter((entry) => entry.actorUuid !== actorUuid));
    return true;
  }
  if (squad.length >= squadLimit(actor)) {
    notify("warn", `Squad is full (${squad.length}/${squadLimit(actor)}). Remove a squadmate first.`);
    return false;
  }
  const candidate = sceneSquadCandidates(actor).find((entry) => entry.actorUuid === actorUuid);
  if (!candidate) {
    notify("warn", "That creature is not an allied squad candidate on this scene.");
    return false;
  }
  await actor.setFlag(FLAG_SCOPE, "squad", [...squad, {
    actorUuid: candidate.actorUuid,
    tokenUuid: candidate.tokenUuid,
    name: candidate.name,
    img: candidate.img,
  }]);
  return true;
}

export async function addNearbySquadCandidates(actor) {
  const squad = storedSquad(actor);
  const current = new Set(squad.map((entry) => entry.actorUuid));
  const nearby = sceneSquadCandidates(actor).filter((candidate) => candidate.inBannerAura && !current.has(candidate.actorUuid));
  const available = Math.max(0, squadLimit(actor) - squad.length);
  if (!nearby.length) {
    notify("info", "No additional allied tokens are inside the banner aura.");
    return false;
  }
  if (nearby.length > available) {
    notify("warn", `${nearby.length} nearby allies found, but only ${available} squad slots remain. Add squadmates individually.`);
    return false;
  }
  await actor.setFlag(FLAG_SCOPE, "squad", [...squad, ...nearby.map((candidate) => ({
    actorUuid: candidate.actorUuid,
    tokenUuid: candidate.tokenUuid,
    name: candidate.name,
    img: candidate.img,
  }))]);
  notify("info", `Added ${nearby.length} nearby ${nearby.length === 1 ? "ally" : "allies"} to the drilled squad.`);
  return true;
}

export async function clearSquad(actor) {
  await actor.unsetFlag(FLAG_SCOPE, "squad");
}

async function resolveMember(reference) {
  const tokenDocument = reference.tokenUuid ? await fromUuid(reference.tokenUuid) : null;
  const actor = tokenDocument?.actor ?? (reference.actorUuid ? await fromUuid(reference.actorUuid) : null);
  const token = tokenDocument?.object ?? activeTokenFor(actor);
  return actor ? {
    actor,
    token,
    actorUuid: actor.uuid,
    tokenUuid: token?.document?.uuid ?? reference.tokenUuid ?? null,
    name: token?.name ?? actor.name,
    img: token?.document?.texture?.src ?? actor.img,
  } : null;
}

export async function resolvedSquad(actor, { includeCommander = true } = {}) {
  const entries = await Promise.all(storedSquad(actor).map(resolveMember));
  const squad = entries.filter(Boolean);
  if (!includeCommander) return squad;
  const token = activeTokenFor(actor);
  return [{
    actor,
    token,
    actorUuid: actor.uuid,
    tokenUuid: token?.document?.uuid ?? null,
    name: token?.name ?? actor.name,
    img: token?.document?.texture?.src ?? actor.img,
    commander: true,
  }, ...squad];
}

export async function squadTacticalState(actor) {
  const auraActive = bannerActive(actor);
  const origin = bannerOrigin(actor);
  const members = await resolvedSquad(actor);
  return members.map((member) => ({
    ...member,
    capabilities: {
      "piercing-slashing-melee": (member.actor.system?.actions ?? []).some((action) => {
        if (action.type !== "strike" || action.ready === false || action.item?.isMelee === false) return false;
        const damageType = action.item?.system?.damage?.damageType ?? action.item?.system?.damage?.type;
        return ["piercing", "slashing"].includes(damageType);
      }),
    },
    auraActive,
    onScene: Boolean(member.token),
    inBannerAura: Boolean(auraActive && origin && member.token && bannerRangeToToken(actor, member.token) <= origin.radius),
  }));
}

export async function eligibleSquad(actor, definition) {
  const members = (await squadTacticalState(actor))
    .filter((member) => member.onScene)
    .filter((member) => !definition.requirement || member.capabilities?.[definition.requirement] === true);
  if (!definition.aura) return members;
  return members.filter((member) => member.inBannerAura);
}
