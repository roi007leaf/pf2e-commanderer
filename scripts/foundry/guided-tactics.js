import { FLAG_SCOPE, CONDITION_UUIDS } from "../constants.js";
import { activeTokenFor, actorLevel, classDC } from "./runtime.js";
import { registerOperation, requestOperation } from "./socket.js";
import { adjacent, condition, confirm, damageRoll, effect, now, numberInput, owner, select, strike } from "./workflow.js";
import { bannerOrigin, bannerRangeToToken } from "./banner.js";
import { storedSquad } from "./squad.js";

export const GUIDED_RESPONSES = new Set(["alley-oop", "for-talmandor-for-freedom"]);
export const GUIDED_AFTERMATHS = new Set(["cry-havoc", "executioners-volley", "corpse-crenellation", "bloody-guillotine", "insta-ballista"]);
const busy = new Set();

export function requestGuidedResponse(context, mode = context.item.slug) {
  return requestOperation("guided-tactic", { actorUuid: context.actor.uuid, commanderUuid: context.commander.uuid,
    itemUuid: context.item.uuid, targetUuids: [...game.user.targets].map((t) => t.document.uuid), mode,
  }, { gmRequired: !game.user.isGM, directed: game.user.isGM, authorityUserId: game.user.id, timeoutMs: 600_000 });
}

export async function executeGuidedTactic(payload, userId) {
  const [actor, commander, item] = await Promise.all([fromUuid(payload.actorUuid), fromUuid(payload.commanderUuid), fromUuid(payload.itemUuid)]);
  if (!actor || !commander || !item || !owner(actor, game.users.get(userId)) || item.actor?.uuid !== commander.uuid
    || !item.system.traits.value.includes("tactic") || !["seek-benefit", "spell-follow-up", "high-ground", "double-team", "protective-screen", "piranha-damage", ...GUIDED_RESPONSES].includes(payload.mode)) {
    throw new Error("Invalid tactic response request.");
  }
  const validMode = payload.mode === item.slug || (payload.mode === "spell-follow-up" && item.slug === "slip-and-sizzle")
    || (payload.mode === "seek-benefit" && item.slug === "seek-and-destroy")
    || (payload.mode === "high-ground" && item.slug === "take-the-high-ground") || (payload.mode === "piranha-damage" && item.slug === "piranha-assault");
  if (!validMode) throw new Error("Response does not belong to this tactic.");
  if (actor.uuid !== commander.uuid && !storedSquad(commander).some((m) => m.actorUuid === actor.uuid)) throw new Error("Responder is not a squadmate.");
  const key = `${actor.uuid}:${item.uuid}`;
  if (busy.has(key)) throw new Error("This response is already in progress.");
  busy.add(key);
  try {
    if (payload.mode === "alley-oop") return await alleyOop(actor, commander, item);
    if (payload.mode === "for-talmandor-for-freedom") return await counteract(actor, commander, item);
    if (payload.mode === "spell-follow-up") return await spellFollowUp(actor, commander, item);
    if (payload.mode === "high-ground") return await highGround(actor, commander, item);
    if (payload.mode === "piranha-damage") return await piranhaDamage(actor, commander, item);
    const targets = await Promise.all(payload.targetUuids.map((uuid) => fromUuid(uuid)));
    if (targets.some((t) => !t?.actor || t.parent?.id !== canvas.scene?.id)) throw new Error("Targets must be creatures on the active scene.");
    if (payload.mode === "seek-benefit") {
      if (targets.length !== 1) throw new Error("Target exactly one newly observed creature.");
      await effect(actor, commander, item, { expiry: "turn-end", rules: [
        { key: "RollOption", domain: "all", option: "seek-and-destroy-precision", toggleable: true, value: true, label: "Seek and Destroy: next hit" },
        { key: "FlatModifier", selector: "strike-damage", damageCategory: "precision", value: Math.floor(actorLevel(commander) / 2),
          predicate: ["seek-and-destroy-precision", `target:signature:${targets[0].actor.signature}`] },
      ], description: "Only the next successful Strike against this newly observed creature. After resolving that hit's damage, disable the effect's toggle or remove the effect. Misses do not consume it." });
      return "Target-scoped precision granted; disable its toggle after the first successful Strike's damage.";
    }
    if (payload.mode === "protective-screen") {
      const target = targets.find((t) => t?.actor?.isAllyOf?.(actor) && adjacent(actor, t));
      if (!target) throw new Error("Target the adjacent ally you are protecting.");
      await effect(target.actor, target.actor, item, { expiry: "turn-end", flags: { adjacentTo: activeTokenFor(actor).document.uuid },
        description: "Your ranged attacks and spellcasting do not trigger reactions while this protection lasts.",
        rules: [{ key: "RollOption", domain: "all", option: "self:protective-screen" },
          { key: "Note", selector: "attack-roll", text: "Protective Screen: ranged attacks and spellcasting do not trigger reactions." }] });
      return `Protected ${target.name} until the end of their next turn or adjacency ends.`;
    }
    if (!await confirm(item.name, "Did the initial Shove or Reposition succeed?")) return "Initial maneuver failed; no follow-up.";
    const enemy = targets.find((t) => t?.actor?.isEnemyOf?.(commander));
    if (!enemy) throw new Error("Target the enemy moved by the successful maneuver.");
    const allies = await squadTokens(commander);
    const choices = allies.filter((t) => t.actor.uuid !== actor.uuid && t.object?.distanceTo(enemy.object) <= Number(canvas.scene.grid.distance));
    const uuid = await select(item.name, "Different adjacent squadmate making reaction Strike", choices.map((t) => ({ value: t.uuid, label: t.name })));
    if (!uuid) return "Follow-up declined.";
    const ally = choices.find((t) => t.uuid === uuid);
    await strike(ally.actor, item, enemy, { mode: "melee", noMap: true });
    return `${ally.name} made the follow-up melee Strike.`;
  } finally { busy.delete(key); }
}

