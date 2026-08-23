import test from "node:test";
import assert from "node:assert/strict";
import { rankSquadCandidates, tacticAudience, tacticDependsOnBannerAura } from "../scripts/domain/squad-readiness.js";

const members = [
  { commander: true, inBannerAura: true },
  { name: "Near", inBannerAura: true },
  { name: "Far", inBannerAura: false },
];

test("aura tactics expose only drilled squadmates currently in aura", () => {
  const audience = tacticAudience({ selection: "one", aura: true, response: {} }, members);

  assert.equal(audience.selectionLabel, "Choose 1 squadmate");
  assert.equal(audience.reachLabel, "Inside banner aura");
  assert.equal(audience.readyLabel, "2 ready");
  assert.equal(audience.readyDetail, "2 of 3 in aura");
  assert.equal(audience.eligibleCount, 2);
});

test("Gather to Me includes every drilled squadmate and treats aura as destination", () => {
  const audience = tacticAudience({
    selection: "all",
    response: { kind: "gather-to-me" },
  }, members);

  assert.equal(audience.selectionLabel, "All eligible squadmates");
  assert.equal(audience.reachLabel, "Anywhere → banner aura");
  assert.equal(audience.readyDetail, "3 of 3 on scene");
  assert.equal(audience.eligibleCount, 3);
  assert.equal(audience.gather, true);
});

test("off-scene squadmates remain drilled but are not ready responders", () => {
  const audience = tacticAudience({ selection: "all", response: {} }, [
    ...members,
    { name: "Remote", onScene: false, inBannerAura: false },
  ]);

  assert.equal(audience.trainedCount, 4);
  assert.equal(audience.onSceneCount, 3);
  assert.equal(audience.eligibleCount, 3);
  assert.equal(audience.readyDetail, "3 of 4 on scene");
});

test("audience reports unavailable when no squadmate meets tactic reach", () => {
  const audience = tacticAudience({ selection: "all", aura: true, response: {} }, [
    { inBannerAura: false },
  ]);

  assert.equal(audience.tone, "unavailable");
  assert.equal(audience.readyLabel, "0 ready");
});

test("banner-dependent tactics report unavailable while aura is inactive", () => {
  const audience = tacticAudience({
    selection: "all",
    response: { kind: "gather-to-me" },
  }, members, { bannerActive: false });

  assert.equal(audience.reachLabel, "Banner aura inactive");
  assert.equal(audience.readyDetail, "Display banner first");
  assert.equal(audience.eligibleCount, 0);
  assert.equal(tacticDependsOnBannerAura({ response: { kind: "gather-to-me" } }), true);
  assert.equal(tacticDependsOnBannerAura({ aura: true, response: {} }), true);
  assert.equal(tacticDependsOnBannerAura({ response: {} }), false);
});

test("tactic-specific capability filters remove ineligible responders", () => {
  const audience = tacticAudience({ selection: "all", aura: true, requirement: "piercing-slashing-melee", response: {} }, [
    { name: "Sword", inBannerAura: true, capabilities: { "piercing-slashing-melee": true } },
    { name: "Bow", inBannerAura: true, capabilities: { "piercing-slashing-melee": false } },
  ]);
  assert.equal(audience.eligibleCount, 1);
  assert.equal(audience.readyLabel, "1 ready");
});

test("squad candidates prioritize current roster, targets, aura, and nearest token", () => {
  const candidates = rankSquadCandidates([
    { actorUuid: "far", name: "Far", distance: 40 },
    { actorUuid: "duplicate", name: "Duplicate Far", distance: 25, inBannerAura: true },
    { actorUuid: "target", name: "Target", distance: 40, targeted: true },
    { actorUuid: "duplicate", name: "Duplicate Near", distance: 5, inBannerAura: true },
    { actorUuid: "current", name: "Current", distance: 50, current: true },
  ]);

  assert.deepEqual(candidates.map((candidate) => candidate.actorUuid), ["current", "target", "duplicate", "far"]);
  assert.equal(candidates[2].name, "Duplicate Near");
});
