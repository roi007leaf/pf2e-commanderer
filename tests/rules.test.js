import test from "node:test";
import assert from "node:assert/strict";
import { participantControlType, preparedCapacity, responseAllowed, selectionAllowed, squadCapacity } from "../scripts/domain/rules.js";
import { TACTICS, tacticDefinition } from "../scripts/domain/tactics.js";

test("Commander squad capacity includes two plus Intelligence modifier", () => {
  assert.equal(squadCapacity(4), 6);
  assert.equal(squadCapacity(-3), 0);
});

test("prepared tactic progression follows tactician proficiency", () => {
  assert.equal(preparedCapacity({ level: 1 }), 3);
  assert.equal(preparedCapacity({ level: 7 }), 4);
  assert.equal(preparedCapacity({ level: 15 }), 5);
  assert.equal(preparedCapacity({ level: 19, efficientPreparation: true }), 7);
  assert.equal(preparedCapacity({ level: 8, commander: false, tacticalExcellence: 2 }), 3);
});

test("a creature can respond only once for a combat round key", () => {
  assert.equal(responseAllowed(null, "combat:2"), true);
  assert.equal(responseAllowed("combat:1", "combat:2"), true);
  assert.equal(responseAllowed("combat:2", "combat:2"), false);
});

test("participant limits reject invalid selections", () => {
  assert.equal(selectionAllowed("one", 1, 4), true);
  assert.equal(selectionAllowed("one", 2, 4), false);
  assert.equal(selectionAllowed("two", 2, 4), true);
  assert.equal(selectionAllowed("two", 1, 4), false);
  assert.equal(selectionAllowed("up-to-2", 2, 4), true);
  assert.equal(selectionAllowed("all", 3, 4), false);
  assert.equal(selectionAllowed("all", 4, 4), true);
});

test("single-responder tactics use an exclusive participant control", () => {
  assert.equal(participantControlType("one"), "radio");
  assert.equal(participantControlType("two"), "checkbox");
  assert.equal(participantControlType("up-to-2"), "checkbox");
});

test("unknown tactics still get the universal tracked workflow", () => {
  assert.equal(tacticDefinition("future-tactic").selection, "all");
  assert.equal(tacticDefinition("future-tactic").response.kind, "manual");
});

test("the PF2e 8.4 tactic catalog has explicit workflow definitions", () => {
  assert.equal(Object.keys(TACTICS).length, 37);
  assert.equal(tacticDefinition("protective-screen").selection, "one");
  assert.equal(tacticDefinition("bloody-guillotine").selection, "up-to-3");
  assert.equal(tacticDefinition("insta-ballista").selection, "all");
});

test("coordinated tactics preserve shared target and exact action constraints", () => {
  assert.equal(tacticDefinition("bloody-guillotine").designatedTarget, "enemy");
  assert.equal(tacticDefinition("sanguine-revitalization").targetInAura, true);
  assert.equal(tacticDefinition("seek-and-destroy").selection, "up-to-2");
  assert.deepEqual(
    tacticDefinition("pop-drop-and-lock").response.steps[1].choices.map((choice) => choice.label),
    ["Strike", "Trip", "Grapple"],
  );
  assert.deepEqual(
    tacticDefinition("double-team").response.steps[1].choices.map((choice) => choice.label),
    ["Shove", "Reposition"],
  );
});

test("cross-owner inventory and source-counteract tactics use guided workflows", () => {
  const manualSlugs = Object.entries(TACTICS)
    .filter(([, definition]) => definition.response.kind === "guided")
    .map(([slug]) => slug);
  assert.deepEqual(manualSlugs, ["alley-oop", "for-talmandor-for-freedom"]);
  assert.equal(Object.values(TACTICS).some((definition) => definition.response.kind === "manual"), false);
});
