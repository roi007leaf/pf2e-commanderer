import test from "node:test";
import assert from "node:assert/strict";
import { renderBannerOverlay, showGatherGuidance } from "../scripts/canvas/banner-overlay.js";

test("banner overlay renders identity without canvas text labels", () => {
  let textObjects = 0;

  class Container {
    constructor() {
      this.children = [];
      this.position = { set() {} };
      this.scale = { set() {} };
    }

    addChild(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }

    removeChildren() {
      return this.children.splice(0);
    }

    destroy() {}
  }

  class Graphics {
    beginFill() {}
    lineStyle() {}
    drawCircle() {}
    drawRoundedRect() {}
    endFill() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    destroy() {}
  }

  class Text {
    constructor() {
      textObjects += 1;
      this.width = 120;
      this.height = 20;
      this.anchor = { set() {} };
    }
  }

  const stage = new Container();
  stage.scale = { x: 1 };
  const token = {
    id: "commander-token",
    isVisible: true,
    controlled: true,
    hover: true,
    center: { x: 100, y: 100 },
    mechanicalBounds: { x: 75, y: 75, width: 50, height: 50 },
    auras: new Map([["commanders-banner", { radiusPixels: 300, token: true, visible: true }]]),
  };

  const previousCanvas = globalThis.canvas;
  const previousPixi = globalThis.PIXI;
  globalThis.PIXI = { Container, Graphics, Text };
  globalThis.canvas = {
    ready: true,
    stage,
    tokens: { placeables: [token] },
  };

  try {
    renderBannerOverlay();
    assert.equal(stage.children.length, 1);
    assert.equal(textObjects, 0);

    const clearGuidance = showGatherGuidance(token, { id: "commander-id" }, token);
    assert.equal(stage.children[0].children.length, 3, "banner boundary, banner pin, and movement cue render");
    clearGuidance();
    assert.equal(stage.children[0].children.length, 2, "movement cue clears when planning ends");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.PIXI = previousPixi;
  }
});

test("planted banner replaces carried origin with burst and standard graphics", () => {
  class Container {
    constructor() {
      this.children = [];
      this.position = { set() {} };
      this.scale = { set() {} };
    }
    addChild(...children) {
      for (const child of children) {
        child.parent = this;
        this.children.push(child);
      }
    }
    removeChildren() { return this.children.splice(0); }
    destroy() {}
  }
  class Graphics {
    beginFill() {}
    lineStyle() {}
    drawCircle() {}
    endFill() {}
    moveTo() {}
    lineTo() {}
    closePath() {}
    destroy() {}
  }

  const stage = new Container();
  stage.scale = { x: 1 };
  const actor = { id: "commander-id", rollOptions: { all: { "commanders-banner": true } } };
  const token = {
    id: "commander-token",
    actor,
    isVisible: true,
    center: { x: 100, y: 100 },
    mechanicalBounds: { x: 75, y: 75, width: 50, height: 50 },
    auras: new Map([["commanders-banner", { radiusPixels: 300, token: true, visible: true }]]),
  };
  const placement = {
    actorId: actor.id,
    actorUuid: "Actor.commander-id",
    x: 125,
    y: 125,
    radius: 40,
  };
  let scenePlacements = { [actor.id]: placement };

  const previousCanvas = globalThis.canvas;
  const previousPixi = globalThis.PIXI;
  const previousGame = globalThis.game;
  globalThis.PIXI = { Container, Graphics };
  globalThis.game = { actors: { get: (id) => id === actor.id ? actor : null } };
  globalThis.canvas = {
    ready: true,
    stage,
    grid: { size: 100 },
    scene: {
      grid: { distance: 5 },
      getFlag: () => scenePlacements,
    },
    tokens: { placeables: [token] },
  };

  try {
    renderBannerOverlay();
    const canvasOverlay = stage.children[0];
    assert.equal(canvasOverlay.children.length, 2);
    assert.ok(canvasOverlay.children[0] instanceof Graphics, "40-foot burst boundary rendered");
    assert.ok(canvasOverlay.children[1] instanceof Container, "planted standard marker rendered");
    assert.equal(token.auras.get("commanders-banner").visible, false, "carried native aura hidden while planted");

    scenePlacements = {};
    renderBannerOverlay();
    assert.equal(token.auras.get("commanders-banner").visible, true, "native aura restored after retrieval");
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.PIXI = previousPixi;
    globalThis.game = previousGame;
  }
});
