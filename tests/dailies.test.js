import test from "node:test";
import assert from "node:assert/strict";

import { preparedTacticIds, togglePreparedTactic } from "../scripts/foundry/runtime.js";

test("PF2e Dailies preparation reads the world actor behind a synthetic token actor", () => {
  const selected = ["coordinating-maneuvers-id", "gather-to-me-id", "strike-hard-id"];
  const baseActor = { uuid: "Actor.commander" };
  const syntheticActor = {
    uuid: "Scene.scene.Token.token.Actor.commander",
    token: { baseActor },
    getFlag: () => ["protective-screen-id", "gather-to-me-id", "strike-hard-id"],
  };
  let requestedActor = null;
  const previousGame = globalThis.game;
  globalThis.game = {
    modules: new Map([["pf2e-dailies", {
      active: true,
      api: {
        getCommanderTactics(actor) {
          requestedActor = actor;
          return actor === baseActor ? selected : syntheticActor.getFlag();
        },
      },
    }]]),
  };

  try {
    assert.deepEqual([...preparedTacticIds(syntheticActor)], selected);
    assert.equal(requestedActor, baseActor);
  } finally {
    globalThis.game = previousGame;
  }
});

test("PF2e Dailies preparation reads commander tactic ability flags", () => {
  const selected = ["coordinating-maneuvers-id", "gather-to-me-id", "strike-hard-id"];
  const baseActor = {
    uuid: "Actor.commander",
    getFlag(scope, key) {
      if (scope !== "pf2e-dailies" || key !== "dailies.commander-tactics") return undefined;
      return {
        ability1: selected[0],
        ability2: selected[1],
        ability3: selected[2],
      };
    },
  };
  const syntheticActor = {
    uuid: "Scene.scene.Token.token.Actor.commander",
    token: { baseActor },
    getFlag: () => ["protective-screen-id", "gather-to-me-id", "strike-hard-id"],
  };
  const previousGame = globalThis.game;
  globalThis.game = {
    modules: new Map([["pf2e-dailies", { active: true, api: {} }]]),
  };

  try {
    assert.deepEqual([...preparedTacticIds(syntheticActor)], selected);
  } finally {
    globalThis.game = previousGame;
  }
});

test("active PF2e Dailies does not reuse stale Commanderer preparation", () => {
  const baseActor = {
    uuid: "Actor.commander",
    getFlag: () => undefined,
  };
  const syntheticActor = {
    token: { baseActor },
    getFlag: () => ["stale-commanderer-tactic"],
  };
  const previousGame = globalThis.game;
  globalThis.game = {
    modules: new Map([["pf2e-dailies", { active: true, api: {} }]]),
  };

  try {
    assert.deepEqual([...preparedTacticIds(syntheticActor)], []);
  } finally {
    globalThis.game = previousGame;
  }
});

test("manual preparation updates PF2e Dailies commander tactic slots", async () => {
  const selections = {
    ability1: "coordinating-maneuvers-id",
    ability2: "gather-to-me-id",
  };
  let update = null;
  const baseActor = {
    uuid: "Actor.commander",
    class: { slug: "commander" },
    getFlag: () => selections,
    async setFlag(scope, key, value) {
      update = { scope, key, value };
    },
  };
  const syntheticActor = {
    token: { baseActor },
    getFlag: () => ["stale-commanderer-tactic"],
  };
  const previousGame = globalThis.game;
  globalThis.game = {
    modules: new Map([["pf2e-dailies", { active: true, api: {} }]]),
  };

  try {
    assert.equal(await togglePreparedTactic(syntheticActor, "protective-screen-id"), true);
    assert.deepEqual(update, {
      scope: "pf2e-dailies",
      key: "dailies.commander-tactics",
      value: {
        ability1: "coordinating-maneuvers-id",
        ability2: "gather-to-me-id",
        ability3: "protective-screen-id",
      },
    });
  } finally {
    globalThis.game = previousGame;
  }
});
