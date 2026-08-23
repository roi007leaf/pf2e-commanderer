import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  bannerCorner,
  bannerRangeToBounds,
  hasPlantBanner,
  plantedBannerRadius,
} from "../scripts/domain/banner-placement.js";
import { plantBanner, plantedBanner, retrieveBanner } from "../scripts/foundry/banner.js";

test("Commander panel exposes Plant Banner and Retrieve actions", async () => {
  const template = await readFile(new URL("../templates/panel.hbs", import.meta.url), "utf8");
  assert.match(template, /data-action="toggleBannerPlacement"/);
  assert.match(template, /data-action="plantBannerAtCorner"/);
  assert.match(template, /data-action="retrieveBanner"/);
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
