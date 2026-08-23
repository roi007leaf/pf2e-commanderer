import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previousFoundry = globalThis.foundry;
globalThis.foundry = {
  applications: {
    api: { ApplicationV2: class {} },
    instances: new Map(),
  },
};
const panelModule = await import(`../scripts/ui/panel.js?panel-live=${Date.now()}`);
globalThis.foundry = previousFoundry;

const { CommanderPanel, registerCommanderPanelLiveUpdates } = panelModule;

test("collapsed tactics keep hidden details ready for DOM-only expansion", async () => {
  const template = await readFile(new URL("../templates/panel.hbs", import.meta.url), "utf8");
  assert.match(template, /class="commanderer-tactic-details" \{\{#unless expanded\}\}hidden\{\{\/unless\}\}/);
});

test("tactic detail expansion updates existing DOM without rendering panel", () => {
  const expandedTactics = new Set();
  const classes = new Set(["commanderer-tactic"]);
  const details = { hidden: true };
  const article = {
    classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name) },
    querySelector: () => details,
  };
  const attributes = new Map();
  const button = {
    dataset: { itemId: "tactic-id" },
    title: "Show details",
    closest: () => article,
    setAttribute: (name, value) => attributes.set(name, value),
  };
  const panel = {
    expandedTactics,
    render: () => assert.fail("detail expansion must not render whole panel"),
  };

  CommanderPanel.toggleTacticDetails.call(panel, null, button);

  assert.equal(expandedTactics.has("tactic-id"), true);
  assert.equal(details.hidden, false);
  assert.equal(classes.has("expanded"), true);
  assert.equal(attributes.get("aria-expanded"), "true");
});

test("full panel refresh preserves commander panel scroll position", () => {
  const oldPanel = { scrollTop: 275 };
  const newPanel = { scrollTop: 0 };
  let replaced = false;
  const content = {
    querySelector: () => replaced ? newPanel : oldPanel,
    set innerHTML(_value) { replaced = true; },
  };

  CommanderPanel.prototype._replaceHTML.call({}, "<div></div>", content);

  assert.equal(newPanel.scrollTop, 275);
});

test("bursty live updates coalesce into one panel render", () => {
  const originalFoundry = globalThis.foundry;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const callbacks = new Map();
  let nextTimer = 0;
  let renders = 0;
  const panel = Object.assign(Object.create(CommanderPanel.prototype), {
    _refreshTimer: null,
    render: () => { renders += 1; },
  });
  Object.defineProperty(panel, "id", { value: "commander-panel" });
  globalThis.foundry = {
    applications: {
      api: { ApplicationV2: class {} },
      instances: new Map([[panel.id, panel]]),
    },
  };
  globalThis.setTimeout = (callback) => {
    nextTimer += 1;
    callbacks.set(nextTimer, callback);
    return nextTimer;
  };
  globalThis.clearTimeout = (timer) => callbacks.delete(timer);

  try {
    panel.requestRefresh();
    panel.requestRefresh();
    assert.equal(callbacks.size, 1);
    [...callbacks.values()][0]();
    assert.equal(renders, 1);
  } finally {
    globalThis.foundry = originalFoundry;
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("live update hooks refresh an open panel for squad token movement", () => {
  assert.equal(typeof registerCommanderPanelLiveUpdates, "function");
  const callbacks = new Map();
  const commander = {
    uuid: "Actor.commander",
    getFlag: () => [{ actorUuid: "Actor.squadmate" }],
  };
  const panel = Object.assign(Object.create(CommanderPanel.prototype), {
    actor: commander,
    squadPlannerExpanded: false,
    refreshes: 0,
    requestRefresh() { this.refreshes += 1; },
  });
  const originalFoundry = globalThis.foundry;
  const originalHooks = globalThis.Hooks;
  globalThis.foundry = {
    applications: {
      api: { ApplicationV2: class {} },
      instances: new Map([["panel", panel]]),
    },
  };
  globalThis.Hooks = { on: (name, callback) => callbacks.set(name, callback) };

  try {
    registerCommanderPanelLiveUpdates();
    callbacks.get("updateToken")({ actor: { uuid: "Actor.squadmate" } });
    assert.equal(panel.refreshes, 1);
  } finally {
    globalThis.foundry = originalFoundry;
    globalThis.Hooks = originalHooks;
  }
});
