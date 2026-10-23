import test from "node:test";
import assert from "node:assert/strict";

import { registerBannerOverlay } from "../scripts/canvas/banner-overlay.js";
import { registerPlantedBannerEffects } from "../scripts/foundry/banner-effects.js";
import { registerPassiveFeats } from "../scripts/foundry/passive-feats.js";

function captureHooks() {
  const handlers = new Map();
  return {
    handlers,
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    },
    fire(name, ...args) {
      for (const fn of handlers.get(name) ?? []) fn(...args);
    },
  };
}

function withGlobals(patch, run) {
  const previous = {};
  for (const key of Object.keys(patch)) {
    previous[key] = globalThis[key];
    globalThis[key] = patch[key];
  }
  const restore = () => {
    for (const [key, value] of Object.entries(previous)) globalThis[key] = value;
  };
  return Promise.resolve().then(run).finally(restore);
}

function ordinaryTokens(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `token-${index}`, auras: new Map() }));
}

test("banner overlay ignores token refreshes and pans when no banner is on the scene", async () => {
  const hooks = captureHooks();
  let frames = 0;
  const tokens = ordinaryTokens(600);
  await withGlobals({
    Hooks: hooks,
    requestAnimationFrame: () => { frames += 1; },
    canvas: { ready: true, scene: { getFlag: () => ({}) }, tokens: { placeables: tokens } },
  }, () => {
    registerBannerOverlay();
    for (const token of tokens) hooks.fire("refreshToken", token, { refreshVisibility: true });
    hooks.fire("canvasPan", globalThis.canvas, { scale: 2 });
    assert.equal(frames, 0, "no overlay render is queued without banners, planted banners, or guidance");

    const bannerToken = { id: "commander", auras: new Map([["commanders-banner", { radiusPixels: 300 }]]) };
    hooks.fire("refreshToken", bannerToken, { refreshPosition: true });
    assert.equal(frames, 1, "a token carrying a banner aura still queues an overlay render");
  });
});

test("planted banner sync skips token and actor updates while no banner is planted", async () => {
  const hooks = captureHooks();
  const timers = [];
  let placements = {};
  const scene = { id: "scene", getFlag: () => placements };
  let queued = 0;
  const flush = async () => {
    while (timers.length) {
      timers.shift()();
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  await withGlobals({
    Hooks: hooks,
    setTimeout: (fn) => { queued += 1; timers.push(fn); return timers.length; },
    game: { user: { id: "gm", isGM: true }, users: { activeGM: null }, actors: [] },
    canvas: { ready: true, scene, tokens: { placeables: [] } },
  }, async () => {
    registerPlantedBannerEffects();
    await flush();
    const initial = queued;
    for (let index = 0; index < 20; index += 1) {
      hooks.fire("updateToken", { id: `token-${index}` }, { x: index });
      hooks.fire("updateActor", { id: `actor-${index}` }, { system: {} });
      await flush();
    }
    assert.equal(queued, initial, "no sync is queued while the scene has no planted banners");

    placements = { commander: { actorId: "commander", actorUuid: "Actor.commander", x: 0, y: 0 } };
    hooks.fire("updateToken", { id: "token-moved" }, { x: 100 });
    assert.equal(queued, initial + 1, "a planted banner still resyncs effects on token moves");
    placements = {};
    await flush();
  });
});

function scanCountingActor(id, items = []) {
  const actor = {
    id,
    uuid: `Actor.${id}`,
    scans: 0,
    getFlag: () => null,
    rollOptions: { all: {} },
  };
  Object.defineProperty(actor, "items", {
    get() {
      actor.scans += 1;
      return items;
    },
  });
  return actor;
}

test("passive feat maintenance ignores token updates that cannot change commander state", async () => {
  const hooks = captureHooks();
  const timers = [];
  const actors = Array.from({ length: 50 }, (_, index) => scanCountingActor(`actor-${index}`));
  const flush = async () => {
    while (timers.length) {
      timers.shift()();
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const totalScans = () => actors.reduce((sum, actor) => sum + actor.scans, 0);
  await withGlobals({
    Hooks: hooks,
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    game: { user: { id: "gm", isGM: true }, users: { activeGM: null }, actors, combat: null },
    canvas: { ready: true, scene: { getFlag: () => ({}) }, tokens: { placeables: [] } },
    ui: { notifications: { error() {} } },
    fromUuidSync: () => null,
  }, async () => {
    registerPassiveFeats();
    await flush();
    const afterInitialSync = totalScans();
    assert.ok(afterInitialSync > 0, "the initial maintenance pass still inspects actors");

    hooks.fire("updateToken", { id: "token" }, { flags: { "pf2e-visioner": { visibility: {} } } });
    await flush();
    assert.equal(totalScans(), afterInitialSync, "flag-only token updates do not rescan every actor");

    hooks.fire("updateToken", { id: "token" }, { x: 200, y: 100 });
    await flush();
    assert.equal(totalScans(), afterInitialSync, "moves rescan nothing while no position-dependent effect exists");

    const workflowItem = { id: "adjacent", delete: async () => {}, getFlag: (scope, key) => key === "workflow" ? { adjacentTo: "Scene.s.Token.t" } : null };
    const tracked = scanCountingActor("tracked", [workflowItem]);
    actors.push(tracked);
    hooks.fire("createItem", workflowItem);
    await flush();
    const afterItem = totalScans();
    hooks.fire("updateToken", { id: "token" }, { x: 300 });
    await flush();
    assert.ok(totalScans() > afterItem, "moves resync once an adjacency effect depends on position");
  });
});
