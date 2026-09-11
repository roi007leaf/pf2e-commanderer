import test from "node:test";
import assert from "node:assert/strict";
import { bannerObjectStats } from "../scripts/domain/banner-object.js";
import { bannerObjectSource, createBannerObject, destroyBannerObject, registerBannerObjects } from "../scripts/foundry/banner-object.js";
import { bannerBeneficiaries, frightenBannerBeneficiaries } from "../scripts/foundry/banner-loss.js";
import { closestBannerCorner, pickBannerCorner } from "../scripts/canvas/banner-picker.js";
import { removePlantedBannerAsEnemy } from "../scripts/foundry/banner.js";
import { squadLimit, setSquadLimit } from "../scripts/foundry/squad.js";

const scope = "pf2e-commanderer";
globalThis.game = undefined;
globalThis.Actor = undefined;
globalThis.canvas = undefined;
globalThis.PIXI = undefined;
globalThis.Hooks = undefined;
globalThis.document = undefined;
globalThis.ui = undefined;
const commander = { id: "commander", uuid: "Actor.commander", name: "Commander", level: 5,
  system: { abilities: { int: { mod: 3 } } } };

test("combatant creation veto excludes banners from mixed batches on every client", (t) => {
  const hooks = new Map();
  t.mock.property(globalThis, "Hooks", { on: (name, handler) => hooks.set(name, handler) });
  registerBannerObjects();
  const beforeCreate = hooks.get("preCreateCombatant");
  const marked = { getFlag: (namespace, key) => namespace === scope && key === "bannerObject" ? { commanderUuid: commander.uuid } : undefined };
  const creature = { actor: { type: "npc", getFlag: () => undefined } };
  const hazard = { actor: { type: "hazard", getFlag: () => undefined } };
  const batch = [{ actor: marked }, creature, { token: marked }, hazard];
  t.mock.property(globalThis, "game", { user: { isGM: true } });
  for (const isGM of [true, false]) {
    game.user.isGM = isGM;
    assert.deepEqual(batch.filter((candidate) => beforeCreate(candidate) !== false), [creature, hazard]);
    assert.equal(beforeCreate({}), undefined, "unlinked combatants remain allowed");
  }
});

test("banner materials combine with affixed item durability and planted bonus", () => {
  assert.deepEqual(bannerObjectStats(commander), { hardness: 3, hp: 12, ac: 10, bonus: 8, itemId: null });
  const actor = { ...commander, items: new Map([["shield", { id: "shield", type: "shield", system: { hardness: 8, hp: { max: 64 } } }]]) };
  const stats = bannerObjectStats(actor, { material: "cloth", itemId: "shield", ac: 8 });
  assert.equal(stats.hp, 64);
  assert.equal(stats.hardness, 8);
  assert.equal(stats.bonus, 0, "Plant Banner specifically grants weapon/pole Hardness, not shield Hardness");
  assert.throws(() => bannerObjectStats(actor, { itemId: "missing" }), /no longer/);
  for (const hp of [0, -1, 1.5, NaN]) assert.throws(() => bannerObjectStats(actor, { material: "custom", hp, hardness: 0 }));
});

test("banner is a native hazard with HP, Hardness, no fabricated saves or creature alliance", () => {
  const source = bannerObjectSource(commander, bannerObjectStats(commander));
  assert.equal(source.type, "hazard");
  assert.equal(source.system.attributes.hardness, 11);
  assert.equal(source.system.attributes.hp.max, 12);
  assert.equal(source.system.saves.reflex.value, null);
  assert.equal(source.prototypeToken.actorLink, true);
});

test("frightened snapshots only this banner's current beneficiaries, deduplicates tokens, preserves conditions", async (t) => {
  const effect = { flags: { [scope]: { plantedBannerOrigin: { commanderUuid: commander.uuid, sceneId: "scene" } } } };
  let applied = 0;
  const ally = { uuid: "Actor.ally", items: [effect], increaseCondition: async (_slug, options) => {
    assert.deepEqual(options, { value: 1, max: 1 }); applied++;
  } };
  const afraid = { uuid: "Actor.afraid", items: [effect], hasCondition: () => true,
    increaseCondition: () => assert.fail("must not lower existing frightened") };
  const immune = { uuid: "Actor.immune", items: [effect], isImmuneTo: () => true,
    increaseCondition: () => assert.fail("must respect immunity") };
  const outsider = { uuid: "Actor.outside", items: [{ ...effect, isExpired: true }] };
  const scene = { id: "scene", tokens: [ally, ally, afraid, immune, outsider].map((actor) => ({ actor })) };
  t.mock.method(console, "error", () => {});
  const recipients = bannerBeneficiaries(commander.uuid, scene);
  assert.equal(recipients.length, 3);
  // Aura cleanup after capture must not discard the loss recipients.
  ally.items = [];
  await frightenBannerBeneficiaries(recipients);
  assert.equal(applied, 1);
});

