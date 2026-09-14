import { CONDITION_UUIDS, MODULE_ID } from "../constants.js";
import { resolutionGeometryVerdict } from "../domain/tactic-resolution.js";
import { activeTokenFor, actorLevel, classDC } from "./runtime.js";
import { GUIDED_AFTERMATHS, guidedAftermath } from "./guided-tactics.js";

function effectStart(commander) {
  const combatant = game.combat?.combatants?.find((entry) => entry.actor?.uuid === commander.uuid);
  return {
    value: game.time.worldTime,
    initiative: combatant?.initiative ?? game.combat?.combatant?.initiative ?? null,
  };
}

function effectSource({ commander, item, name, img, rules, duration = 1, expiry = "turn-start", unit = "rounds", description = null }) {
  return {
    name,
    type: "effect",
    img: img ?? item?.img ?? "icons/svg/aura.svg",
    system: {
      badge: null,
      context: { origin: { actor: commander.uuid, item: item?.uuid ?? null }, target: null, roll: null },
      description: { value: description ?? `<p>Automated by ${MODULE_ID}.</p>` },
      duration: { expiry, sustained: false, unit, value: duration },
      level: { value: actorLevel(commander) },
      publication: { license: "ORC", remaster: true, title: "PF2e Commanderer" },
      rules,
      slug: null,
      start: effectStart(commander),
      tokenIcon: { show: true },
      traits: { rarity: "common", value: [] },
      unidentified: false,
    },
  };
}

export async function grantCompendiumEffect(actor, uuid) {
  const effect = await fromUuid(uuid);
  if (!effect) throw new Error(`Missing PF2e effect: ${uuid}`);
  await actor.createEmbeddedDocuments("Item", [effect.toObject()]);
  return effect.name;
}

export async function grantTemporaryCondition(actor, condition, value, { commander, item, name, expiry = "turn-start", duration = 1 }) {
  const uuid = CONDITION_UUIDS[condition];
  if (!uuid) throw new Error(`Unknown condition: ${condition}`);
  const alterations = value > 1 ? [{ mode: "upgrade", property: "badge-value", value }] : [];
  const source = effectSource({
    commander,
    item,
    name,
    expiry,
    duration,
    rules: [{ key: "GrantItem", inMemoryOnly: true, uuid, alterations }],
  });
  await actor.createEmbeddedDocuments("Item", [source]);
}

export async function grantWaitForIt(actor, commander, item) {
  const source = effectSource({
    commander,
    item,
    name: `Effect: ${item.name}`,
    expiry: "turn-end",
    rules: [{ key: "RollOption", domain: "all", option: "commanderer:waiting", label: "Still Delaying or Readying", toggleable: true, value: true }, {
      key: "FlatModifier",
      selector: ["ac", "saving-throw"],
      type: "circumstance",
      value: 1,
      predicate: ["commanderer:waiting"],
      label: item.name,
    }],
  });
  await actor.createEmbeddedDocuments("Item", [source]);
}

export async function grantPiranhaAssault(actor, commander, item, targetUuid) {
  const targetToken = await fromUuid(targetUuid);
  const target = targetToken?.actor;
  if (!target?.signature) throw new Error("The designated Piranha Assault target is unavailable.");
  const amount = actorLevel(commander);
  const note = `Against ${target.name}, ignore up to ${amount} points of resistance when this damage's type is resisted.`;
  const source = effectSource({
    commander,
    item,
    name: `Effect: ${item.name} (${target.name})`,
    duration: 1,
    unit: "minutes",
    expiry: "turn-start",
    description: `<p>${foundry.utils.escapeHTML(note)}</p>`,
    rules: [
      { key: "RollOption", domain: "all", option: `commanderer:piranha-assault:${target.signature}` },
      {
        key: "Note",
        selector: ["damage", "strike-damage", "spell-damage"],
        predicate: [`target:signature:${target.signature}`],
        text: note,
      },
    ],
  });
  source.flags = { [MODULE_ID]: { workflow: { commanderUuid: commander.uuid, piranhaTarget: targetUuid } } };
  await actor.createEmbeddedDocuments("Item", [source]);
  return `tracked ${item.name} against ${target.name} for 1 minute; resistance bypass ${amount}`;
}

export async function grantShadowsInMoonlight(actor, commander, item, guideRank = 2) {
  const note = "Count as Following the Expert for Hide and Sneak checks, and ignore the noisy armor trait.";
  const source = effectSource({
    commander,
    item,
    name: `Effect: ${item.name}`,
    description: `<p>${note}</p>`,
    expiry: "turn-end",
    rules: [{ key: "RollOption", domain: "skill-check", option: "armor:ignore-noisy-penalty" },
        { key: "FlatModifier", selector: "stealth", type: "circumstance", value: guideRank,
        predicate: [{ or: ["action:hide", "action:sneak"] }] },
      { key: "FlatModifier", selector: "stealth", type: "proficiency", value: actorLevel(actor),
        predicate: ["skill:stealth:rank:0", { or: ["action:hide", "action:sneak"] }] }, {
      key: "Note",
      selector: ["stealth", "skill-check"],
      predicate: [{ or: ["action:hide", "action:sneak"] }],
      text: note,
    }],
  });
  await actor.createEmbeddedDocuments("Item", [source]);
  return "tracked Following the Expert and noisy-armor benefits until the commander's next turn";
}

