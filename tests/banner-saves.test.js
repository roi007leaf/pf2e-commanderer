import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { BANNER_SAVE_RULE, bannerSaveItemSource, ensureBannerSaves, registerBannerSaveRule, upgradeBannerSaves } from "../scripts/foundry/banner-saves.js";
import { bannerObjectSource } from "../scripts/foundry/banner-object.js";

const scope = "pf2e-commanderer";

test("upgrade preserves damaged HP, custom saves, unrelated items and actor identity; runs once", async () => {
  const items = [{ id: "custom", system: { rules: [] }, getFlag: () => false }];
  let creates = 0, updates = 0;
  const source = { attributes: { hp: { value: 3, max: 12 } }, saves: { fortitude: { value: null }, reflex: { value: 7 }, will: { value: null } } };
  const actor = { id: "original", type: "hazard", _source: { system: source }, items,
    getFlag: () => ({ commanderUuid: "Actor.c" }),
    createEmbeddedDocuments: async (_type, [data]) => {
      creates++;
      items.push({ ...data, getFlag: () => true, update: () => assert.fail("unchanged rules must not be rewritten") });
    },
    update: async (changes) => {
      updates++;
      assert.deepEqual(changes, { "system.saves.fortitude.value": 0, "system.saves.will.value": 0 });
      source.saves.fortitude.value = source.saves.will.value = 0;
    } };
  await ensureBannerSaves(actor);
  await ensureBannerSaves(actor);
  assert.equal(creates, 1);
  assert.equal(updates, 1);
  assert.equal(actor.id, "original");
  assert.equal(source.attributes.hp.value, 3);
  assert.equal(source.saves.reflex.value, 7);
  assert.equal(items[0].id, "custom");
  assert.equal(await ensureBannerSaves({ type: "hazard", getFlag: () => null }), false);
});

test("only active GM upgrades persisted banners", async () => {
  let visits = 0;
  const actor = { get type() { visits++; return "npc"; } };
  globalThis.game = { user: { id: "player", isGM: false }, users: { activeGM: { id: "gm" } }, actors: [actor] };
  await upgradeBannerSaves();
  game.user = { id: "other-gm", isGM: true };
  await upgradeBannerSaves();
  assert.equal(visits, 0);
  game.user.id = "gm";
  await upgradeBannerSaves();
  assert.equal(visits, 1);
});

test("native PF2e hazard save preparation and degree adjustment work for every d20 result", async (t) => {
  // Run the installed system's real preparation/adjustment code. CI without
  // Foundry can still run the migration tests above; this integration is local.
  const path = new URL("../../../systems/pf2e/pf2e.mjs", import.meta.url);
  const text = await readFile(path, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!text) return t.skip("Installed PF2e required for native save integration");
  const ruleStart = text.indexOf("AdjustDegreeOfSuccessRuleElement = class");
  const ruleEnd = text.indexOf("\n}, mc =", ruleStart);
  const degreeStart = text.indexOf("class DegreeOfSuccess {");
  const degreeEnd = text.indexOf("\n}, Bt =", degreeStart);
  const hazardStart = text.indexOf("HazardPF2e = class");
  const savesStart = text.indexOf("\tprepareSaves() {", hazardStart);
  const savesEnd = text.indexOf("\n\t}", savesStart) + 3;
  assert.ok(ruleStart >= 0 && ruleEnd > ruleStart && degreeStart >= 0 && degreeEnd > degreeStart && savesStart > hazardStart);
  const context = vm.createContext({
    RuleElement: class {
      constructor(data, { actor }) {
        Object.assign(this, data, { actor, label: "Banner object saves", predicate: [] });
        this.ignored = !this.constructor.validActorTypes.includes(actor.type);
      }
      resolveInjectedProperties(value) { return value; }
    },
    Roll: class {}, sluggify: (value) => value, _loc: (value) => value,
    Ht: ["criticalFailure", "failure", "success", "criticalSuccess"],
    Bt: { LOWER_BY_TWO: -2, LOWER: -1, INCREASE: 1, INCREASE_BY_TWO: 2,
      TO_CRITICAL_FAILURE: "criticalFailure", TO_FAILURE: "failure", TO_SUCCESS: "success", TO_CRITICAL_SUCCESS: "criticalSuccess" },
    Rr: ["fortitude", "reflex", "will"],
    CONFIG: { PF2E: { saves: {}, savingThrowDefaultAttributes: {} } },
    foundry: { utils: { mergeObject: (original, changes) => Object.assign(original, changes) } },
    q: class { constructor(data) { Object.assign(this, data); } },
    Wi: class { constructor(actor, data) { this.actor = actor; this.data = data; } getTraceData() { return {}; } },
  });
  vm.runInContext("Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value))", context);
  const NativeAdjustment = vm.runInContext(`(${text.slice(ruleStart + "AdjustDegreeOfSuccessRuleElement = ".length, ruleEnd + 2)})`, context);
  const DegreeOfSuccess = vm.runInContext(`(${text.slice(degreeStart, degreeEnd + 2)})`, context);
  const prepareSaves = vm.runInContext(`({${text.slice(savesStart, savesEnd)}}).prepareSaves`, context);
  const registry = { builtin: { AdjustDegreeOfSuccess: NativeAdjustment }, custom: {} };
  globalThis.game = { pf2e: { RuleElements: registry } };
  registerBannerSaveRule();
  assert.deepEqual(Array.from(NativeAdjustment.validActorTypes), ["character", "npc"], "built-in whitelist untouched");
  const source = bannerObjectSource({ name: "Commander", uuid: "Actor.c" }, { ac: 10, hp: 12, hardness: 3, bonus: 8 });
  const actor = { type: source.type, system: source.system,
    getFlag: () => source.flags[scope].bannerObject,
    synthetics: { degreeOfSuccessAdjustments: {} } };
  const oldActor = { system: { saves: Object.fromEntries(["fortitude", "reflex", "will"].map((slug) => [slug, { value: null }])) } };
  assert.equal(Object.keys(prepareSaves.call(oldActor)).length, 0, "reproduce N/A omission in native hazard code");
  assert.equal(Object.keys(prepareSaves.call(actor)).length, 3, "all saves now exist for automation");
  const NativeRule = registry.custom[BANNER_SAVE_RULE];
  for (const ruleSource of bannerSaveItemSource().system.rules) {
    new NativeRule(ruleSource, { actor }).beforePrepareData();
    const [adjustment] = actor.synthetics.degreeOfSuccessAdjustments[ruleSource.selector];
    for (let dieValue = 1; dieValue <= 20; dieValue++) {
      for (const modifier of [-100, 0, 100]) {
        const result = new DegreeOfSuccess({ dieValue, modifier }, 15, adjustment.adjustments);
        assert.equal(result.value, 1, `${ruleSource.selector}: d20=${dieValue}, modifier=${modifier}`);
      }
    }
  }
  actor.getFlag = () => null;
  actor.synthetics.degreeOfSuccessAdjustments = {};
  new NativeRule(bannerSaveItemSource().system.rules[0], { actor }).beforePrepareData();
  assert.equal(Object.keys(actor.synthetics.degreeOfSuccessAdjustments).length, 0, "ordinary hazards unaffected");
});
