import test from "node:test";
import assert from "node:assert/strict";

import { plantBannerTemporaryHitPoints } from "../scripts/domain/banner-placement.js";
import {
  grantInitialPlantBannerTempHp,
  removePlantBannerTempHp,
  refreshPlantBannerTempHpForTurn,
  registerPlantBannerTempHp,
} from "../scripts/foundry/plant-banner-temp-hp.js";

function fakeActor(id, { level = 1, alliance = "party", items = [] } = {}) {
  return {
    id,
    uuid: `Actor.${id}`,
    name: id,
    level,
    alliance,
    items: [...items],
    created: [],
    deleted: [],
    async createEmbeddedDocuments(_type, sources) {
      for (const source of sources) {
        const item = {
          ...source,
          id: `${id}-effect-${this.items.length}`,
          updates: [],
          getFlag: (scope, key) => source.flags?.[scope]?.[key],
          async update(changes) {
            this.updates.push(changes);
          },
        };
        this.items.push(item);
        this.created.push(item);
      }
      return this.created.slice(-sources.length);
    },
    async deleteEmbeddedDocuments(_type, ids) {
      this.deleted.push(...ids);
      this.items = this.items.filter((item) => !ids.includes(item.id));
    },
  };
}

function fakeToken(id, actor, x) {
  return {
    id,
    actor,
    document: {
      uuid: `Scene.scene.Token.${id}`,
      mechanicalBounds: { x, y: 0, width: 100, height: 100 },
    },
    mechanicalBounds: { x, y: 0, width: 100, height: 100 },
  };
}

function setupWorld({ commander, tokens, placement }) {
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({ [commander.id]: placement }),
  };
  const actors = tokens.map((token) => token.actor);
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: tokens },
  };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm" } },
    actors: {
      contents: actors,
      get: (id) => actors.find((actor) => actor.id === id),
    },
    time: { worldTime: 100 },
    combat: null,
  };
  globalThis.fromUuid = async () => ({
    toObject: () => ({
      name: "Effect: Plant Banner",
      type: "effect",
      system: {
        context: {},
        duration: { value: -1, unit: "unlimited", expiry: null },
        rules: [{
          events: { onCreate: true, onTurnStart: true },
          key: "TempHP",
          value: "4 * (1 + floor(@item.origin.level / 4))",
        }],
        start: {},
      },
      flags: {},
    }),
  });
  return scene;
}

test("Plant Banner temporary HP scales every 4 Commander levels", () => {
  assert.equal(plantBannerTemporaryHitPoints(1), 4);
  assert.equal(plantBannerTemporaryHitPoints(3), 4);
  assert.equal(plantBannerTemporaryHitPoints(4), 8);
  assert.equal(plantBannerTemporaryHitPoints(8), 12);
  assert.equal(plantBannerTemporaryHitPoints(20), 24);
});

test("planting grants the native temp-HP effect to other allies within 30 feet", async () => {
  const plantFeat = { slug: "plant-banner", uuid: "Actor.commander.Item.plant" };
  const commander = fakeActor("commander", { level: 5, items: [plantFeat] });
  const near = fakeActor("near");
  const far = fakeActor("far");
  const commanderToken = fakeToken("commander", commander, 0);
  const nearToken = fakeToken("near", near, 100);
  const farToken = fakeToken("far", far, 700);
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const previous = { canvas: globalThis.canvas, game: globalThis.game, fromUuid: globalThis.fromUuid };
  const scene = setupWorld({ commander, tokens: [commanderToken, nearToken, farToken], placement });

  try {
    await grantInitialPlantBannerTempHp(scene, placement);
    assert.equal(commander.created.length, 0, "Commander is not their own ally");
    assert.equal(near.created.length, 1, "near ally gains temporary HP immediately");
    assert.equal(far.created.length, 0, "40-foot banner aura does not enlarge 30-foot temp-HP burst");
    const source = near.created[0];
    assert.equal(source.name, "Effect: Plant Banner");
    assert.equal(source.system.context.origin.actor, commander.uuid);
    assert.equal(source.system.context.origin.item, plantFeat.uuid);
    assert.deepEqual(source.system.duration, { value: 1, unit: "rounds", expiry: "turn-start", sustained: false });
    assert.deepEqual(source.system.rules[0].events, { onCreate: true, onTurnStart: true });
  } finally {
    globalThis.canvas = previous.canvas;
    globalThis.game = previous.game;
    globalThis.fromUuid = previous.fromUuid;
  }
});

test("Plant Banner temp-HP automation registers placement and PF2e turn-start hooks", () => {
  const previousHooks = globalThis.Hooks;
  const registered = [];
  globalThis.Hooks = { on: (name) => registered.push(name) };
  try {
    registerPlantBannerTempHp();
    assert.ok(registered.includes("updateScene"));
    assert.ok(registered.includes("pf2e.startTurn"));
  } finally {
    globalThis.Hooks = previousHooks;
  }
});

test("turn start grants or renews temp HP only while ally remains inside burst", async () => {
  const commander = fakeActor("commander", {
    level: 5,
    items: [{ slug: "plant-banner", uuid: "Actor.commander.Item.plant" }],
  });
  const ally = fakeActor("ally");
  const allyToken = fakeToken("ally", ally, 100);
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const previous = { canvas: globalThis.canvas, game: globalThis.game, fromUuid: globalThis.fromUuid };
  const scene = setupWorld({ commander, tokens: [fakeToken("commander", commander, 0), allyToken], placement });
  const combatant = { actor: ally, token: allyToken.document, initiative: 18 };

  try {
    await refreshPlantBannerTempHpForTurn(combatant, scene);
    assert.equal(ally.created.length, 1, "entering ally gains temp HP at start of turn");

    await refreshPlantBannerTempHpForTurn(combatant, scene);
    assert.equal(ally.created.length, 1, "existing native effect is renewed without duplication");
    assert.equal(ally.created[0].updates.length, 1, "duration start follows latest renewal");

    allyToken.document.mechanicalBounds.x = 1000;
    await refreshPlantBannerTempHpForTurn(combatant, scene);
    assert.deepEqual(ally.deleted, [ally.created[0].id], "effect expires when next turn begins outside burst");
  } finally {
    globalThis.canvas = previous.canvas;
    globalThis.game = previous.game;
    globalThis.fromUuid = previous.fromUuid;
  }
});

test("enemy removal immediately clears Plant Banner temp HP and blocks renewal", async () => {
  const commander = fakeActor("commander", {
    level: 5,
    items: [{ slug: "plant-banner", uuid: "Actor.commander.Item.plant" }],
  });
  const ally = fakeActor("ally");
  const allyToken = fakeToken("ally", ally, 100);
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const previous = { canvas: globalThis.canvas, game: globalThis.game, fromUuid: globalThis.fromUuid };
  const scene = setupWorld({ commander, tokens: [fakeToken("commander", commander, 0), allyToken], placement });

  try {
    await grantInitialPlantBannerTempHp(scene, placement);
    assert.equal(ally.created.length, 1);

    placement.removed = true;
    await removePlantBannerTempHp(scene, commander.uuid);
    assert.deepEqual(ally.deleted, [ally.created[0].id]);
    assert.equal(await grantInitialPlantBannerTempHp(scene, placement), 0);
    assert.equal(await refreshPlantBannerTempHpForTurn({ actor: ally, token: allyToken.document }, scene), false);
    assert.equal(ally.created.length, 1, "removed banner cannot renew temp HP");
  } finally {
    globalThis.canvas = previous.canvas;
    globalThis.game = previous.game;
    globalThis.fromUuid = previous.fromUuid;
  }
});
