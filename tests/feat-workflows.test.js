import test from "node:test";
import assert from "node:assert/strict";
import { armoredBulkRules, assessmentLimit, bannerRadius, drilledReactionLimit, rallyingDice } from "../scripts/domain/feat-rules.js";
import { adjacent, damageRoll, effectSource, numberInput, owner, save, select, strike } from "../scripts/foundry/workflow.js";
import { grantShadowsInMoonlight } from "../scripts/foundry/effects.js";
import { executeCommanderFeat } from "../scripts/foundry/feats.js";
import { executeGuidedTactic, piranhaDamage } from "../scripts/foundry/guided-tactics.js";
import { CommanderEngine } from "../scripts/engine.js";
import { requestOperation } from "../scripts/foundry/socket.js";

const actorWith = (...slugs) => ({ items: slugs.map((slug) => ({ slug })) });

test("heavy armor uses PF2e's supported override mode without cumulative Bulk reduction", () => {
  const armor = { id: "armor", type: "armor", _source: { system: { category: "heavy", bulk: { value: 4 } } }, system: { category: "heavy", bulk: { value: 3 } } };
  const actor = { items: [{ slug: "armored-regiment-training" }, armor] };
  assert.deepEqual(armoredBulkRules(actor), [{ key: "ItemAlteration", itemType: "armor", predicate: ["item:id:armor"], property: "bulk", mode: "override", value: 3 }]);
  assert.equal(armor._source.system.bulk.value, 4);
  armor._source.system.category = "medium";
  assert.deepEqual(armoredBulkRules(actor), []);
});

test("adjacency follows document position while token animation still shows the old position", () => {
  setup();
  const source = { document: { mechanicalBounds: { x: 600, y: 600, width: 100, height: 100 }, elevation: 0 }, distanceTo: () => 5 };
  const actor = { getActiveTokens: () => [source] };
  const target = { object: {}, mechanicalBounds: { x: 1000, y: 600, width: 100, height: 100 }, elevation: 0 };
  canvas.scene.grid = { type: 1, size: 100, distance: 5, measurePath: ([a, b]) => ({ distance: Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y)) / 20 }) };
  assert.equal(adjacent(actor, target), false);
  target.mechanicalBounds.x = 700;
  assert.equal(adjacent(actor, target), true);
  source.document.mechanicalBounds.width = 200;
  target.mechanicalBounds.x = 800;
  assert.equal(adjacent(actor, target), true, "large creature adjacency uses nearest occupied squares");
});

test("Shadows uses native Note and preserves noisy-armor option outside rebuilt armor options", async () => {
  setup();
  let source;
  const actor = { level: 5, createEmbeddedDocuments: async (_type, docs) => { source = docs[0]; } };
  await grantShadowsInMoonlight(actor, { uuid: "Actor.commander", level: 5 }, { name: "Shadows", uuid: "Item.shadows" }, 3);
  assert.ok(source.system.rules.some(r => r.key === "Note"));
  assert.ok(!source.system.rules.some(r => r.key === "RollNote"));
  const option = source.system.rules.find(r => r.option === "armor:ignore-noisy-penalty");
  assert.equal(option.domain, "skill-check");
  assert.equal(source.system.duration.expiry, "turn-end");
});
function setup() {
  globalThis.foundry = { utils: { escapeHTML: (s) => s.replaceAll("<", "&lt;") }, applications: { api: { DialogV2: { wait: async () => null, confirm: async () => false } } } };
  globalThis.game = { time: { worldTime: 100 }, users: new Map([["gm", { isGM: true }], ["player", { isGM: false }]]), combat: null };
  globalThis.canvas = { scene: { id: "scene" } };
  globalThis.fromUuid = async () => null;
}

test("Rapid Assessment sends secret knowledge rolls using Foundry 14 messageMode", async () => {
  setup();
  const item = { id: 'assessment', name: 'Rapid Assessment', slug: 'rapid-assessment', system: { traits: { value: [] } } };
  const items = [item]; items.get = id => items.find(i => i.id === id);
  let rolled;
  const actor = { uuid: 'Actor.commander', items, getFlag: () => undefined, skills: { arcana: { label: 'Arcana' } },
    getStatistic: () => ({ roll: async options => { rolled = options; return { degreeOfSuccess: 2 }; } }) };
  const target = { uuid: 'Token.enemy', parent: { id: 'scene' }, name: 'Enemy', actor: {} };
  globalThis.fromUuid = async uuid => uuid === actor.uuid ? actor : target;
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => data };
  const answers = [1, target.uuid, 'arcana', 20];
  foundry.applications.api.DialogV2.confirm = async () => true;
  foundry.applications.api.DialogV2.wait = async () => ({ value: answers.shift() });
  assert.equal(await executeCommanderFeat({ actorUuid: actor.uuid, itemId: item.id, targetUuids: [target.uuid] }, 'gm'), true);
  assert.equal(rolled.messageMode, 'blind');
  assert.equal(rolled.rollMode, undefined);
  assert.ok(rolled.extraRollOptions.includes('action:recall-knowledge'));
});

