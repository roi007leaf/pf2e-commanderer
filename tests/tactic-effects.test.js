import test from "node:test";
import assert from "node:assert/strict";
import { pincerAttackRules } from "../scripts/foundry/effects.js";

test("Pincer Attack only lowers AC against responder melee attacks", () => {
  const [rule] = pincerAttackRules(["commander-signature", "ally-signature", "ally-signature"]);
  assert.equal(rule.selector, "ac");
  assert.equal(rule.value, -2);
  assert.deepEqual(rule.predicate, [
    "item:melee",
    { or: ["origin:signature:commander-signature", "origin:signature:ally-signature"] },
  ]);
});
