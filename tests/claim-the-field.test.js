import test from "node:test";
import assert from "node:assert/strict";
import { claimTheFieldRange, hasClaimTheField } from "../scripts/domain/banner-placement.js";
import { plantBanner, removePlantedBannerAsEnemy } from "../scripts/foundry/banner.js";
import { claimTheFieldAllowsAttempt, registerClaimTheFieldDamage } from "../scripts/foundry/claim-the-field.js";
import { pickBannerCorner } from "../scripts/canvas/banner-picker.js";

for (const key of ["CONST", "game", "CONFIG", "fromUuid", "foundry", "canvas", "document", "PIXI", "Hooks", "ui"]) globalThis[key] ??= undefined;

function commander() {
  return { id: "commander", uuid: "Actor.commander", name: "Commander", level: 6, alliance: "party",
    system: { attributes: { classDC: { value: 22 } } },
    items: [{ slug: "plant-banner" }, { slug: "claim-the-field" },
      { id: "spear", type: "weapon", system: { traits: { value: ["thrown-20"] } } }],
    getFlag: () => ({ itemId: "spear" }),
  };
}

test("Claim requires both feats and configured thrown weapon; reads melee and ranged thrown increments", () => {
  const actor = commander();
  assert.equal(hasClaimTheField(actor), true);
  assert.equal(claimTheFieldRange(actor), 20);
  actor.items[2].system.traits.value = [];
  assert.equal(claimTheFieldRange(actor), 0);
  actor.items[2].isThrown = true;
  actor.items[2].range = { increment: 30 };
  assert.equal(claimTheFieldRange(actor), 30);
  actor.items.shift();
  assert.equal(hasClaimTheField(actor), false);
  actor.getFlag = () => ({});
  assert.equal(claimTheFieldRange(actor), 0);
});

test("authority rejects invalid, unsnapped, out-of-range and featless placements; ordinary Plant stays unprotected", async (t) => {
  const actor = commander();
  let placements = {};
  const grid = { getSnappedPoint: ({ x, y }) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 }),
    measurePath: ([a, b]) => ({ distance: Math.hypot(b.x - a.x, b.y - a.y) / 20 }) };
  const scene = { grid, getFlag: () => placements, setFlag: async (_s, _k, value) => { placements = value; } };
  const token = { document: { uuid: "Scene.scene.Token.commander", mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } };
  t.mock.property(globalThis, "CONST", { GRID_SNAPPING_MODES: { VERTEX: 8 } });
  for (const point of [{ x: NaN, y: 0 }, { x: "100", y: 0 }, { x: 111, y: 0 }, { x: 500, y: 0 }]) {
    await assert.rejects(plantBanner(actor, point, scene, { token }));
    assert.deepEqual(placements, {});
  }
  const placement = await plantBanner(actor, { x: 400, y: 0 }, scene, { token });
  assert.equal(placement.claimTheField, true);
  assert.equal(placement.radius, 40);
  assert.equal(placement.x, 400);
  placements = {};
  const shortcut = await plantBanner(actor, "ne", scene, { token });
  assert.equal(shortcut.claimTheField, true, "token-corner shortcuts automatically gain the feat's protection");
  assert.equal(shortcut.corner, "ne");
  placements = {};
  actor.items[2].system.traits.value = [];
  assert.equal((await plantBanner(actor, "nw", scene, { token })).claimTheField, undefined,
    "ordinary Plant remains available when the thrown-weapon requirement is unmet");
  placements = {};
  actor.items = actor.items.filter((item) => item.slug !== "claim-the-field");
  await assert.rejects(plantBanner(actor, { x: 100, y: 0 }, scene, { token }), /does not have Claim/);
  const ordinary = await plantBanner(actor, "nw", scene, { token });
  assert.equal(ordinary.claimTheField, undefined);
});

test("protection uses native mental/incapacitation save, blocks failure/cancel, grants one-round fleeing only on critical failure", async (t) => {
  t.mock.property(globalThis, "game", { time: { worldTime: 100 } });
  const actor = commander();
  const effects = [];
  let degree = 0, options;
  const enemy = { name: "Enemy", level: 10,
    saves: { will: { roll: async (value) => { options = value; return degree === null ? null : { degreeOfSuccess: degree }; } } },
    createEmbeddedDocuments: async (_type, sources) => effects.push(...sources),
  };
  const placement = { claimTheField: true };
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), false);
  assert.equal(options.dc.value, 22);
  assert.equal(options.origin, actor);
  assert.deepEqual(options.traits, ["incapacitation", "mental"]);
  assert.ok(options.extraRollOptions.includes("incapacitation"));
  assert.equal(effects[0].system.duration.value, 1);
  assert.equal(effects[0].system.duration.unit, "rounds");
  assert.equal(effects[0].system.rules[0].uuid, "Compendium.pf2e.conditionitems.Item.sDPxOjQ9kx2RZE8D");
  degree = 1;
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), false, "do not double-adjust native incapacitation result");
  degree = 2;
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), true);
  degree = 3;
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), true);
  degree = null;
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), false);
  assert.equal(effects.length, 1);
  enemy.attributes = { immunities: [{ type: "mental" }] };
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, placement), true);
  delete enemy.saves;
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, { ...placement, removed: true }), true);
  assert.equal(await claimTheFieldAllowsAttempt(actor, enemy, {}), true);
});

