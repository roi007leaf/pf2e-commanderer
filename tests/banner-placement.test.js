import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  bannerCorner,
  bannerRangeToBounds,
  hasPlantBanner,
  plantedBannerRadius,
} from "../scripts/domain/banner-placement.js";
import {
  bannerDisplayPoint,
  bannerOrigin,
  canRetrieveBanner,
  carriedBanners,
  dropCarriedBanner,
  dropCarriedBannersForToken,
  plantBanner,
  plantedBanner,
  removableEnemyBanners,
  removePlantedBannerAsEnemy,
  retrieveBanner,
} from "../scripts/foundry/banner.js";

test("Commander panel exposes Plant Banner and Retrieve actions", async () => {
  const template = await readFile(new URL("../templates/panel.hbs", import.meta.url), "utf8");
  const tokenHud = await readFile(new URL("../scripts/ui/token-hud.js", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles/commanderer.css", import.meta.url), "utf8");
  assert.match(template, /data-action="toggleBannerPlacement"/);
  assert.match(template, /data-action="plantBannerAtCorner"/);
  assert.match(template, /data-action="retrieveBanner"/);
  assert.match(template, /bannerRemoved/);
  assert.match(tokenHud, /requestEnemyBannerRemoval/);
  assert.match(tokenHud, /requestCarriedBannerDrop/);
  assert.match(tokenHud, /requestDroppedBannerPickup/);
  assert.match(tokenHud, /<strong>Interact<\/strong>/);
  assert.match(tokenHud, /Pull Down/);
  assert.match(tokenHud, /Take Banner/);
  assert.match(tokenHud, /Drop .*banner \(Release\)/);
  assert.match(tokenHud, /Pick Up .*banner \(Interact\)/);
  assert.doesNotMatch(tokenHud, /commander-remove-banner-icon/);
  assert.doesNotMatch(css, /commander-remove-banner-icon/);
});

test("banner corner picker renders below the compact Commander hero", async () => {
  const template = await readFile(new URL("../templates/panel.hbs", import.meta.url), "utf8");
  const heroStart = template.indexOf('<header class="commanderer-hero">');
  const heroEnd = template.indexOf("</header>", heroStart);
  const picker = template.indexOf('class="commanderer-banner-corners"');

  assert.ok(heroStart >= 0 && heroEnd > heroStart, "Commander hero exists");
  assert.ok(picker > heroEnd, "expanded picker must not enlarge or overflow the hero banner grid");
});

test("Commander ApplicationV2 registers every banner placement action", async () => {
  const previousFoundry = globalThis.foundry;
  globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
  try {
    const { CommanderPanel } = await import("../scripts/ui/panel.js");
    assert.equal(typeof CommanderPanel.DEFAULT_OPTIONS.actions.toggleBannerPlacement, "function");
    assert.equal(typeof CommanderPanel.DEFAULT_OPTIONS.actions.plantBannerAtCorner, "function");
    assert.equal(typeof CommanderPanel.DEFAULT_OPTIONS.actions.retrieveBanner, "function");
  } finally {
    globalThis.foundry = previousFoundry;
  }
});

test("Plant Banner is feat-gated and uses a 40-foot burst", () => {
  assert.equal(hasPlantBanner({ items: [{ slug: "plant-banner" }] }), true);
  assert.equal(hasPlantBanner({ items: [] }), false);
  assert.equal(plantedBannerRadius(), 40);
});

test("banner corners resolve to exact token footprint corners", () => {
  const bounds = { x: 100, y: 200, width: 50, height: 100 };
  assert.deepEqual(bannerCorner(bounds, "nw"), { x: 100, y: 200 });
  assert.deepEqual(bannerCorner(bounds, "ne"), { x: 150, y: 200 });
  assert.deepEqual(bannerCorner(bounds, "sw"), { x: 100, y: 300 });
  assert.deepEqual(bannerCorner(bounds, "se"), { x: 150, y: 300 });
});

test("planted banner range measures from point to creature footprint", () => {
  const banner = { x: 100, y: 100 };
  const tokenBounds = { x: 500, y: 100, width: 100, height: 100 };
  assert.equal(bannerRangeToBounds(banner, tokenBounds, { gridSize: 100, gridDistance: 5 }), 20);
});

test("Plant Banner persists a rule-legal corner and Retrieve removes it", async () => {
  let flags = {};
  const scene = {
    id: "scene-id",
    getFlag: (_scope, key) => flags[key],
    async setFlag(_scope, key, value) {
      flags[key] = value;
    },
    async unsetFlag(_scope, key) {
      delete flags[key];
    },
  };
  const actor = {
    id: "actor-id",
    uuid: "Actor.actor-id",
    items: [{
      id: "plant-banner",
      slug: "plant-banner",
    }, {
      id: "banner-item",
      system: { rules: [{ key: "RollOption", domain: "all", option: "commanders-banner", toggleable: true }] },
    }],
    rollOptions: { all: { "commanders-banner": false } },
    async toggleRollOption(_domain, _option, _itemId, active) {
      this.rollOptions.all["commanders-banner"] = active;
    },
  };
  const token = {
    id: "token-id",
    actor,
    document: { uuid: "Scene.scene-id.Token.token-id" },
    mechanicalBounds: { x: 100, y: 200, width: 50, height: 50 },
  };
  actor.getActiveTokens = () => [token];

  const previousCanvas = globalThis.canvas;
  globalThis.canvas = { ready: true, scene };
  try {
    const placement = await plantBanner(actor, "ne");
    assert.deepEqual({ x: placement.x, y: placement.y, radius: placement.radius }, { x: 150, y: 200, radius: 40 });
    assert.equal(actor.rollOptions.all["commanders-banner"], false, "native Commander aura disabled while planted");
    const { bannerActive } = await import("../scripts/foundry/runtime.js");
    assert.equal(bannerActive(actor), true, "Scene placement keeps module banner state active");
    assert.equal(plantedBanner(actor, scene)?.corner, "ne");

    token.mechanicalBounds = { x: 1000, y: 1000, width: 50, height: 50 };
    await assert.rejects(() => retrieveBanner(actor, scene), /Move adjacent/);
    token.mechanicalBounds = { x: 100, y: 200, width: 50, height: 50 };
    assert.equal(await retrieveBanner(actor, scene), true);
    assert.equal(plantedBanner(actor, scene), null);
    assert.equal(actor.rollOptions.all["commanders-banner"], true, "native Commander aura restored after retrieval");
  } finally {
    globalThis.canvas = previousCanvas;
  }
});

test("Plant and Retrieve publish banner placement only after native aura transitions", async () => {
  let flags = {};
  const operations = [];
  const scene = {
    id: "scene-id",
    getFlag: (_scope, key) => flags[key],
    async setFlag(_scope, key, value) {
      operations.push("placement:set");
      flags[key] = value;
    },
    async unsetFlag(_scope, key) {
      operations.push("placement:unset");
      delete flags[key];
    },
  };
  const actor = {
    id: "actor-id",
    uuid: "Actor.actor-id",
    items: [{ id: "plant-banner", slug: "plant-banner" }, {
      id: "banner-item",
      system: { rules: [{ key: "RollOption", domain: "all", option: "commanders-banner", toggleable: true }] },
    }],
    rollOptions: { all: { "commanders-banner": true } },
    async toggleRollOption(_domain, _option, _itemId, active) {
      operations.push(`banner:${active}`);
      this.rollOptions.all["commanders-banner"] = active;
    },
  };
  const token = {
    actor,
    document: { uuid: "Scene.scene-id.Token.token-id" },
    mechanicalBounds: { x: 100, y: 100, width: 50, height: 50 },
  };
  actor.getActiveTokens = () => [token];

  const previousCanvas = globalThis.canvas;
  globalThis.canvas = { ready: true, scene, grid: { size: 100 } };
  try {
    await plantBanner(actor, "nw", scene);
    assert.deepEqual(operations, ["banner:false", "placement:set"]);

    operations.length = 0;
    await retrieveBanner(actor, scene);
    assert.deepEqual(operations, ["placement:unset", "banner:true"]);
  } finally {
    globalThis.canvas = previousCanvas;
  }
});

test("adjacent enemy can remove planted benefits until Commander retrieves banner", async () => {
  let flags = {};
  const scene = {
    id: "scene-id",
    grid: { distance: 5 },
    getFlag: (_scope, key) => flags[key],
    async setFlag(_scope, key, value) { flags[key] = value; },
    async unsetFlag(_scope, key) { delete flags[key]; },
  };
  const commander = {
    id: "commander-id",
    uuid: "Actor.commander-id",
    name: "Commander",
    alliance: "party",
    items: [{
      id: "banner-item",
      system: { rules: [{ key: "RollOption", domain: "all", option: "commanders-banner", toggleable: true }] },
    }],
    rollOptions: { all: { "commanders-banner": false } },
    async toggleRollOption(_domain, _option, _itemId, active) {
      this.rollOptions.all["commanders-banner"] = active;
    },
  };
  const commanderToken = {
    id: "commander-token",
    actor: commander,
    mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 },
  };
  commander.getActiveTokens = () => [commanderToken];
  const player = { id: "player", isGM: false };
  const enemy = {
    id: "enemy-id",
    uuid: "Actor.enemy-id",
    name: "Enemy",
    alliance: "opposition",
    testUserPermission: (user, level) => user.id === player.id && level === "OWNER",
  };
  const enemyToken = {
    id: "enemy-token",
    actor: enemy,
    document: {
      uuid: "Scene.scene-id.Token.enemy-token",
      mechanicalBounds: { x: 100, y: 0, width: 100, height: 100 },
    },
  };
  const placement = {
    actorId: commander.id,
    actorUuid: commander.uuid,
    x: 100,
    y: 100,
    radius: 40,
    corner: "se",
  };
  flags.plantedBanners = { [commander.id]: placement };

  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  globalThis.canvas = {
    ready: true,
    scene,
    grid: { size: 100 },
    tokens: { placeables: [commanderToken, enemyToken] },
  };
  globalThis.game = {
    user: player,
    users: { get: (id) => id === player.id ? player : null },
    actors: { get: (id) => id === commander.id ? commander : null },
    time: { worldTime: 321 },
  };

  try {
    assert.equal(removableEnemyBanners(enemyToken, scene, player).length, 1);
    const removed = await removePlantedBannerAsEnemy({
      scene,
      commanderActorId: commander.id,
      enemyToken,
      user: player,
      mode: "carried",
    });
    assert.equal(removed.removed, true);
    assert.equal(removed.removalMode, "carried");
    assert.equal(removed.carrierTokenUuid, enemyToken.document.uuid);
    assert.equal(removed.removedBy.actorUuid, enemy.uuid);
    assert.equal((await import("../scripts/foundry/runtime.js")).bannerActive(commander), false);
    commander.rollOptions.all["commanders-banner"] = true;
    assert.equal((await import("../scripts/foundry/runtime.js")).bannerActive(commander), false,
      "fallen placement overrides any stale native roll option");
    commander.rollOptions.all["commanders-banner"] = false;
    assert.equal(bannerOrigin(commander), null, "removed banner supplies no tactic or aura origin");
    assert.equal(removableEnemyBanners(enemyToken, scene, player).length, 0, "banner cannot be removed twice");

    enemyToken.document.mechanicalBounds.x = 500;
    assert.deepEqual(bannerDisplayPoint(removed, scene), { x: 550, y: 0 }, "taken banner follows carrier top-center");
    assert.equal(canRetrieveBanner(commander, scene), false, "Commander cannot retrieve from old planted point");
    commanderToken.mechanicalBounds.x = 400;
    await assert.rejects(() => retrieveBanner(commander, scene), /GM must rule/);
    assert.equal(await retrieveBanner(commander, scene, { allowCarried: true }), true);
    assert.equal(plantedBanner(commander, scene), null);
    assert.equal(commander.rollOptions.all["commanders-banner"], true);

    const secondPlacement = { ...placement, x: 500, y: 0 };
    flags.plantedBanners = { [commander.id]: secondPlacement };
    commander.rollOptions.all["commanders-banner"] = false;
    enemyToken.document.mechanicalBounds.x = 500;
    const dropped = await removePlantedBannerAsEnemy({
      scene,
      commanderActorId: commander.id,
      enemyToken,
      user: player,
      mode: "dropped",
    });
    assert.equal(dropped.removalMode, "dropped");
    assert.equal(dropped.carrierTokenUuid, null);
    enemyToken.document.mechanicalBounds.x = 800;
    assert.deepEqual(bannerDisplayPoint(dropped, scene), { x: 500, y: 0 }, "pulled-down banner stays planted");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
  }
});

test("deleting a banner carrier drops it at the carrier's last location", async () => {
  let placements = {
    commander: {
      actorId: "commander",
      actorUuid: "Actor.commander",
      x: 100,
      y: 100,
      radius: 40,
      removed: true,
      removalMode: "carried",
      carrierTokenUuid: "Scene.scene.Token.carrier",
      removedBy: { actorUuid: "Actor.enemy", actorName: "Enemy" },
    },
  };
  const scene = {
    id: "scene",
    getFlag: () => placements,
    async setFlag(_scope, _key, value) { placements = value; },
  };
  const tokenDocument = {
    uuid: "Scene.scene.Token.carrier",
    parent: scene,
    mechanicalBounds: { x: 300, y: 200, width: 100, height: 100 },
  };
  const previousGame = globalThis.game;
  globalThis.game = { time: { worldTime: 456 } };
  try {
    assert.equal(await dropCarriedBannersForToken(tokenDocument, scene), 1);
    assert.equal(placements.commander.removalMode, "dropped");
    assert.equal(placements.commander.carrierTokenUuid, null);
    assert.deepEqual({ x: placements.commander.x, y: placements.commander.y }, { x: 350, y: 200 });
  } finally {
    globalThis.game = previousGame;
  }
});

test("owned banner carrier can release it at its current position", async () => {
  let placements = {
    commander: {
      actorId: "commander",
      actorUuid: "Actor.commander",
      x: 100,
      y: 100,
      radius: 40,
      removed: true,
      removalMode: "carried",
      carrierTokenUuid: "Scene.scene.Token.carrier",
      removedBy: { actorUuid: "Actor.enemy", actorName: "Enemy" },
    },
  };
  const scene = {
    id: "scene",
    getFlag: () => placements,
    async setFlag(_scope, _key, value) { placements = value; },
  };
  const owner = { id: "owner", isGM: false };
  const carrierActor = {
    uuid: "Actor.enemy",
    name: "Enemy",
    alliance: "opposition",
    testUserPermission: (user, level) => user.id === owner.id && level === "OWNER",
  };
  const carrierToken = {
    actor: carrierActor,
    document: {
      uuid: "Scene.scene.Token.carrier",
      mechanicalBounds: { x: 500, y: 300, width: 100, height: 100 },
    },
  };
  const commander = { id: "commander", uuid: "Actor.commander", name: "Commander", alliance: "party" };
  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  globalThis.canvas = { scene, tokens: { placeables: [carrierToken] } };
  globalThis.game = {
    actors: { get: (id) => id === commander.id ? commander : null },
    time: { worldTime: 789 },
  };
  try {
    assert.equal(carriedBanners(carrierToken, scene, owner).length, 1);
    const nonOwner = { id: "other", isGM: false };
    assert.deepEqual(carriedBanners(carrierToken, scene, nonOwner), []);
    await assert.rejects(() => dropCarriedBanner({
      scene,
      commanderActorId: commander.id,
      carrierToken,
      user: nonOwner,
    }), /do not own/);

    const dropped = await dropCarriedBanner({
      scene,
      commanderActorId: commander.id,
      carrierToken,
      user: owner,
    });
    assert.equal(dropped.removalMode, "dropped");
    assert.equal(dropped.carrierTokenUuid, null);
    assert.deepEqual({ x: dropped.x, y: dropped.y }, { x: 550, y: 300 });
    assert.equal(dropped.droppedAt, 789);
    assert.equal(dropped.droppedBy.userId, owner.id);
    assert.deepEqual(bannerDisplayPoint(dropped, scene), { x: 550, y: 300 });
    assert.deepEqual(carriedBanners(carrierToken, scene, owner), []);

    const { pickupableDroppedBanners, pickupDroppedBannerAsEnemy } = await import("../scripts/foundry/banner.js");
    assert.deepEqual(pickupableDroppedBanners(carrierToken, scene, nonOwner), []);
    await assert.rejects(() => pickupDroppedBannerAsEnemy({
      scene,
      commanderActorId: commander.id,
      enemyToken: carrierToken,
      user: nonOwner,
    }), /cannot pick up/);
    carrierToken.document.mechanicalBounds.x = 800;
    assert.deepEqual(pickupableDroppedBanners(carrierToken, scene, owner), []);
    carrierToken.document.mechanicalBounds.x = 500;
    assert.equal(pickupableDroppedBanners(carrierToken, scene, owner).length, 1);
    const pickedUp = await pickupDroppedBannerAsEnemy({
      scene,
      commanderActorId: commander.id,
      enemyToken: carrierToken,
      user: owner,
    });
    assert.equal(pickedUp.removalMode, "carried");
    assert.equal(pickedUp.carrierTokenUuid, carrierToken.document.uuid);
    assert.deepEqual(bannerDisplayPoint(pickedUp, scene), { x: 550, y: 300 });
    assert.equal(carriedBanners(carrierToken, scene, owner).length, 1);
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
  }
});

test("allies, distant enemies, and non-owners cannot remove a planted banner", () => {
  const commander = { id: "commander", uuid: "Actor.commander", alliance: "party" };
  const placement = { actorId: commander.id, actorUuid: commander.uuid, x: 0, y: 0, radius: 40 };
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    getFlag: () => ({ [commander.id]: placement }),
  };
  const user = { id: "player", isGM: false };
  const actor = {
    uuid: "Actor.creature",
    alliance: "party",
    testUserPermission: () => true,
  };
  const token = {
    actor,
    document: { mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 } },
  };
  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  globalThis.canvas = { scene, grid: { size: 100 }, tokens: { placeables: [token] } };
  globalThis.game = { actors: { get: () => commander } };
  try {
    assert.deepEqual(removableEnemyBanners(token, scene, user), [], "ally rejected");
    actor.alliance = "opposition";
    token.document.mechanicalBounds.x = 200;
    assert.deepEqual(removableEnemyBanners(token, scene, user), [], "enemy beyond adjacency rejected");
    token.document.mechanicalBounds.x = 0;
    actor.testUserPermission = () => false;
    assert.deepEqual(removableEnemyBanners(token, scene, user), [], "non-owner rejected");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
  }
});
