import test from "node:test";
import assert from "node:assert/strict";
import { plantBanner, canRetrieveBanner, retrieveBanner, registerBannerInteractions, requestRetrieveBanner } from "../scripts/foundry/banner.js";
import { registerSocket } from "../scripts/foundry/socket.js";
import { addBannerMovementWarning, createBannerObject, registerBannerObjects, repairBannerObject } from "../scripts/foundry/banner-object.js";

test("planting preserves holder elevation and native level", async () => {
  const actor = { id: "c", uuid: "Actor.c", items: [{ slug: "plant-banner" }] };
  const token = { document: { elevation: 30, level: "upper", mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } };
  const scene = { getFlag: () => ({}), setFlag: async () => {} };
  const placement = await plantBanner(actor, "ne", scene, { token });
  assert.equal(placement.elevation, 30);
  assert.equal(placement.level, "upper");
  let source;
  const object = { id: "b", system: { attributes: { hp: { value: 12, max: 12 } } },
    update: async () => {}, getTokenDocument: async (data) => ({ toObject: () => data }) };
  globalThis.game = { actors: { find: () => object }, scenes: [] };
  scene.grid = { size: 100 };
  scene.createEmbeddedDocuments = async (_type, data) => { source = data[0]; return [{ id: "b" }]; };
  await createBannerObject(actor, scene, placement);
  assert.equal(source.elevation, 30);
  assert.equal(source.level, "upper");
  assert.equal(source.locked, true);
});

test("PC and NPC retrieval use interact reach and reject other floors", () => {
  for (const type of ["character", "npc"]) {
    const token = { document: { elevation: 30, level: "upper", mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } } };
    const actor = { id: "c", uuid: "Actor.c", type, getActiveTokens: () => [token],
      getReach: (options) => { assert.equal(options.action, "interact"); return 10; } };
    token.actor = actor;
    const placement = { actorUuid: actor.uuid, x: 300, y: 0, elevation: 30, level: "upper" };
    const scene = { grid: { distance: 5 }, getFlag: () => ({ c: placement }) };
    globalThis.canvas = { scene, grid: { size: 100 } };
    assert.equal(canRetrieveBanner(actor, scene), true);
    placement.level = "lower";
    assert.equal(canRetrieveBanner(actor, scene), false);
  }
});

test("manual repair caps persistent HP, clears broken state, rejects player and destroyed repairs", async () => {
  const commander = { uuid: "Actor.c" };
  let placement = { objectActorId: "b", broken: true };
  const scene = { getFlag: () => ({ c: placement }), setFlag: async (_scope, _key, value) => { placement = value.c; } };
  const object = { id: "b", getFlag: () => ({ commanderUuid: commander.uuid }),
    system: { attributes: { hp: { value: 3, max: 12 } } },
    update: async (data) => { object.system.attributes.hp.value = data["system.attributes.hp.value"]; } };
  globalThis.game = { user: { isGM: false }, actors: { find: () => object, get: () => object }, scenes: [scene] };
  await assert.rejects(repairBannerObject(commander, 5), /Only a GM/);
  game.user.isGM = true;
  await repairBannerObject(commander, 50);
  assert.equal(object.system.attributes.hp.value, 12);
  assert.equal(placement.broken, false);
  for (const amount of [0, -1, 1.5, NaN]) await assert.rejects(repairBannerObject(commander, amount), /positive whole/);
  object.system.attributes.hp.value = 0;
  await assert.rejects(repairBannerObject(commander, 5), /destroyed/);
});

test("GM force retrieval cleans stale placement without commander token; players rejected", async () => {
  const actor = { id: "c", uuid: "Actor.c", rollOptions: { all: { "commanders-banner": true } } };
  let placement = { actorUuid: actor.uuid, x: 1000, y: 0 };
  const scene = { getFlag: () => placement ? { c: placement } : {}, unsetFlag: async () => { placement = null; } };
  globalThis.game = { user: { isGM: false } };
  await assert.rejects(retrieveBanner(actor, scene, { force: true }), /Only a GM/);
  globalThis.game.user.isGM = true;
  assert.equal(await retrieveBanner(actor, scene, { force: true }), true);
  assert.equal(placement, null);
});

