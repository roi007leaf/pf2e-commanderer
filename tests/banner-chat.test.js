import test from "node:test";
import assert from "node:assert/strict";

test("banner Chat posts native rules without triggering item-use summon listeners", async () => {
  const previous = { foundry: globalThis.foundry, ChatMessage: globalThis.ChatMessage };
  globalThis.foundry = { applications: { api: { ApplicationV2: class {} } } };
  const { CommanderPanel } = await import("../scripts/ui/panel.js");
  let summons = 0;
  let posted;
  const source = { content: '<div class="pf2e chat-card">Plant Banner rules</div>',
    speaker: { actor: "commander" }, whisper: ["gm"], blind: true,
    flags: { pf2e: { origin: { uuid: "Actor.commander.Item.plant" } } } };
  globalThis.ChatMessage = { create: async (data) => {
    posted = data;
    // PF2e resolves message.item from flags.pf2e.origin.uuid. Summons
    // Assistant's createChatMessage listener dispatches on that item's source.
    if (data.flags?.pf2e?.origin?.uuid) summons++;
    return data;
  } };
  const item = { slug: "plant-banner", uuid: "Actor.commander.Item.plant",
    toMessage: async (_event, options) => options?.create === false
      ? { toObject: () => structuredClone(source) }
      : ChatMessage.create(source) };
  try {
    await CommanderPanel.bannerToChat.call({ actor: { items: [item] } });
    assert.equal(summons, 0, "sending rules must not start a second banner placement");
    assert.equal(posted.content, source.content);
    assert.deepEqual(posted.speaker, source.speaker);
    assert.deepEqual(posted.whisper, ["gm"]);
    assert.equal(posted.blind, true);
  } finally { Object.assign(globalThis, previous); }
});
