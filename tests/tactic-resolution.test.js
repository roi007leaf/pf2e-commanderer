import test from "node:test";
import assert from "node:assert/strict";
import { resolutionGeometryVerdict } from "../scripts/domain/tactic-resolution.js";

test("resolution target count is enforced", () => {
  const verdict = resolutionGeometryVerdict({ targetParticipantDistances: [[5], [10]], maxTargets: 1 });
  assert.equal(verdict.code, "too-many-targets");
});

test("area resolution accepts targets close to any responder", () => {
  const verdict = resolutionGeometryVerdict({
    targetParticipantDistances: [[25, 10], [5, 30]],
    geometry: { withinAny: 10 },
  });
  assert.equal(verdict.valid, true);
});

test("area resolution rejects a target outside every responder", () => {
  const verdict = resolutionGeometryVerdict({
    targetParticipantDistances: [[15, 20]],
    geometry: { withinAny: 10 },
  });
  assert.equal(verdict.code, "outside-area");
});

test("tactical takedown requires two responders adjacent to one target", () => {
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[5]],
    minParticipants: 2,
    geometry: { adjacentToAll: true },
  }).code, "too-few-responders");
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[5, 10]],
    minParticipants: 2,
    geometry: { adjacentToAll: true },
  }).code, "not-adjacent-to-all");
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[5, 5]],
    minParticipants: 2,
    geometry: { adjacentToAll: true },
  }).valid, true);
});

test("commander-origin target range is enforced", () => {
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[]],
    targetCommanderDistances: [65],
    geometry: { withinCommander: 60 },
  }).code, "outside-commander-range");
});

test("close formation validates every responder pair", () => {
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[30, 25, 20]],
    participantPairDistances: [5, 10, 15],
    geometry: { pairwiseWithin: 10 },
  }).code, "formation-too-wide");
  assert.equal(resolutionGeometryVerdict({
    targetParticipantDistances: [[30, 25, 20]],
    participantPairDistances: [5, 10, 10],
    geometry: { pairwiseWithin: 10 },
  }).valid, true);
});