test("native lock permits manual movement once unlocked and synchronizes banner origin", async () => {
  const hooks = new Map();
  globalThis.Hooks = { on: (name, callback) => hooks.set(name, callback), callAll() {} };
  globalThis.ui = { notifications: { warn() {} } };
  globalThis.game = { user: { id: "gm", isGM: true }, users: {} };
  registerBannerObjects();
  let placement = { actorUuid: "Actor.c", objectTokenId: "b", x: 25, y: 25 };
  const scene = { grid: { size: 100 }, getFlag: () => ({ c: placement }),
    setFlag: async (_scope, _key, data) => { placement = data.c; } };
  const token = { id: "b", parent: scene, locked: true, x: 300, y: 400, elevation: 20, level: "upper", getFlag: () => ({ commanderUuid: "Actor.c" }) };
  assert.equal(hooks.get("preUpdateToken")(token, { x: 300 }, {}), false);
  token.locked = false;
  assert.notEqual(hooks.get("preUpdateToken")(token, { x: 300 }, {}), false);
  await hooks.get("updateToken")(token, { x: 300, elevation: 20 }, {});
  assert.equal(placement.x, 325);
  assert.equal(placement.elevation, 20);
  assert.equal(placement.level, "upper");
  token.getFlag = () => ({ commanderUuid: "Actor.c", nativeLock: true });
  scene.tokens = [token];
  token.update = () => assert.fail("must preserve an explicitly unlocked banner");
  await hooks.get("canvasReady")({ scene });
});

test("locked movement retains native handling and adds banner guidance only once", async () => {
  let nativeCalls = 0, warnings = 0;
  globalThis.ui = { notifications: { warn: () => warnings++ } };
  const token = { document: { locked: true, getFlag: () => ({ commanderUuid: "Actor.c" }) },
    planMovement: async function () { nativeCalls++; return this.document.locked ? null : "plan"; } };
  addBannerMovementWarning(token);
  addBannerMovementWarning(token);
  assert.equal(await token.planMovement(), null);
  assert.equal(warnings, 1);
  token.document.locked = false;
  assert.equal(await token.planMovement(), "plan");
  assert.equal(warnings, 1);
  assert.equal(nativeCalls, 2);
});

test("force request handles missing tokens and rejects forged player requests on authority", async () => {
  const actor = { id: "c", uuid: "Actor.c", rollOptions: { all: { "commanders-banner": true } } };
  let placement = { actorId: actor.id, actorUuid: actor.uuid, tokenUuid: "Scene.s.Token.deleted", removed: true, removalMode: "carried" };
  const scene = { id: "s", getFlag: () => placement ? { c: placement } : {}, unsetFlag: async () => { placement = null; } };
  const gm = { id: "gm", isGM: true }, player = { id: "player", isGM: false };
  let receive, response;
  globalThis.foundry = { utils: { randomID: () => "request" } };
  globalThis.game = { user: gm, users: { activeGM: gm, get: (id) => id === gm.id ? gm : player },
    scenes: new Map([[scene.id, scene]]), actors: new Map([[actor.id, actor]]),
    socket: { on: (_name, callback) => { receive = callback; }, emit: (_name, packet) => { response = packet; } } };
  globalThis.Hooks = { on() {}, callAll() {} };
  registerSocket();
  registerBannerInteractions();
  const originalError = console.error;
  try {
    console.error = () => {};
    await receive({ type: "request", operation: "retrieve-banner", userId: player.id, gmRequired: true,
      payload: { sceneId: scene.id, actorId: actor.id, actorUuid: actor.uuid, force: true } });
    assert.equal(response.ok, false);
    assert.match(response.error, /Only a GM/);
    assert.ok(placement);
  } finally { console.error = originalError; }
  assert.equal(await requestRetrieveBanner(actor, scene, { force: true }), true);
  assert.equal(placement, null);
});
