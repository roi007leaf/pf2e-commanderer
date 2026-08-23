import test from "node:test";
import assert from "node:assert/strict";
import { invocationViewModel } from "../scripts/ui/invocation-view-model.js";

test("invocation view model summarizes response progress and presentation metadata", () => {
  const view = invocationViewModel({
    signal: "visual",
    response: { reaction: true },
    resolution: { save: "reflex" },
    participants: [
      { name: "Pending", status: "pending" },
      { name: "Ready", status: "responded", result: "repositioned" },
      { name: "No", status: "declined" },
    ],
  });

  assert.equal(view.signalLabel, "Visual signal");
  assert.equal(view.cardVersion, 4);
  assert.equal(view.responseTypeLabel, "Reaction");
  assert.equal(view.participantCount, 3);
  assert.equal(view.answeredCount, 2);
  assert.equal(view.pendingCount, 1);
  assert.equal(view.allAnswered, false);
  assert.equal(view.hasResolution, true);
  assert.deepEqual(view.participants.map((participant) => participant.statusLabel), ["Awaiting response", "Completed", "Declined"]);
});

test("invocation view model normalizes unknown status and detects completion", () => {
  const view = invocationViewModel({
    response: {},
    participants: [{ status: "responded" }, { status: "declined" }],
  });

  assert.equal(view.signalLabel, "Tactical signal");
  assert.equal(view.responseTypeLabel, "Response");
  assert.equal(view.pendingCount, 0);
  assert.equal(view.allAnswered, true);
});

test("invocation view model exposes assigned roles and hides completed resolution", () => {
  const view = invocationViewModel({
    response: {},
    resolution: { maxTargets: 1 },
    resolutionResults: [{ name: "Target" }],
    participants: [{ status: "pending", role: "spell" }],
  });
  assert.equal(view.participants[0].roleLabel, "Spell follow-up");
  assert.equal(view.hasResolution, false);
});

test("invocation view model identifies manual responses and visible overrides", () => {
  const view = invocationViewModel({
    response: {},
    resolution: { maxTargets: 2 },
    resolutionOverride: { mode: "geometry", userName: "Game Master" },
    participants: [{ status: "responded", manual: true }],
  });

  assert.equal(view.participants[0].statusLabel, "Completed manually");
  assert.equal(view.resolutionOverrideLabel, "Game Master overrode formation and distance checks.");
});