function degreeLabel(degree) {
  return ["Critical Failure", "Failure", "Success", "Critical Success"][degree] ?? "Result";
}

async function addCondition(actor, slug, value = 1) {
  await actor.increaseCondition(slug, { value, max: value });
}

function actorHasImmunity(actor, type) {
  const immunities = actor.attributes?.immunities ?? actor.system?.attributes?.immunities ?? [];
  return [...immunities].some((immunity) => immunity?.type === type || immunity?.slug === type);
}

export function pincerAttackRules(signatures, label = "Pincer Attack") {
  const originOptions = [...new Set(signatures.filter(Boolean))]
    .map((signature) => `origin:signature:${signature}`);
  if (!originOptions.length) return [];
  return [{
    key: "FlatModifier",
    selector: "ac",
    type: "circumstance",
    value: -2,
    label,
    predicate: ["item:melee", { or: originOptions }],
  }];
}

async function grantPincerAttack(target, commander, item, participants) {
  const attackers = [commander, ...participants.filter((participant) => participant.status === "responded").map((participant) => participant.actor)];
  const rules = pincerAttackRules(attackers.map((actor) => actor?.signature), item.name);
  if (!rules.length) throw new Error("Could not identify the Pincer Attack participants.");
  const source = effectSource({ commander, item, name: `Effect: ${item.name}`, rules });
  await target.createEmbeddedDocuments("Item", [source]);
}

async function addPersistentBleed(actor, commander, item) {
  if (actorHasImmunity(actor, "bleed")) return false;
  const condition = game.pf2e.ConditionManager.getCondition("persistent-damage");
  if (!condition) throw new Error("PF2e persistent damage automation is unavailable.");
  const source = foundry.utils.mergeObject(condition.toObject(), {
    name: `Persistent Bleed (${item.name})`,
    system: { persistent: { formula: "10", damageType: "bleed", dc: 15 } },
    flags: { [MODULE_ID]: { commanderUuid: commander.uuid, tacticUuid: item.uuid } },
  }, { inplace: false });
  await actor.createEmbeddedDocuments("Item", [source]);
  return true;
}

async function healSanguineSquad(targetToken, participants, commander, item) {
  const eligible = participants.filter((participant) => participant.token?.object
    && participant.actor
    && participant.token.object.distanceTo(targetToken.object) <= 20);
  const unique = [...new Map(eligible.map((participant) => [participant.actor.uuid, participant])).values()];
  if (!unique.length) return { total: 0, names: [] };
  const roll = await new Roll("10d6").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: commander }),
    flavor: `${item.name}: shared squad healing`,
  });
  for (const participant of unique) {
    await participant.actor.applyDamage({ damage: -roll.total, token: participant.token, skipIWR: true });
  }
  return { total: roll.total, names: unique.map((participant) => participant.actor.name) };
}

async function applyResolution(effect, target, degree, context) {
  const { commander, item, participants, squad, targetToken } = context;
  if (effect === "pincer-attack") {
    await grantPincerAttack(target, commander, item, participants);
    return "off-guard to responder melee attacks";
  }
  if (effect === "tactical-takedown" && degree <= 1) {
    await addCondition(target, "prone");
    return "prone";
  }
  if (effect === "buckle-cut-blitz" && degree <= 1) {
    const value = degree === 0 ? 2 : 1;
    await grantTemporaryCondition(target, "clumsy", value, { commander, item, name: `Effect: ${item.name}` });
    return `clumsy ${value}`;
  }
  if (effect === "stupefying-raid" && degree <= 1) {
    const value = degree === 0 ? 2 : 1;
    await grantTemporaryCondition(target, "stupefied", value, { commander, item, name: `Effect: ${item.name}` });
    return `stupefied ${value}`;
  }
  if (effect === "demoralizing-charge" && degree <= 1) {
    const value = degree === 0 ? 2 : 1;
    await addCondition(target, "frightened", value);
    return `frightened ${value}`;
  }
  if (effect === "mirrored-wall" && degree <= 1) {
    await grantTemporaryCondition(target, "blinded", 1, { commander, item, name: `Effect: ${item.name}` });
    if (degree === 0) {
      await grantTemporaryCondition(target, "dazzled", 1, { commander, item, name: `Aftereffect: ${item.name}`, duration: 4 });
    }
    return degree === 0 ? "blinded 1 round; dazzled 3 more rounds" : "blinded 1 round";
  }
  if (effect === "end-it" && degree <= 1) {
    await grantTemporaryCondition(target, "fleeing", 1, { commander, item, name: `Effect: ${item.name}` });
    if (degree === 0) await addCondition(target, "frightened", 2);
    return degree === 0 ? "fleeing; frightened 2" : "fleeing";
  }
  if (effect === "roaring-charge" && degree < 3) {
    const value = degree === 2 ? 1 : degree === 1 ? 2 : 3;
    await addCondition(target, "frightened", value);
    if (degree === 0) await grantTemporaryCondition(target, "fleeing", 1, { commander, item, name: `Effect: ${item.name}` });
    return degree === 0 ? "frightened 3; fleeing" : `frightened ${value}`;
  }
  if (effect === "sanguine-revitalization") {
    const bleeding = degree <= 1 ? await addPersistentBleed(target, commander, item) : false;
    const healing = await healSanguineSquad(targetToken, squad, commander, item);
    const bleedResult = bleeding ? "10 persistent bleed" : "no persistent bleed";
    return `${bleedResult}; healed ${healing.names.join(", ") || "no squadmates"} for ${healing.total}`;
  }
  if (effect === "insta-ballista") {
    const assistants = Math.min(4, participants.filter((participant) => participant.status === "responded").length);
    return `formation verified; custom martial ranged Strike gets +${assistants} item bonus and deals 10d12 piercing`;
  }
  return "no automated effect";
}

