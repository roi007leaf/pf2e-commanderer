import test from "node:test";
import assert from "node:assert/strict";
import { gatherDestinationVerdict, gatherMovementModes } from "../scripts/domain/gather-movement.js";
import { gatherMovementResult, startGatherMovementPlanning } from "../scripts/foundry/gather-movement.js";

test("Gather to Me reads every supported PF2e movement Speed", () => {
  const actor = {
    system: {
      movement: {
        speeds: {
          land: { value: 25 },
          climb: { value: 15 },
          fly: null,
          swim: { value: 20 },
        },
      },
    },
  };

  assert.deepEqual(
    gatherMovementModes(actor, ["walk", "climb", "fly", "swim"]).map(({ action, speed }) => ({ action, speed })),
    [{ action: "walk", speed: 25 }, { action: "climb", speed: 15 }, { action: "swim", speed: 20 }],
  );
});

test("Gather to Me accepts destinations inside the banner aura", () => {
  assert.equal(gatherDestinationVerdict({
    originDistance: 60,
    destinationDistance: 30,
    speed: 30,
    pathCost: 30,
  }).code, "inside-aura");
});

test("Gather to Me rejects leaving the banner aura", () => {
  assert.equal(gatherDestinationVerdict({
    originDistance: 20,
    destinationDistance: 35,
    speed: 25,
    pathCost: 15,
  }).code, "left-aura");
});

test("Gather to Me requires enough movement when the aura cannot be reached", () => {
  assert.equal(gatherDestinationVerdict({
    originDistance: 80,
    destinationDistance: 65,
    speed: 25,
    pathCost: 15,
  }).code, "movement-unused");
});

test("Gather to Me rejects a poor destination on an unobstructed route", () => {
  assert.equal(gatherDestinationVerdict({
    originDistance: 80,
    destinationDistance: 65,
    speed: 25,
    pathCost: 25,
    directRoute: true,
  }).code, "not-closest");
});

test("Gather to Me accepts a full routed move around an obstacle", () => {
  assert.equal(gatherDestinationVerdict({
    originDistance: 80,
    destinationDistance: 65,
    speed: 25,
    pathCost: 25,
    directRoute: false,
  }).code, "closest-routed");
});

test("Gather chat result omits movement mode and measured distance", () => {
  assert.equal(gatherMovementResult("inside-aura"), "moved inside the banner aura");
  assert.equal(gatherMovementResult("closest-routed"), "moved as close to the banner aura as Speed allowed");
});

test("Gather planning visibly activates and controls the responder token before arming Foundry", async () => {
  const calls = [];
  const token = {
    layer: {
      _movementPlanningContext: null,
      activate(options) { calls.push(["activate", options]); },
    },
    control(options) { calls.push(["control", options]); },
    planMovement(options) {
      calls.push(["plan", options]);
      this.layer._movementPlanningContext = { object: this };
      return Promise.resolve(null);
    },
  };

  await startGatherMovementPlanning(token, { allowedActions: ["walk"], maxDistance: 25 });
  assert.deepEqual(calls.map(([name]) => name), ["activate", "control", "plan"]);
  assert.deepEqual(calls[0][1], { tool: "select" });
  assert.equal(calls[1][1].force, true);
});

test("Gather planning reports when Foundry fails to arm movement mode", () => {
  const token = {
    layer: { _movementPlanningContext: null, activate() {} },
    control() {},
    planMovement: () => Promise.resolve(null),
  };
  assert.throws(() => startGatherMovementPlanning(token, {}), /could not start/);
});
