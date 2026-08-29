import test from "node:test";
import assert from "node:assert/strict";

import { syncPlantedBannerEffects } from "../scripts/foundry/banner-effects.js";
import { retrieveBanner } from "../scripts/foundry/banner.js";

function fakeActor(id, alliance = "party") {
  const actor = {
    id,
    uuid: `Actor.${id}`,
    name: id,
    alliance,
    items: [],
    created: 0,
    deleted: [],
    deleteCalls: [],
    serverMissingItems: new Set(),
    async createEmbeddedDocuments(_type, sources) {
      this.created += sources.length;
      for (const source of sources) {
        this.items.push({
          ...source,
          id: `${id}-effect-${this.items.length}`,
          getFlag: (scope, key) => source.flags?.[scope]?.[key],
        });
      }
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.deleteCalls.push([...ids]);
      const missing = ids.find((idToDelete) => this.serverMissingItems.has(idToDelete));
      if (missing) throw new Error(`Item "${missing}" does not exist!`);
      this.deleted.push(...ids);
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
  };
  return actor;
}

function fakeToken(id, actor, x, { documentX = x } = {}) {
  return {
    id,
    actor,
    document: {
      x: documentX,
      y: 0,
      width: 1,
      height: 1,
      mechanicalBounds: { x: documentX, y: 0, width: 100, height: 100 },
    },
    mechanicalBounds: { x, y: 0, width: 100, height: 100 },
  };
}

test("planted banner base effect follows planted burst instead of Commander token", async () => {
  const commander = fakeActor("commander");
  commander.items.push({ slug: "commanders-banner", uuid: "Actor.commander.Item.banner" });
  commander.items.push({
    id: "old-carried-aura",
    flags: { pf2e: { aura: { slug: "commanders-banner", origin: commander.uuid, removeOnExit: true } } },
  });
  const near = fakeActor("near");
  near.items.push({
    id: "near-carried-aura",
    flags: { pf2e: { aura: { slug: "commanders-banner", origin: commander.uuid, removeOnExit: true } } },
  });
  const far = fakeActor("far");
  const commanderToken = fakeToken("commander-token", commander, 1000);
  const nearToken = fakeToken("near-token", near, 100);
  const farToken = fakeToken("far-token", far, 1000);
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({ [commander.id]: placement }),
  };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  const previousFromUuid = globalThis.fromUuid;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: [commanderToken, nearToken, farToken] },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: { contents: [commander, near, far] },
    time: { worldTime: 100 },
    combat: null,
  };
  globalThis.fromUuid = async () => ({
    toObject: () => ({
      name: "Effect: Commander's Banner",
      type: "effect",
      system: { context: {}, start: {} },
      flags: {},
    }),
  });

  try {
    await syncPlantedBannerEffects(scene);
    assert.equal(commander.created, 0, "distant Commander no longer receives own carried aura");
    assert.deepEqual(commander.deleted, [], "PF2e retains ownership of carried aura cleanup");
    assert.deepEqual(near.deleted, [], "module does not race PF2e while replacing an in-range carried effect");
    assert.equal(near.created, 1, "ally inside planted burst receives banner effect");
    assert.equal(far.created, 0, "ally outside planted burst receives no effect");

    placement.removed = true;
    await syncPlantedBannerEffects(scene);
    assert.equal(near.items.some((item) => item.flags?.["pf2e-commanderer"]?.plantedBannerOrigin), false,
      "enemy removal immediately clears planted banner benefits");

    nearToken.document.x = 1000;
    nearToken.document.mechanicalBounds.x = 1000;
    await syncPlantedBannerEffects(scene);
    assert.deepEqual(near.items.map((item) => item.id), ["near-carried-aura"], "module effect removed while PF2e retains its native cleanup ownership");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.fromUuid = previousFromUuid;
  }
});

test("planted banner cleanup tolerates a PF2e effect already removed on the server", async () => {
  const commander = fakeActor("commander");
  commander.items.push({ slug: "commanders-banner", uuid: "Actor.commander.Item.banner" });
  for (const id of ["already-gone", "still-live"]) {
    commander.items.push({
      id,
      flags: {
        "pf2e-commanderer": {
          plantedBannerOrigin: { commanderUuid: commander.uuid, sceneId: "scene" },
        },
      },
    });
  }
  commander.serverMissingItems.add("already-gone");
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({ [commander.id]: placement }),
  };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: [fakeToken("commander-token", commander, 1000)] },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: { contents: [commander] },
    time: { worldTime: 100 },
    combat: null,
  };

  try {
    await syncPlantedBannerEffects(scene);
    assert.deepEqual(commander.deleteCalls, [
      ["already-gone", "still-live"],
      ["still-live"],
    ]);
    assert.deepEqual(commander.deleted, ["still-live"]);
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
  }
});