async function squadTokens(commander) {
  return (await Promise.all(storedSquad(commander).map((m) => fromUuid(m.tokenUuid)))).filter((t) => t?.actor && t.parent.id === canvas.scene.id);
}

async function alleyOop(actor, commander, item) {
  const origin = bannerOrigin(commander);
  const receivers = (await squadTokens(commander)).filter((t) => t.actor.uuid !== actor.uuid && bannerRangeToToken(commander, t.object) <= origin.radius);
  const uuid = await select(item.name, "Receiver in banner aura", receivers.map((t) => ({ value: t.uuid, label: t.name })));
  if (!uuid) return null;
  const receiver = receivers.find((t) => t.uuid === uuid);
  const consumables = [...actor.items].filter((i) => ["consumable", "ammo"].includes(i.type) && i.quantity > 0 && !i.isStowed);
  const id = await select(item.name, "Held/worn consumable with one-action activation", consumables.map((i) => ({ value: i.id, label: i.name })));
  if (!id) return null;
  const consumable = actor.items.get(id);
  if (!await confirm(item.name, `Confirm ${consumable.name} is held/worn and eligible for one-action activation. Toss to ${receiver.name}?`)) return null;
  const catches = await confirm(item.name, `${receiver.name}: spend reaction to catch and activate, with a free hand? Declining drops it at the receiver's space.`);
  // PF2e takes the destination first. Keep the tossed item separate so dropping
  // it does not change the carry state of the receiver's existing stack.
  const transferred = await actor.transferItemToActor(receiver.actor, consumable, 1, undefined, true);
  if (!transferred) throw new Error("Item transfer failed; do not activate it.");
  if (!catches) {
    await transferred.update({ "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
    return `${consumable.name} dropped at ${receiver.name}'s space (recorded in receiver inventory).`;
  }
  receiver.actor.sheet.render({ force: true });
  if (transferred.type === "ammo") {
    await confirm(item.name, "Activate and load this ammunition into a compatible wielded reload 0/1 weapon. It remains active until the end of your next turn.");
    await effect(receiver.actor, receiver.actor, item, { expiry: "turn-end", description: `Activated ammunition: ${transferred.name}. Use before this effect expires.` });
  } else {
    await confirm(item.name, "Activate the transferred item once from the receiver's sheet. Resolve its native effect and consumption, then continue.");
  }
  return `Transferred one ${consumable.name}; receiver activation guided.`;
}

async function counteract(actor, commander, item) {
  const selected = await select(item.name, `${actor.name}: effect to counteract`, [{ value: "skip", label: "No eligible effect" },
    ...[...actor.items].filter((i) => ["effect", "condition", "affliction"].includes(i.type)).map((i) => ({ value: i.id, label: i.name }))]);
  if (!selected || selected === "skip") return "No effect selected.";
  const target = actor.items.get(selected);
  if (!await confirm(item.name, `Confirm ${target.name} is mental or imposes one of the tactic's listed conditions.`)) return null;
  const dc = await numberInput(item.name, "Effect counteract DC", { min: 1, value: 20 });
  const targetRank = dc === null ? null : await numberInput(item.name, "Effect counteract rank", { min: 0, value: 1 });
  const rank = targetRank === null ? null : await numberInput(item.name, "Commander's counteract rank", { min: 0, value: Math.ceil(actorLevel(commander) / 2) });
  if (rank === null) return null;
  const stat = commander.getStatistic("warfare-lore");
  if (!stat) throw new Error("Commander has no Warfare Lore statistic.");
  const roll = await stat.roll({ dc: { value: dc }, extraRollOptions: ["action:counteract"] });
  if (!roll) return null;
  const degree = roll.degreeOfSuccess;
  const success = degree === 3 ? targetRank <= rank + 3 : degree === 2 ? targetRank <= rank + 1 : degree === 1 && targetRank < rank;
  if (success) await target.delete();
  return `${target.name}: counteract ${success ? "succeeded; selected effect removed" : "failed"}.`;
}

async function spellFollowUp(actor, commander, item) {
  if (!await confirm(item.name, "Confirm the Trip succeeded. Cast a damaging ranged spell of at most 2 actions at/including the designated enemy now.")) return null;
  actor.sheet.render({ force: true });
  const spent = await select(item.name, "Spellcasting result", [{ value: "cancel", label: "Did not cast" },
    { value: "cantrip", label: "Cast without spending slot/Focus Point" }, { value: "spent", label: "Cast and spent spell slot/Focus Point" }]);
  if (!spent || spent === "cancel") return null;
  if (spent === "spent") await effect(actor, actor, item, { expiry: "turn-end", flags: { loseReaction: true },
    rules: [{ key: "GrantItem", uuid: CONDITION_UUIDS.slowed, inMemoryOnly: true }],
    description: "Slowed 1 through the end of your next turn. Do not regain a reaction at the start of that turn." });
  return `Spell follow-up completed${spent === "spent" ? "; slowed 1 and next-turn reaction restriction applied" : ""}.`;
}

async function highGround(actor, commander, item) {
  const rank = commander.getStatistic("warfare-lore")?.rank ?? 0;
  const horizontal = rank === 4 ? 40 : 25, vertical = rank === 4 ? 25 : 15;
  if (!await confirm(item.name, `Confirm you ended adjacent to the assisting squadmate. Spend your reaction to Leap up to ${horizontal} feet horizontally or ${vertical} feet vertically?`)) return null;
  const mode = await select(item.name, "Leap", [{ value: "horizontal", label: `Horizontal (${horizontal} ft)` }, { value: "vertical", label: `Vertical (${vertical} ft)` }]);
  if (!mode) return null;
  const token = activeTokenFor(actor).document;
  const start = { x: token.x, y: token.y, elevation: token.elevation };
  await confirm(item.name, `Move the token to its Leap landing point now, then continue. Maximum ${mode === "horizontal" ? horizontal : vertical} feet.`);
  const distance = canvas.grid.measurePath([{ x: start.x, y: start.y }, { x: token.x, y: token.y }]).distance;
  if ((mode === "horizontal" && distance > horizontal) || (mode === "vertical" && Math.abs(token.elevation - start.elevation) > vertical)) {
    throw new Error("Landing exceeds Leap allowance. Correct the token position before completing this response.");
  }
  return `Completed guided ${mode} Leap.`;
}

export async function guidedAftermath({ commander, item, participants, targets, squad }) {
  if (item.slug === "insta-ballista") {
    if (!await confirm(item.name, "Confirm these participants were chosen at preparation and carry the ballista's total 8 Bulk in whole-Bulk shares.")) return null;
    const bonus = Math.min(4, participants.filter((p) => p.status === "responded" && p.actor.uuid !== commander.uuid).length);
    const effects = await effect(commander, commander, item, { rules: [
      { key: "Strike", slug: "commander-insta-ballista", label: "Insta-Ballista", category: "martial", group: "bow", traits: [],
        range: { increment: null, max: 200 }, damage: { base: { dice: 10, die: "d12", damageType: "piercing" } } },
      { key: "FlatModifier", selector: "commander-insta-ballista-attack", type: "item", value: bonus },
    ] });
    try {
      const result = await strike(commander, item, targets[0], { mode: "ranged", slug: "commander-insta-ballista" });
      if (!result) return null;
      await confirm(item.name, "Resolve the Insta-Ballista's 10d12 piercing damage from its Strike entry now, then continue.");
      return `Insta-Ballista Strike resolved with +${bonus} item bonus.`;
    } finally { for (const e of effects) if (commander.items.has(e.id)) await e.delete(); }
  }
  if (item.slug === "corpse-crenellation") {
    if (!await confirm(item.name, "Did the tactic reduce the designated enemy to 0 HP?")) return "Target did not fall; no corpse cover.";
    const target = targets[0];
    for (const member of squad) {
      const sizes = ["tiny", "sm", "med", "lg", "huge", "grg"];
      const bodySize = sizes.indexOf(target.actor.size ?? target.actor.system.traits.size.value);
      const allySize = sizes.indexOf(member.actor.size ?? member.actor.system.traits.size.value);
      const standard = bodySize >= 0 && allySize >= 0 && bodySize - allySize >= 2;
      await effect(member.actor, commander, item, { expiry: "turn-end", flags: { corpseCover: target.uuid },
      description: "While in/adjacent to this body's space, gain lesser cover (standard if at least two sizes smaller). Take Cover can include half-Speed Stride ending there. Ends if body wakes/revives.",
      rules: [{ key: "RollOption", domain: "all", option: "corpse-crenellation-cover", toggleable: true, value: false, label: "In corpse cover" },
        { key: "FlatModifier", selector: standard ? ["ac", "reflex", "stealth"] : "ac", type: "circumstance", value: standard ? 2 : 1, predicate: ["corpse-crenellation-cover"] }] });
    }
    return "Corpse-cover effects granted with position toggle; use native Take Cover for standard/greater cover.";
  }
  if (item.slug === "executioners-volley") {
    if (!await confirm(item.name, "Roll every participant's damage without applying it. Combine matching damage types before resistance/weakness. Ready to apply totals once?")) return null;
    const formula = [];
    const remaining = new Set(["piercing", "slashing", "bludgeoning", "fire", "cold", "electricity", "acid", "sonic", "force", "vitality", "void", "mental", "poison", "spirit", "bleed", "untyped"]);
    while (remaining.size) {
      const type = await select(item.name, "Add a combined damage type", [...remaining].map((t) => ({ value: t, label: t })).concat({ value: "done", label: "Apply entered totals" }));
      if (type === null) return null;
      if (type === "done") break;
      const amount = await numberInput(item.name, `Combined ${type} damage`, { value: 0 });
      if (amount === null) return null;
      if (amount) formula.push(`${amount}[${type}]`);
      remaining.delete(type);
    }
    if (formula.length) {
      const damage = await damageRoll(`{${formula.join(",")}}`);
      await damage.toMessage({ speaker: ChatMessage.getSpeaker({ actor: commander }), flavor: item.name });
      await targets[0].actor.applyDamage({ damage, token: targets[0], item });
    }
    if (!await confirm(item.name, "Did this volley kill the target?")) return "Combined volley damage applied once.";
    for (const enemy of canvas.tokens.placeables.filter((t) => t.actor?.isEnemyOf?.(commander) && bannerRangeToToken(commander, t) <= bannerOrigin(commander).radius)) {
      const roll = await enemy.actor.getStatistic("will").roll({ dc: { value: classDC(commander) }, origin: commander, item, extraRollOptions: ["emotion", "fear", "mental"] });
      if (roll && roll.degreeOfSuccess < 2) await enemy.actor.increaseCondition("frightened", { value: 2 });
    }
    return "Combined damage and death-triggered fear resolved.";
  }
  if (item.slug === "bloody-guillotine") {
    if (!await confirm(item.name, "Pause on the FIRST Strike that actually damaged the designated prone enemy. Confirm this trigger occurred and no death save has already been made.")) return null;
    const victim = targets[0];
    const roll = await victim.actor.getStatistic("fortitude").roll({ dc: { value: classDC(commander) }, origin: commander, item,
      traits: ["death", "incapacitation"], extraRollOptions: ["death", "incapacitation"] });
    if (!roll) return null;
    if (roll.degreeOfSuccess >= 2) return "Target survived the death save.";
    if (!await confirm(item.name, "GM: confirm target is susceptible to this death effect and dies now.")) return "Death effect not applied.";
    await victim.actor.update({ "system.attributes.hp.value": 0 });
    await victim.actor.toggleStatusEffect("dead", { active: true });
    for (const enemy of canvas.tokens.placeables.filter((t) => t.actor?.isEnemyOf?.(commander) && t.actor.uuid !== victim.actor.uuid)) {
      if (!await confirm(item.name, `${enemy.name} witnessed the death and can be affected by the emotion/mental effect?`)) continue;
      const result = await enemy.actor.getStatistic("will").roll({ dc: { value: classDC(commander) }, origin: commander, item, extraRollOptions: ["emotion", "mental"] });
      if (result && result.degreeOfSuccess < 2) await effect(enemy.actor, commander, item, { rules: [{ key: "GrantItem", uuid: CONDITION_UUIDS.sickened, inMemoryOnly: true,
        alterations: [{ mode: "override", property: "badge-value", value: result.degreeOfSuccess === 0 ? 2 : 1 }] }] });
    }
    return "Death save and witness sickened saves resolved.";
  }
  if (!await confirm(item.name, "Confirm selected enemies were adjacent to a participant at some point along its movement path.")) return null;
  const dice = 2 * (1 + participants.filter((p) => p.status === "responded").length);
  const bludgeoning = await new Roll(`${dice}d6`).evaluate(), sonic = await new Roll(`${dice}d6`).evaluate();
  await bludgeoning.toMessage({ flavor: `${item.name}: bludgeoning` });
  await sonic.toMessage({ flavor: `${item.name}: sonic` });
  for (const target of targets) {
    const key = "cry-havoc-immunity";
    if (Number(target.actor.getFlag(FLAG_SCOPE, key)) > now()) continue;
    const result = await target.actor.getStatistic("fortitude").roll({ dc: { value: classDC(commander) }, origin: commander, item, extraRollOptions: ["damaging-effect"] });
    if (!result) continue;
    const multiplier = [2, 1, 0.5, 0][result.degreeOfSuccess];
    const damage = await damageRoll(`{${Math.floor(bludgeoning.total * multiplier)}[bludgeoning],${Math.floor(sonic.total * multiplier)}[sonic]}`);
    await target.actor.applyDamage({ damage, token: target, item });
    if (result.degreeOfSuccess === 0) await condition(target.actor, "deafened", commander, item);
    await target.actor.setFlag(FLAG_SCOPE, key, now() + 86400);
  }
  return "Cry Havoc damage, deafened and daily immunity resolved.";
}

export function registerGuidedTactics() { registerOperation("guided-tactic", executeGuidedTactic); }

export async function piranhaDamage(actor, commander, item) {
  const grants = [...actor.items].filter((i) => {
    const flags = i.getFlag?.(FLAG_SCOPE, "workflow");
    return flags?.piranhaTarget && flags.commanderUuid === commander.uuid && !i.isExpired && !i.system.expired;
  });
  const id = await select(item.name, "Active target-linked benefit", grants.map((g) => ({ value: g.id, label: g.name })));
  if (!id) return null;
  const target = await fromUuid(grants.find((g) => g.id === id).getFlag(FLAG_SCOPE, "workflow").piranhaTarget);
  if (!target?.actor) throw new Error("Piranha Assault target unavailable.");
  if (!await confirm(item.name, "Resolve an attack's damage using this guide BEFORE applying it. Enter the normal final damage after IWR, then how much applicable resistance actually prevented. Do not apply the original damage separately.")) return null;
  const normal = await numberInput(item.name, "Normal final damage after immunity/weakness/resistance", { min: 0 });
  if (normal === null) return null;
  let restored = 0;
  const count = await numberInput(item.name, "Number of distinct resisted damage types in this attack", { min: 0 });
  if (count === null) return null;
  for (let i = 0; i < count; i++) {
    const prevented = await numberInput(item.name, `Damage prevented by resistance for type ${i + 1} (exclude immunity)`, { min: 0 });
    if (prevented === null) return null;
    restored += Math.min(actorLevel(commander), prevented);
  }
  if (!await confirm(item.name, `Apply ${normal + restored} total damage to ${target.name} (${normal} normal + ${restored} resistance bypass)?`)) return null;
  await target.actor.applyDamage({ damage: normal + restored, token: target, skipIWR: true });
  return `Applied ${normal + restored} damage once, including ${restored} partial resistance bypass.`;
}