test("damage marks broken, repair restores, destruction ends benefits once", async (t) => {
  let flags = { commander: { actorUuid: commander.uuid, objectActorId: "banner", objectBaseHardness: 3 } };
  let frightened = 0;
  const ally = { uuid: "Actor.ally", items: [{ flags: { [scope]: { plantedBannerOrigin: {
    commanderUuid: commander.uuid, sceneId: "scene",
  } } } }], increaseCondition: async () => { frightened++; } };
  const scene = { id: "scene", tokens: [{ actor: ally }], getFlag: () => flags,
    setFlag: async (_scope, _key, value) => { flags = value; } };
  const actor = { id: "banner", getFlag: () => ({ commanderUuid: commander.uuid }),
    system: { attributes: { hp: { value: 6, max: 12 }, hardness: 3 } } };
  t.mock.property(globalThis, "game", { scenes: [scene], actors: new Map([[actor.id, actor]]) });
  await destroyBannerObject(actor);
  assert.equal(flags.commander.broken, true);
  assert.equal(frightened, 0);
  actor.system.attributes.hp.value = 8;
  await destroyBannerObject(actor);
  assert.equal(flags.commander.broken, false);
  actor.system.attributes.hp.value = 0;
  await destroyBannerObject(actor);
  assert.equal(flags.commander.removalMode, "destroyed");
  assert.equal(frightened, 1);
  await destroyBannerObject(actor);
  assert.equal(frightened, 1);
});

test("replanting reuses damaged banner without healing and centers token on corner", async (t) => {
  let tokenSource;
  const actor = { id: "banner", system: { attributes: { hp: { value: 9, max: 12 } } },
    getFlag: () => ({ commanderUuid: commander.uuid }),
    update: async (changes) => { assert.equal(changes["system.attributes.hp.value"], 9); },
    getTokenDocument: async (source) => ({ toObject: () => source }) };
  t.mock.property(globalThis, "game", { actors: { find: () => actor }, scenes: [] });
  const scene = { grid: { size: 100 }, createEmbeddedDocuments: async (_type, sources) => {
    tokenSource = sources[0]; return [{ id: "token" }];
  } };
  const result = await createBannerObject(commander, scene, { x: 200, y: 300 });
  assert.equal(result.objectActorId, "banner");
  assert.equal(tokenSource.x, 175);
  assert.equal(tokenSource.y, 275);
  actor.system.attributes.hp.value = 0;
  await assert.rejects(createBannerObject(commander, scene, { x: 0, y: 0 }), /destroyed/);
});

test("map placement snaps to nearest legal commander corner", () => {
  const bounds = { x: 100, y: 200, width: 100, height: 100 };
  assert.equal(closestBannerCorner(bounds, { x: 110, y: 190 }), "nw");
  assert.equal(closestBannerCorner(bounds, { x: 250, y: 330 }), "se");
});

test("new banner creation uses native actor/token documents and cleans up on token failure", async (t) => {
  let source;
  let deleted = 0;
  t.mock.property(globalThis, "game", { actors: { find: () => null }, scenes: [] });
  t.mock.property(globalThis, "Actor", { implementation: { create: async (data) => {
    source = data;
    return { id: "created", system: data.system, getTokenDocument: async (token) => ({ toObject: () => token }),
      delete: async () => { deleted++; } };
  } } });
  const scene = { grid: { size: 100 }, createEmbeddedDocuments: async () => [{ id: "created-token" }] };
  const result = await createBannerObject(commander, scene, { x: 200, y: 200 });
  assert.equal(source.type, "hazard");
  assert.equal(result.objectTokenId, "created-token");
  assert.equal(result.broken, false);
  scene.createEmbeddedDocuments = async () => { throw new Error("token write failed"); };
  await assert.rejects(createBannerObject(commander, scene, { x: 0, y: 0 }), /token write failed/);
  assert.equal(deleted, 1);
});

