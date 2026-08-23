import test from "node:test";
import assert from "node:assert/strict";
import { bannerToggle, setBannerActive } from "../scripts/foundry/runtime.js";

function fakeCommander() {
  const calls = [];
  return {
    calls,
    items: [{
      id: "banner-item",
      system: {
        rules: [
          { key: "Aura", slug: "commanders-banner" },
          { key: "RollOption", domain: "all", option: "commanders-banner", toggleable: true },
        ],
      },
    }],
    async toggleRollOption(...args) {
      calls.push(args);
      return true;
    },
  };
}

test("Commander banner toggle discovers PF2e native RollOption", () => {
  const actor = fakeCommander();
  assert.deepEqual(bannerToggle(actor), {
    domain: "all",
    option: "commanders-banner",
    itemId: "banner-item",
  });
});

test("Deploy banner uses PF2e actor toggleRollOption API", async () => {
  const actor = fakeCommander();
  await setBannerActive(actor, true);
  assert.deepEqual(actor.calls, [["all", "commanders-banner", "banner-item", true]]);
});
