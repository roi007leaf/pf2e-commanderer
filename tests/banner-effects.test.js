import test from "node:test";
import assert from "node:assert/strict";

import { syncPlantedBannerEffects } from "../scripts/foundry/banner-effects.js";

function fakeActor(id, alliance = "party") {
  const actor = {
    id,
    uuid: `Actor.${id}`,
    name: id,
    alliance,
    items: [],
    created: 0,
    deleted: [],
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
      this.deleted.push(...ids);
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
  };
  return actor;
}

function fakeToken(id, actor, x) {
  return {
    id,
    actor,
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
    assert.deepEqual(commander.deleted, ["old-carried-aura"], "stale carried aura effect is removed immediately");
    assert.equal(near.created, 1, "ally inside planted burst receives banner effect");
    assert.equal(far.created, 0, "ally outside planted burst receives no effect");

    nearToken.mechanicalBounds.x = 1000;
    await syncPlantedBannerEffects(scene);
    assert.equal(near.items.length, 0, "effect removed after leaving planted burst");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.fromUuid = previousFromUuid;
  }
});