test("reaction upgrades replace the base allowance instead of stacking", () => {
  assert.equal(drilledReactionLimit(actorWith()), 1);
  assert.equal(drilledReactionLimit(actorWith("drilled-reflexes")), 2);
  assert.equal(drilledReactionLimit(actorWith("drilled-reflexes", "practiced-reflexes")), 4);
});
test("assessment upgrades and rallying healing scale at their thresholds", () => {
  assert.equal(assessmentLimit(actorWith()), 1);
  assert.equal(assessmentLimit(actorWith("unrivaled-analysis")), 4);
  assert.equal(assessmentLimit(actorWith("unrivaled-analysis", "perfected-evaluations")), 6);
  assert.deepEqual([8, 9, 10, 12, 20].map(rallyingDice), [4, 4, 5, 6, 10]);
});
test("banner radii combine glorious and companion upgrades with planted precedence", () => {
  const base = actorWith(), upgraded = actorWith("glorious-banner", "battle-tested-companion");
  assert.equal(bannerRadius(base), 30);
  assert.equal(bannerRadius(base, { planted: true }), 40);
  assert.equal(bannerRadius(upgraded), 60);
  assert.equal(bannerRadius(upgraded, { companion: true }), 70);
  assert.equal(bannerRadius(upgraded, { companion: true, mascot: true }), 100);
  assert.equal(bannerRadius(upgraded, { planted: true, companion: true, mascot: true }), 80);
});
test("missing actors and unknown users never pass workflow ownership", () => {
  assert.equal(owner(null, { isGM: true }), false);
  assert.equal(owner({}, null), false);
  assert.equal(owner({ testUserPermission: () => false }, { isGM: false }), false);
  assert.equal(owner({}, { isGM: true }), true);
});
test("closing choices and numeric inputs cancels without a default result", async () => {
  setup();
  assert.equal(await select("Feat", "Target", [{ value: "a", label: "A" }]), null);
  assert.equal(await numberInput("Feat", "Damage"), null);
  await assert.rejects(select("Feat", "Target", []), /No eligible choices/);
});
test("numeric damage inputs reject fractions and negative values", async () => {
  setup();
  for (const value of [-1, 1.5, NaN]) {
    foundry.applications.api.DialogV2.wait = async () => ({ value });
    await assert.rejects(numberInput("Feat", "Damage"), /whole number/);
  }
});
test("effect expiry anchors to originating commander's initiative", () => {
  setup();
  game.combat = { combatants: [{ actor: { uuid: "Actor.commander" }, initiative: 23 }], combatant: { initiative: 9 } };
  const source = effectSource({ uuid: "Actor.commander", level: 12 }, { name: "Cover", uuid: "Item.cover" }, { expiry: "turn-end", flags: { adjacentTo: "Token.a" } });
  assert.equal(source.system.start.initiative, 23);
  assert.equal(source.system.duration.expiry, "turn-end");
  assert.equal(source.system.context.origin.actor, "Actor.commander");
  assert.equal(source.flags["pf2e-commanderer"].workflow.adjacentTo, "Token.a");
  const recovery = effectSource({ uuid: "Actor.commander" }, { name: "Recovery" }, { seconds: 604800 });
  assert.equal(recovery.system.duration.unit, "days");
  assert.equal(recovery.system.duration.value, 7);
  assert.equal(recovery.system.duration.value * 86400, 604800);
});
test("PF2e saves receive incapacitation context once and preserve native result", async () => {
  setup();
  let options;
  const target = { saves: { will: { roll: async (o) => { options = o; return { degreeOfSuccess: 2 }; } } } };
  const commander = { level: 10 };
  assert.equal(await save(target, commander, { slug: "test", system: { traits: { value: ["mental", "incapacitation"] } } }, { dc: 25 }), 2);
  assert.equal(options.origin, commander);
  assert.ok(options.extraRollOptions.includes("incapacitation"));
  target.saves.will.roll = async () => null;
  assert.equal(await save(target, commander, { slug: "test" }, { dc: 25 }), null);
});
test("unconditional mental immunity prevents a mental save", async () => {
  setup();
  let rolled = false;
  const target = { attributes: { immunities: [{ type: "mental" }] }, saves: { will: { roll: async () => { rolled = true; } } } };
  assert.equal(await save(target, {}, { slug: "test" }, { dc: 25, traits: ["mental"] }), 3);
  assert.equal(rolled, false);
});
test("damage uses the registered PF2e roll class", async () => {
  setup();
  class DamageRoll { constructor(formula) { this.formula = formula; } async evaluate() { return this; } }
  globalThis.CONFIG = { Dice: { rolls: [DamageRoll] } };
  assert.equal((await damageRoll("{10[piercing]}" )).formula, "{10[piercing]}");
});
test("Insta-Ballista chooser excludes ordinary ranged weapons and preserves target", async () => {
  setup();
  let ordinary = false, options;
  const actor = { system: { actions: [
    { type: "strike", label: "Bow", item: { isRanged: true, slug: "bow" }, variants: [{ roll: async () => { ordinary = true; } }] },
    { type: "strike", label: "Ballista", item: { isRanged: true, slug: "commander-insta-ballista" }, variants: [{ roll: async (o) => { options = o; return { degreeOfSuccess: 2 }; } }] },
  ] } };
  foundry.applications.api.DialogV2.wait = async () => ({ value: "0" });
  const target = { uuid: "Token.target", object: { id: "target", document: { uuid: "Token.target" } } };
  const result = await strike(actor, { name: "Ballista", slug: "insta-ballista" }, target, { mode: "ranged", slug: "commander-insta-ballista", noMap: true });
  assert.equal(ordinary, false);
  assert.equal(options.target, target.object, "PF2e Strike expects the Token placeable, not TokenDocument");
  assert.deepEqual(options.options, ["action:insta-ballista"]);
  assert.equal(result.degree, 2);
});
test("feat endpoint rejects nonexistent actors even for GM", async () => {
  setup();
  await assert.rejects(executeCommanderFeat({ actorUuid: "missing" }, "gm"), /do not own/);
});
test("guided endpoint rejects mismatched tactic modes before mutation", async () => {
  setup();
  const commander = { uuid: "Actor.commander" };
  const item = { actor: commander, slug: "alley-oop", system: { traits: { value: ["tactic"] } } };
  globalThis.fromUuid = async (uuid) => uuid === "item" ? item : commander;
  await assert.rejects(executeGuidedTactic({ actorUuid: "actor", commanderUuid: "actor", itemUuid: "item", mode: "spell-follow-up" }, "gm"), /does not belong/);
});

