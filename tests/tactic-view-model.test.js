import test from "node:test";
import assert from "node:assert/strict";
import { tacticViewModel } from "../scripts/ui/tactic-view-model.js";

function tactic(overrides = {}) {
  return {
    id: "tactic-id",
    name: "Strike Hard!",
    img: "systems/pf2e/icons/actions/TwoActions.webp",
    system: {
      actionType: { value: "action" },
      actions: { value: 2 },
      level: { value: 1 },
      traits: {
        value: ["brandish", "commander", "tactic"],
        otherTags: ["commander-offensive-tactic"],
      },
      frequency: null,
      ...overrides,
    },
  };
}

test("tactic view model exposes professional panel metadata", () => {
  const view = tacticViewModel(tactic(), {
    prepared: true,
    expanded: true,
    description: "<p>Attack now.</p>",
    audience: { eligibleCount: 2, readyLabel: "2 ready" },
  });

  assert.equal(view.actionLabel, "2 actions");
  assert.equal(view.levelLabel, "Level 1");
  assert.deepEqual(view.tags, ["Offensive", "Brandish"]);
  assert.equal(view.prepared, true);
  assert.equal(view.expanded, true);
  assert.equal(view.description, "<p>Attack now.</p>");
  assert.equal(view.audience.readyLabel, "2 ready");
  assert.equal(view.canIssue, true);
});

test("tactic view model handles reaction and frequency metadata", () => {
  const view = tacticViewModel(tactic({
    actionType: { value: "reaction" },
    actions: { value: null },
    frequency: { value: 1, max: 3 },
  }));

  assert.equal(view.actionLabel, "Reaction");
  assert.equal(view.frequencyLabel, "1/3 uses");
  assert.equal(view.canIssue, false);
});

test("prepared tactics remain unavailable without eligible responders", () => {
  const view = tacticViewModel(tactic(), {
    prepared: true,
    audience: { eligibleCount: 0, readyLabel: "0 ready" },
  });

  assert.equal(view.canIssue, false);
  assert.equal(view.issueTitle, "No squadmates currently meet this tactic's signal reach");
});
