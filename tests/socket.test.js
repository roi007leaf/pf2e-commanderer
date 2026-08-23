import test from "node:test";
import assert from "node:assert/strict";

import { requestOperation } from "../scripts/foundry/socket.js";

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
      /request timed out/
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
      /request timed out/
    );
    assert.equal(emitted.authorityUserId, "player");
    assert.equal(emitted.directed, true);
  } finally {
    globalThis.game = previousGame;
    globalThis.foundry = previousFoundry;
  }
});