test("one commander cannot duplicate its planted banner onto a second scene", async (t) => {
  t.mock.property(globalThis, "game", { scenes: [{ getFlag: () => ({ commander: { actorUuid: commander.uuid } }) }] });
  await assert.rejects(createBannerObject(commander, {}, { x: 0, y: 0 }), /existing scene/);
});

test("enemy theft frightens before aura recipients disappear; pulling down does not", async (t) => {
  const initial = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  let placements = { commander: initial }, frightened = 0;
  const effect = { flags: { [scope]: { plantedBannerOrigin: { commanderUuid: commander.uuid, sceneId: "scene" } } } };
  const ally = { uuid: "Actor.ally", items: [effect], increaseCondition: async () => { frightened++; } };
  const scene = { id: "scene", grid: { size: 100, distance: 5 }, tokens: [{ actor: ally }],
    getFlag: () => placements, setFlag: async (_scope, _key, value) => { placements = value; ally.items = []; } };
  const enemyToken = { actor: { uuid: "Actor.enemy", isEnemyOf: () => true },
    document: { uuid: "Scene.scene.Token.enemy", mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } };
  t.mock.property(globalThis, "game", { actors: new Map([[commander.id, commander]]) });
  const args = { scene, commanderActorId: commander.id, enemyToken, user: { id: "gm", isGM: true } };
  await removePlantedBannerAsEnemy({ ...args, mode: "carried" });
  assert.equal(frightened, 1);
  await assert.rejects(removePlantedBannerAsEnemy({ ...args, mode: "carried" }));
  placements = { commander: initial }; ally.items = [effect];
  await removePlantedBannerAsEnemy({ ...args, mode: "dropped" });
  assert.equal(frightened, 1);
});

test("map picker cancels cleanly on Escape and scene teardown", async (t) => {
  let destroyed = 0;
  class Graphics {
    clear() { return this; } lineStyle() { return this; } beginFill() { return this; }
    drawCircle() { return this; } endFill() { return this; } destroy() { destroyed++; }
  }
  const view = new EventTarget(); view.style = { cursor: "grab" };
  const doc = new EventTarget();
  const hooks = new Map();
  t.mock.property(globalThis, "document", doc);
  t.mock.property(globalThis, "PIXI", { Graphics });
  t.mock.property(globalThis, "ui", { notifications: { info() {} } });
  t.mock.property(globalThis, "Hooks", { on: (name, callback) => { hooks.set(name, callback); return 1; }, off: (name) => hooks.delete(name) });
  t.mock.property(globalThis, "canvas", { ready: true, app: { canvas: view }, stage: { addChild() {} } });
  const actor = { getActiveTokens: () => [{ document: { mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } }] };
  const first = pickBannerCorner(actor);
  const escape = new Event("keydown"); Object.defineProperty(escape, "key", { value: "Escape" });
  doc.dispatchEvent(escape);
  assert.equal(await first, null);
  assert.equal(view.style.cursor, "grab");
  assert.equal(hooks.size, 0);
  const second = pickBannerCorner(actor);
  hooks.get("canvasTearDown")();
  assert.equal(await second, null);
  assert.equal(destroyed, 2);
  assert.equal(hooks.size, 0);
});

test("GM squad override accepts zero, restores default, rejects player writes and invalid numbers", async (t) => {
  let limit;
  const actor = { ...commander, getFlag: () => limit,
    setFlag: async (_scope, _key, value) => { limit = value; }, unsetFlag: async () => { limit = undefined; } };
  t.mock.property(globalThis, "game", { user: { isGM: false } });
  await assert.rejects(setSquadLimit(actor, 7), /Only a GM/);
  game.user.isGM = true;
  assert.equal(squadLimit(actor), 5);
  await setSquadLimit(actor, "6"); assert.equal(squadLimit(actor), 6);
  await setSquadLimit(actor, 0); assert.equal(squadLimit(actor), 0);
  await setSquadLimit(actor, ""); assert.equal(squadLimit(actor), 5);
  for (const value of [-1, 2.5, "bad"]) await assert.rejects(setSquadLimit(actor, value));
});