test("retrieving a banner removes every managed 40-foot planted effect", async () => {
  const commander = fakeActor("commander");
  const ally = fakeActor("ally");
  ally.items.push({
    id: "planted-banner-effect",
    flags: {
      "pf2e-commanderer": {
        plantedBannerOrigin: { commanderUuid: commander.uuid, sceneId: "scene" },
      },
    },
  });
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({}),
  };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: [fakeToken("commander-token", commander, 0), fakeToken("ally-token", ally, 700)] },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: { contents: [commander, ally] },
    time: { worldTime: 100 },
    combat: null,
  };

  try {
    await syncPlantedBannerEffects(scene);
    assert.deepEqual(ally.deleted, ["planted-banner-effect"]);
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
  }
});

test("Retrieve clears planted effects before restoring the native 30-foot aura", async () => {
  const operations = [];
  const commander = fakeActor("commander");
  commander.items.push({
    id: "banner-item",
    slug: "commanders-banner",
    system: { rules: [{ key: "RollOption", domain: "all", option: "commanders-banner", toggleable: true }] },
  });
  commander.rollOptions = { all: { "commanders-banner": false } };
  commander.toggleRollOption = async (_domain, _option, _itemId, active) => {
    operations.push(`aura:${active}`);
    commander.rollOptions.all["commanders-banner"] = active;
  };
  const ally = fakeActor("ally");
  const deleteEmbeddedDocuments = ally.deleteEmbeddedDocuments.bind(ally);
  ally.deleteEmbeddedDocuments = async (...args) => {
    operations.push("cleanup");
    return deleteEmbeddedDocuments(...args);
  };
  ally.items.push({
    id: "forty-foot-effect",
    flags: {
      "pf2e-commanderer": {
        plantedBannerOrigin: { commanderUuid: commander.uuid, sceneId: "scene" },
      },
    },
  });
  const commanderToken = fakeToken("commander-token", commander, 0);
  commander.getActiveTokens = () => [commanderToken];
  let placements = {
    [commander.id]: {
      actorId: commander.id,
      actorUuid: commander.uuid,
      tokenUuid: commanderToken.document.uuid,
      x: 0,
      y: 0,
      radius: 40,
    },
  };
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    tokens: { get: () => null },
    getFlag: () => placements,
    async setFlag(_scope, _key, value) { placements = value; },
    async unsetFlag() { placements = {}; },
  };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  const previousHooks = globalThis.Hooks;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    dimensions: { distance: 5, size: 100 },
    tokens: { placeables: [commanderToken, fakeToken("ally-token", ally, 700)] },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: { contents: [commander, ally] },
    time: { worldTime: 100 },
    combat: null,
  };
  globalThis.Hooks = { callAll() {} };

  try {
    assert.equal(await retrieveBanner(commander, scene), true);
    assert.deepEqual(ally.deleted, ["forty-foot-effect"]);
    assert.equal(commander.rollOptions.all["commanders-banner"], true);
    assert.deepEqual(operations, ["cleanup", "aura:true"]);
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.Hooks = previousHooks;
  }
});

test("first token movement into planted aura uses current document position", async () => {
  const commander = fakeActor("commander");
  commander.items.push({ slug: "commanders-banner", uuid: "Actor.commander.Item.banner" });
  const ally = fakeActor("ally");
  const commanderToken = fakeToken("commander-token", commander, 1000);
  const movingToken = fakeToken("ally-token", ally, 1000, { documentX: 100 });
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({ [commander.id]: placement }),
  };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  const previousFromUuid = globalThis.fromUuid;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: [commanderToken, movingToken] },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: { contents: [commander, ally] },
    time: { worldTime: 100 },
    combat: null,
  };
  globalThis.fromUuid = async () => ({
    toObject: () => ({
      name: "Effect: Commander's Banner",
      type: "effect",
      system: { context: {}, start: {} },
      flags: {},
    }),
  });

  try {
    await syncPlantedBannerEffects(scene);
    assert.equal(ally.created, 1, "ally receives effect on first movement into aura");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.fromUuid = previousFromUuid;
  }
});
