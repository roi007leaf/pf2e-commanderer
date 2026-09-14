import test from "node:test";
import assert from "node:assert/strict";

import { registerOperation, requestOperation } from "../scripts/foundry/socket.js";
import { requestCommanderWorkflow } from "../scripts/foundry/feats.js";

test("a second GM keeps interactive feat dialogs on their own client", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  let calls = 0;
  globalThis.game = {
    user: { id: "second-gm", isGM: true, targets: new Set() },
    users: { activeGM: { id: "first-gm", isGM: true } },
    socket: { emit: () => assert.fail("interactive workflow sent to another GM") },
  };
  globalThis.foundry = { utils: { randomID: () => "local-gm" } };
  registerOperation("commander-feat", async (payload, userId) => {
    calls++;
    assert.equal(userId, "second-gm");
    assert.equal(payload.itemId, "feat");
    return true;
  });
  try {
    assert.equal(await requestCommanderWorkflow({ uuid: "Actor.commander" }, "feat"), true);
    assert.equal(calls, 1);
  } finally { globalThis.game = previousGame; globalThis.foundry = previousFoundry; }
});

test("authority reports an unavailable operation instead of silently timing out", async () => {
  const previousGame = globalThis.game;
  let listener;
  let response;
  const gm = { id: "gm", isGM: true, active: true };
  globalThis.game = {
    user: gm,
    users: { activeGM: gm },
    socket: {
      on: (_channel, callback) => { listener = callback; },
      emit: (_channel, packet) => { response = packet; },
    },
  };
  try {
    const { registerSocket } = await import("../scripts/foundry/socket.js");
    registerSocket();
    await listener({
      type: "request",
      requestId: "missing-handler",
      operation: "newer-client-operation",
      payload: {},
      authorityUserId: "player",
      gmRequired: true,
      directed: false,
      userId: "player",
    });
    assert.equal(response?.type, "response");
    assert.equal(response?.ok, false);
    assert.match(response?.error, /reload|update/i);
  } finally {
    globalThis.game = previousGame;
  }
});

test("interactive GM operations can extend the socket timeout", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  globalThis.game = {
    user: { id: "player" },
    users: { activeGM: { id: "gm", isGM: true, active: true } },
    socket: { emit() {} },
  };
  globalThis.foundry = { utils: { randomID: () => "interactive-request" } };
  try {
    await assert.rejects(
      () => requestOperation("interactive", {}, { gmRequired: true, timeoutMs: 5 }),
      /Active GM did not answer/
    );
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});

test("GM-required operation fails immediately when no GM is active", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  globalThis.game = {
    user: { id: "player" },
    users: { activeGM: null, find: () => null },
    socket: { emit() {} },
  };
  globalThis.foundry = { utils: { randomID: () => "no-gm-request" } };
  try {
    await assert.rejects(
      () => requestOperation("gm-operation", {}, { gmRequired: true }),
      /active GM.*required/i
    );
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});

test("directed operation bypasses active-GM authority and reaches selected player", async () => {
  const previousGame = globalThis.game;
  const previousFoundry = globalThis.foundry;
  let emitted;
  globalThis.game = {
    user: { id: "gm" },
    users: { activeGM: { id: "gm", isGM: true, active: true } },
    socket: { emit: (_channel, packet) => { emitted = packet; } },
  };
  globalThis.foundry = { utils: { randomID: () => "directed-request" } };
  try {
    await assert.rejects(
      () => requestOperation("player-roll", {}, {
        authorityUserId: "player",
        directed: true,
        timeoutMs: 5,
      }),
      /authority client did not answer/
    );
    assert.equal(emitted.authorityUserId, "player");
    assert.equal(emitted.directed, true);
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});
