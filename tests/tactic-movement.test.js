import test from "node:test";
import assert from "node:assert/strict";

import { movementBudget, movementDestinationVerdict } from "../scripts/domain/tactic-movement.js";

test("granted movement budgets support half, full, double, and fixed distances", () => {
  assert.equal(movementBudget(25, "half", 5), 10);
  assert.equal(movementBudget(25, "full", 5), 25);
  assert.equal(movementBudget(25, "double", 5), 50);
  assert.equal(movementBudget(25, 15, 5), 15);
});

test("direct movement rejects paths that first move away from target", () => {
  assert.equal(movementDestinationVerdict({
    relation: "toward-target",
    originTargetDistance: 30,
    destinationTargetDistance: 15,
    pathTargetDistances: [35, 15],
  }).code, "not-direct");
});

test("direct movement can require an adjacent destination", () => {
  assert.equal(movementDestinationVerdict({
    relation: "toward-target",
    originTargetDistance: 30,
    destinationTargetDistance: 10,
    pathTargetDistances: [20, 10],
    requireAdjacent: true,
    gridDistance: 5,
  }).code, "not-adjacent");
});

test("movement can finish inside a reach greater than adjacency", () => {
  assert.equal(movementDestinationVerdict({
    relation: "toward-target",
    originTargetDistance: 30,
    destinationTargetDistance: 10,
    pathTargetDistances: [20, 10],
    maximumTargetDistance: 10,
  }).valid, true);
  assert.equal(movementDestinationVerdict({
    relation: "toward-target",
    originTargetDistance: 30,
    destinationTargetDistance: 15,
    pathTargetDistances: [20, 15],
    maximumTargetDistance: 10,
  }).code, "not-in-reach");
});

test("defensive movement must finish farther from at least one enemy", () => {
  assert.equal(movementDestinationVerdict({
    relation: "away-from-enemy",
    hostileOriginDistances: [10, 20],
    hostileDestinationDistances: [15, 15],
  }).valid, true);
  assert.equal(movementDestinationVerdict({
    relation: "away-from-enemy",
    hostileOriginDistances: [10, 20],
    hostileDestinationDistances: [5, 15],
  }).code, "not-farther");
});