test("Alley-oop transfers destination first and drops a separate stack on declined catch", async () => {
  setup();
  const consumable = { id: "potion", name: "Potion", type: "consumable", quantity: 2, isStowed: false };
  const receiver = { uuid: "Actor.receiver", items: [] };
  const target = { uuid: "Token.receiver", parent: { id: "scene" }, actor: receiver, object: {} };
  let updates;
  const actor = { uuid: "Actor.commander", items: [consumable], getActiveTokens: () => [{ id: "commander-token", distanceTo: () => 5 }],
    getFlag: (_scope, key) => key === "squad" ? [{ tokenUuid: target.uuid }] : undefined,
    transferItemToActor: async (...args) => {
      assert.deepEqual(args, [receiver, consumable, 1, undefined, true]);
      return { update: async changes => { updates = changes; } };
    } };
  actor.items.get = id => actor.items.find(i => i.id === id);
  const item = { uuid: "Item.tactic", slug: "alley-oop", name: "Alley-oop", actor, system: { traits: { value: ["tactic"] } } };
  const documents = new Map([[actor.uuid, actor], [item.uuid, item], [target.uuid, target]]);
  globalThis.fromUuid = async uuid => documents.get(uuid);
  foundry.applications.api.DialogV2.wait = async options => ({ value: options.content.includes("Receiver in banner aura") ? target.uuid : consumable.id });
  foundry.applications.api.DialogV2.confirm = async options => !options.content.includes("spend reaction to catch");
  const result = await executeGuidedTactic({ actorUuid: actor.uuid, commanderUuid: actor.uuid, itemUuid: item.uuid, mode: "alley-oop" }, "gm");
  assert.match(result, /dropped/);
  assert.deepEqual(updates, { "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 });
});

test("Deceptive Tactics selects a native diversion variant and permits cancellation", async () => {
  setup();
  const item = { id: "feat", slug: "deceptive-tactics", name: "Deceptive Tactics", system: { traits: { value: [] } } };
  const actor = { uuid: "Actor.diversion", items: { get: () => item }, getFlag: () => undefined };
  globalThis.fromUuid = async () => actor;
  globalThis.ChatMessage = { getSpeaker: () => ({}), create: async () => ({}) };
  let calls = 0;
  game.pf2e = { actions: { get: slug => {
    assert.equal(slug, "create-a-diversion");
    return { use: async options => { calls++; assert.equal(options.statistic, "warfare-lore"); assert.equal(options.variant, "gesture"); } };
  } } };
  foundry.applications.api.DialogV2.wait = async options => ({ value: options.content.includes("Diversion method") ? "gesture" : "create-a-diversion" });
  const payload = { actorUuid: actor.uuid, itemId: item.id };
  assert.equal(await executeCommanderFeat(payload, "gm"), true);
  foundry.applications.api.DialogV2.wait = async options => options.content.includes("Diversion method") ? null : { value: "create-a-diversion" };
  assert.equal(await executeCommanderFeat(payload, "gm"), false);
  assert.equal(calls, 1, "cancelling method does not roll or mark completed");
});
test("Piranha rejects another commander's grant and expired benefits", async () => {
  setup();
  const grant = (commanderUuid, isExpired) => ({ isExpired, system: {}, getFlag: () => ({ commanderUuid, piranhaTarget: "Token.target" }) });
  await assert.rejects(piranhaDamage({ items: [grant("other", false), grant("commander", true)] }, { uuid: "commander" }, { name: "Piranha" }), /No eligible choices/);
});
test("cancelled Piranha damage never updates the target", async () => {
  setup();
  let applied = false;
  const grant = { id: "grant", name: "Piranha", system: {}, getFlag: () => ({ commanderUuid: "commander", piranhaTarget: "Token.target" }) };
  globalThis.fromUuid = async () => ({ actor: { applyDamage: async () => { applied = true; } } });
  foundry.applications.api.DialogV2.wait = async () => ({ value: "grant" });
  assert.equal(await piranhaDamage({ items: [grant] }, { uuid: "commander" }, { name: "Piranha" }), null);
  assert.equal(applied, false);
});

test("authority reserves upgraded Drilled allowances before actions and refunds cancellation", async () => {
  setup();
  new CommanderEngine();
  foundry.utils.randomID = () => "request";
  game.user = { id: "gm", isGM: true };
  game.users.activeGM = game.user;
  game.combat = { id: "combat", round: 1 };
  const flags = {};
  const commander = { uuid: "Actor.reservation", items: [{ slug: "drilled-reactions" }, { slug: "drilled-reflexes" }],
    getFlag: (_scope, key) => flags[key], setFlag: async (_scope, key, value) => { flags[key] = value; } };
  const responders = [0, 1, 2].map((i) => ({ uuid: `Actor.responder${i}`, getFlag: () => undefined }));
  const invocation = { commanderUuid: commander.uuid, combat: true, roundKey: "combat:1", response: { reaction: true },
    participants: responders.map((a) => ({ actorUuid: a.uuid, status: "pending" })) };
  game.messages = new Map([["card", { getFlag: () => invocation }]]);
  globalThis.fromUuid = async (uuid) => uuid === commander.uuid ? commander : responders.find((a) => a.uuid === uuid);
  const payload = (participantIndex) => ({ messageId: "card", participantIndex, useDrilledReaction: true });
  await requestOperation("reserve-response", payload(0));
  await assert.rejects(requestOperation("reserve-response", payload(0)), /already responded or is responding/);
  await requestOperation("reserve-response", payload(1));
  await assert.rejects(requestOperation("reserve-response", payload(2)), /allowance already spent/);
  assert.equal(flags.drilledReactions.actors.length, 2);
  await requestOperation("release-response", { ...payload(0), completed: false });
  await requestOperation("reserve-response", payload(2));
  assert.deepEqual(flags.drilledReactions.actors, [responders[1].uuid, responders[2].uuid]);
  await requestOperation("release-response", { ...payload(1), completed: true });
  await requestOperation("release-response", { ...payload(2), completed: true });
  assert.equal(flags.drilledReactions.actors.length, 2, "completed actions retain spent allowance");
});

test("Piranha restores only the commander's level per resisted type and applies once", async () => {
  setup();
  const grant = { id: "grant", name: "Piranha", system: {}, getFlag: () => ({ commanderUuid: "commander", piranhaTarget: "Token.target" }) };
  const amounts = ["grant", 8, 2, 20, 3];
  foundry.applications.api.DialogV2.wait = async () => ({ value: amounts.shift() });
  foundry.applications.api.DialogV2.confirm = async () => true;
  const calls = [];
  const target = { name: "Enemy", actor: { applyDamage: async (options) => calls.push(options) } };
  globalThis.fromUuid = async () => target;
  await piranhaDamage({ items: [grant] }, { uuid: "commander", level: 10 }, { name: "Piranha" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].damage, 21);
  assert.equal(calls[0].skipIWR, true);
});
