import test from "node:test";
import assert from "node:assert/strict";
import { featChatActions } from "../scripts/ui/feat-chat.js";

function post(slug, workflow) {
  const item = { id: "feat", uuid: "Actor.a.Item.feat", slug, name: slug, getFlag: () => workflow };
  const actor = { items: new Map([[item.id, item]]), testUserPermission: (user) => user.id === "owner" };
  return { actor, item, flags: {}, rolls: [] };
}
const owner = { id: "owner" };

test("owned feat posts expose direct actions and their guided follow-ups", () => {
  assert.deepEqual(featChatActions(post("guiding-shot"), owner).map(a => a.id), ["feat", "opening"]);
  assert.deepEqual(featChatActions(post("banner-twirl"), owner).map(a => a.id), ["feat", "twirl-check"]);
  assert.deepEqual(featChatActions(post("piranha-assault"), owner).map(a => a.id), ["piranha"]);
  assert.deepEqual(featChatActions(post("naval-training"), owner).map(a => a.id), ["training"]);
  assert.deepEqual(featChatActions(post("effect", { mercenary: true }), owner).map(a => a.id), ["mercenary-save"]);
});

test("passive feats, roll messages, nonowners, and removed items have no buttons", () => {
  assert.deepEqual(featChatActions(post("drilled-reflexes"), owner), []);
  const message = post("banner-twirl");
  assert.deepEqual(featChatActions(message, { id: "other" }), []);
  assert.equal(featChatActions(message, { isGM: true }).length, 2);
  message.rolls = [{}];
  assert.deepEqual(featChatActions(message, owner), []);
  message.rolls = [];
  message.flags.pf2e = { context: { type: "attack-roll" } };
  assert.deepEqual(featChatActions(message, owner), []);
  message.flags = {};
  message.actor.items.clear();
  assert.deepEqual(featChatActions(message, owner), []);
  delete message.actor;
  assert.deepEqual(featChatActions(message, owner), []);
});
