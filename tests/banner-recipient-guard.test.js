import test from "node:test";
import assert from "node:assert/strict";
import { bannerRecipientAllowed, registerBannerRecipientGuard } from "../scripts/foundry/banner-recipient-guard.js";

test("registration vetoes enemy creation and cleans only identifiable invalid banner effects", () => {
  const previous = { game: globalThis.game, Hooks: globalThis.Hooks, fromUuidSync: globalThis.fromUuidSync };
  const handlers = new Map();
  const deleted = [];
  const actor = { uuid: "Actor.enemy", alliance: "opposition", items: [],
    deleteEmbeddedDocuments: async (_type, ids) => { deleted.push(...ids); } };
  const range = { id: "range", sourceId: "Compendium.pf2e-summons-assistant.pf2e-summons-assistant-items.Item.vnFV2b3aYdvGeVkM",
    flags: { pf2e: { aura: { origin: "Actor.commander" } } } };
  const temp = { id: "bad-temp", actor,
    sourceId: "Compendium.pf2e-summons-assistant.pf2e-summons-assistant-items.Item.uxS1nDflB45y3PPl" };
  actor.items = [range, temp, { id: "other-temp", sourceId: "unrelated" }];
  globalThis.game = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } }, actors: [actor] };
  globalThis.Hooks = { on: (name, handler) => handlers.set(name, handler) };
  globalThis.fromUuidSync = () => ({ uuid: "Actor.commander", alliance: "party" });
  try {
    registerBannerRecipientGuard();
    assert.deepEqual(deleted, ["bad-temp"]);
    assert.equal(handlers.get("preCreateItem")(temp), false);
    assert.equal(handlers.get("preCreateItem")({ actor, sourceId: "unrelated" }), undefined);
  } finally { Object.assign(globalThis, previous); }
});

test("Summons Assistant banner excludes opposition on initial range entry and temp-HP renewal", () => {
  const previous = globalThis.fromUuidSync;
  const commander = { uuid: "Actor.commander", alliance: "party" };
  const banner = { getFlag: () => ({ uuid: commander.uuid }) };
  globalThis.fromUuidSync = (uuid) => uuid === commander.uuid ? commander : banner;
  const range = { sourceId: "Compendium.pf2e-summons-assistant.pf2e-summons-assistant-items.Item.vnFV2b3aYdvGeVkM",
    flags: { pf2e: { aura: { origin: "Actor.banner" } } } };
  const temp = { sourceId: "Compendium.pf2e-summons-assistant.pf2e-summons-assistant-items.Item.uxS1nDflB45y3PPl" };
  try {
    for (const alliance of ["opposition", null, "party"]) {
      const actor = { uuid: "Actor.recipient", alliance, items: [range] };
      assert.equal(bannerRecipientAllowed({ ...range, parent: actor }), alliance === "party");
      assert.equal(bannerRecipientAllowed({ ...temp, parent: actor }), alliance === "party");
    }
    assert.equal(bannerRecipientAllowed({ ...range, parent: commander }), false);
    assert.equal(bannerRecipientAllowed({ ...temp, parent: { items: [] } }), true, "manual unknown-origin effects remain untouched");
    assert.equal(bannerRecipientAllowed({ sourceId: "unrelated", parent: { alliance: "opposition" } }), true);
  } finally { globalThis.fromUuidSync = previous; }
});