function actorsAreEnemies(actor, other) {
  if (typeof actor?.isEnemyOf === "function") return actor.isEnemyOf(other);
  return actor?.alliance != null && other?.alliance != null && actor.alliance !== other.alliance;
}

export async function resolveTargets({
  commanderUuid,
  itemUuid,
  targetTokenUuids,
  participantRows = [],
  squadRows = [],
  resolution,
  ignoreGeometry = false,
}) {
  const commander = await fromUuid(commanderUuid);
  const item = await fromUuid(itemUuid);
  if (!commander || !item) throw new Error("Commander or tactic no longer exists.");
  const targetTokens = (await Promise.all([...new Set(targetTokenUuids)].map((uuid) => fromUuid(uuid))))
    .filter((token) => token?.actor && token?.object);
  if (!targetTokens.length) throw new Error("Target at least one affected enemy token on the active scene.");
  if (resolution.target !== "creature" && targetTokens.some((token) => !actorsAreEnemies(commander, token.actor))) {
    throw new Error("Only affected enemy tokens can be resolved.");
  }
  const participants = (await Promise.all(participantRows.map(async (participant) => ({
    ...participant,
    actor: await fromUuid(participant.actorUuid),
    token: await fromUuid(participant.tokenUuid),
  })))).filter((participant) => participant.actor && participant.token?.object);
  const squad = (await Promise.all(squadRows.map(async (member) => ({
    ...member,
    actor: await fromUuid(member.actorUuid),
    token: await fromUuid(member.tokenUuid),
  })))).filter((member) => member.actor && member.token?.object);
  const responders = participants.filter((participant) => participant.status === "responded");
  const commanderToken = activeTokenFor(commander);
  const gridDistance = Number(targetTokens[0]?.parent?.grid?.distance ?? canvas.dimensions?.distance ?? 5);
  const verdict = resolutionGeometryVerdict({
    targetParticipantDistances: targetTokens.map((target) => responders.map((participant) => target.object.distanceTo(participant.token.object))),
    targetCommanderDistances: targetTokens.map((target) => commanderToken ? target.object.distanceTo(commanderToken) : Number.POSITIVE_INFINITY),
    participantPairDistances: responders.flatMap((participant, index) => responders
      .slice(index + 1)
      .map((other) => participant.token.object.distanceTo(other.token.object))),
    maxTargets: resolution.maxTargets,
    minParticipants: ignoreGeometry ? 0 : resolution.minParticipants,
    geometry: ignoreGeometry ? {} : resolution.geometry,
    gridDistance,
  });
  if (!verdict.valid) throw new Error(verdict.message);
  if (GUIDED_AFTERMATHS.has(resolution.effect)) {
    const result = await guidedAftermath({ commander, item, participants, targets: targetTokens, squad });
    return result ? [{ name: item.name, degreeLabel: "Guided resolution", applied: result }] : [];
  }

  const results = [];
  for (const targetToken of targetTokens) {
    const target = targetToken.actor;
    let degree = 2;
    const saveApplies = !(resolution.effect === "sanguine-revitalization" && actorHasImmunity(target, "bleed"));
    if (resolution.save && saveApplies) {
      if (resolution.penaltyEffectUuid) await grantCompendiumEffect(target, resolution.penaltyEffectUuid);
      const statistic = target.saves?.[resolution.save] ?? target.getStatistic?.(resolution.save);
      if (!statistic?.roll) throw new Error(`${target.name} has no ${resolution.save} save.`);
      const roll = await statistic.roll({
        dc: { value: classDC(commander) },
        origin: commander,
        item,
        traits: resolution.traits ?? [],
        extraRollOptions: [`origin:item:slug:${item.slug}`, ...(resolution.traits ?? []), ...(resolution.options ?? [])],
      });
      if (!roll) continue;
      if (!Number.isInteger(roll.degreeOfSuccess)) throw new Error("PF2e returned no save result.");
      degree = roll.degreeOfSuccess;
    }
    const applied = await applyResolution(resolution.effect, target, degree, { commander, item, participants, squad, targetToken });
    results.push({ name: target.name, degree, degreeLabel: resolution.save ? (saveApplies ? degreeLabel(degree) : "Immune to bleed") : "Resolved", applied });
  }
  return results;
}