test("enemy removal does not mutate banner on failed save or unauthorized request", async (t) => {
  const actor = commander();
  let degree = 1, rolls = 0, writes = 0;
  const placement = { actorId: actor.id, actorUuid: actor.uuid, claimTheField: true, x: 0, y: 0 };
  const scene = { grid: { distance: 5 }, getFlag: () => ({ commander: placement }), setFlag: async () => { writes++; } };
  const enemy = { uuid: "Actor.enemy", alliance: "opposition", testUserPermission: () => false,
    saves: { will: { roll: async () => { rolls++; return { degreeOfSuccess: degree }; } } } };
  const enemyToken = { actor: enemy, document: { mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } };
  t.mock.property(globalThis, "game", { actors: new Map([[actor.id, actor]]) });
  const args = { scene, commanderActorId: actor.id, enemyToken, user: { id: "gm", isGM: true } };
  await assert.rejects(removePlantedBannerAsEnemy({ ...args, user: { id: "outsider" } }));
  assert.equal(rolls, 0);
  assert.equal(await removePlantedBannerAsEnemy(args), false);
  assert.equal(writes, 0);
  degree = 2;
  assert.equal((await removePlantedBannerAsEnemy(args)).removed, true);
  assert.equal(writes, 1);
});

test("damage wrapper preserves native damage/healing and only gates protected enemy damage", async (t) => {
  const actor = commander();
  let degree = 1, rolls = 0, applied = 0, confirm = false;
  const enemy = { uuid: "Actor.enemy", alliance: "opposition",
    saves: { will: { roll: async () => { rolls++; return { degreeOfSuccess: degree }; } } } };
  const placement = { objectActorId: "banner", claimTheField: true };
  class Hazard { constructor() { this.id = "banner"; } getFlag() { return { commanderUuid: actor.uuid }; }
    async applyDamage() { applied++; return this; } }
  t.mock.property(globalThis, "CONFIG", { PF2E: { Actor: { documentClasses: { hazard: Hazard } } } });
  t.mock.property(globalThis, "game", { scenes: [{ getFlag: () => ({ commander: placement }) }] });
  t.mock.property(globalThis, "fromUuid", async () => actor);
  t.mock.property(globalThis, "foundry", { applications: { api: { DialogV2: { confirm: async () => confirm } } } });
  registerClaimTheFieldDamage(); registerClaimTheFieldDamage();
  const banner = new Hazard();
  const options = { damage: 10, item: { actor: enemy } };
  await banner.applyDamage(options);
  assert.equal(applied, 0);
  degree = 2;
  await banner.applyDamage(options);
  assert.equal(applied, 1);
  assert.equal(rolls, 2, "registration is idempotent");
  await banner.applyDamage({ damage: -10 });
  assert.equal(applied, 2);
  await banner.applyDamage({ damage: 10 });
  assert.equal(applied, 2);
  confirm = true;
  await banner.applyDamage({ damage: 10 });
  assert.equal(applied, 3);
  await banner.applyDamage({ damage: 10, item: { actor } });
  assert.equal(applied, 4);
  placement.removed = true;
  degree = 1;
  await banner.applyDamage(options);
  assert.equal(applied, 5);
  assert.equal(rolls, 2);
});

test("ranged picker previews valid/invalid corners, rejects distant click, cleans up after selection", async (t) => {
  let destroyed = 0, color, warnings = 0;
  class Graphics {
    clear() { return this; } lineStyle(_width, value) { color = value; return this; } beginFill() { return this; }
    drawCircle() { return this; } endFill() { return this; } destroy() { destroyed++; }
  }
  const view = new EventTarget();
  view.style = { cursor: "grab" };
  view.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000 });
  const hooks = new Map();
  t.mock.property(globalThis, "document", new EventTarget());
  t.mock.property(globalThis, "PIXI", { Graphics });
  t.mock.property(globalThis, "ui", { notifications: { info() {}, warn() { warnings++; } } });
  t.mock.property(globalThis, "CONST", { GRID_SNAPPING_MODES: { VERTEX: 8 } });
  t.mock.property(globalThis, "Hooks", { on: (name, fn) => { hooks.set(name, fn); return 1; }, off: (name) => hooks.delete(name) });
  t.mock.property(globalThis, "canvas", { ready: true, app: { canvas: view, screen: { width: 1000, height: 1000 } },
    stage: { addChild() {}, toLocal: (point) => point },
    grid: { getSnappedPoint: ({ x, y }) => ({ x: Math.round(x / 100) * 100, y: Math.round(y / 100) * 100 }),
      measurePath: ([a, b]) => ({ distance: Math.hypot(b.x - a.x, b.y - a.y) / 20 }) },
  });
  const actor = { ...commander(), getActiveTokens: () => [{ document: { mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } }] };
  const result = pickBannerCorner(actor);
  const dispatch = (type, x) => {
    const event = new Event(type);
    Object.assign(event, { clientX: x, clientY: 0, button: 0 });
    view.dispatchEvent(event);
  };
  dispatch("pointermove", 800);
  assert.equal(color, 0xff4444);
  dispatch("pointerdown", 800);
  assert.equal(warnings, 1);
  assert.equal(destroyed, 0);
  dispatch("pointermove", 390);
  assert.equal(color, 0xffd166);
  dispatch("pointerdown", 390);
  assert.deepEqual(await result, { x: 400, y: 0 });
  assert.equal(destroyed, 1);
  assert.equal(view.style.cursor, "grab");
  assert.equal(hooks.size, 0);
});
