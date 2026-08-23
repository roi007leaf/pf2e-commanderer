import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  bannerRecoveryCheckChoices,
  bannerRecoveryDcChoices,
  bannerRecoveryRuling,
  recoverCarriedBanner,
  ROLL_BANNER_RECOVERY_OPERATION,
  RESOLVE_BANNER_RECOVERY_OPERATION,
  rollBannerRecovery,
  RULE_BANNER_RECOVERY_OPERATION,
  bannerRecoveryRollerChoices,
} from "../scripts/foundry/banner-recovery.js";

function statistic(slug, label, modifier = 0, dc = null) {
  return {
    slug,
    label,
    mod: modifier,
    dc: dc == null ? undefined : { value: dc },
    async roll() {},
  };
}

test("GM recovery controls expose Commander checks and carrier defenses", () => {
  const athletics = statistic("athletics", "Athletics", 12);
  const thievery = statistic("thievery", "Thievery", 8);
  const perception = statistic("perception", "Perception", 10);
  const commander = {
    skills: { athletics, thievery },
    perception,
    getStatistic: (slug) => ({ athletics, thievery, perception }[slug] ?? null),
  };
  const defenses = {
    reflex: statistic("reflex", "Reflex", 0, 23),
    fortitude: statistic("fortitude", "Fortitude", 0, 25),
    will: statistic("will", "Will", 0, 21),
    perception: statistic("perception", "Perception", 0, 22),
    ac: statistic("ac", "Armor Class", 0, 24),
  };
  const carrier = { getStatistic: (slug) => defenses[slug] ?? null };

  assert.deepEqual(bannerRecoveryCheckChoices(commander).map(({ slug }) => slug), [
    "athletics",
    "perception",
    "thievery",
  ]);
  assert.deepEqual(bannerRecoveryDcChoices(carrier), [
    { slug: "reflex", label: "Reflex DC", value: 23 },
    { slug: "fortitude", label: "Fortitude DC", value: 25 },
    { slug: "will", label: "Will DC", value: 21 },
    { slug: "perception", label: "Perception DC", value: 22 },
    { slug: "ac", label: "Armor Class", value: 24 },
  ]);
});

test("active non-GM Commander owner is default recovery roller", () => {
  const previousGame = globalThis.game;
  const gm = { id: "gm", name: "GM", active: true, isGM: true };
  const owner = { id: "owner", name: "Ulka Player", active: true, isGM: false };
  const spectator = { id: "spectator", name: "Spectator", active: true, isGM: false };
  const commander = { testUserPermission: (user, level) => user.id === owner.id && level === "OWNER" };
  globalThis.game = { users: { contents: [gm, owner, spectator], activeGM: gm } };
  try {
    assert.deepEqual(bannerRecoveryRollerChoices(commander, gm.id), {
      choices: [
        { id: owner.id, name: owner.name, isGM: false },
        { id: gm.id, name: gm.name, isGM: true },
      ],
      defaultUserId: owner.id,
    });
  } finally {
    globalThis.game = previousGame;
  }
});

test("Commander owner rolls GM-selected statistic and DC", async () => {
  let options;
  const athletics = statistic("athletics", "Athletics", 14);
  athletics.roll = async (passed) => {
    options = passed;
    return { degreeOfSuccess: 2 };
  };
  const commander = {
    name: "Ulka",
    skills: { athletics },
    getStatistic: (slug) => slug === "athletics" ? athletics : null,
  };
  const carrierActor = { name: "Banner Thief" };
  const result = await rollBannerRecovery(commander, { actor: carrierActor }, {
    action: "Disarm",
    actionSlug: "disarm",
    statistic: "athletics",
    statisticLabel: "Athletics",
    dc: 24,
    dcSlug: "reflex",
  });

  assert.equal(result.success, true);
  assert.equal(result.degreeOfSuccess, 2);
  assert.deepEqual(options.dc, { value: 24, slug: "reflex" });
  assert.equal(options.target, carrierActor);
  assert.equal(options.action, "Disarm");
  assert.equal(options.title, "Disarm: Retrieve Banner");
  assert.ok(options.extraRollOptions.includes("action:retrieve-banner"));
  assert.ok(options.extraRollOptions.includes("action:disarm"));
});

test("GM ruling presets and custom selection resolve to explicit PF2e checks", () => {
  const checks = [
    { slug: "athletics", label: "Athletics" },
    { slug: "thievery", label: "Thievery" },
  ];
  const dcs = [
    { slug: "reflex", label: "Reflex DC", value: 23 },
    { slug: "fortitude", label: "Fortitude DC", value: 25 },
  ];

  assert.deepEqual(bannerRecoveryRuling({ method: "disarm", customDc: 30 }, checks, dcs), {
    mode: "roll",
    action: "Disarm",
    actionSlug: "disarm",
    statistic: "athletics",
    statisticLabel: "Athletics",
    dc: 23,
    dcSlug: "reflex",
    dcLabel: "Reflex DC",
  });
  assert.deepEqual(bannerRecoveryRuling({
    method: "custom",
    statistic: "thievery",
    dcSource: "custom",
    customDc: 27,
  }, checks, dcs), {
    mode: "roll",
    action: "GM ruling",
    actionSlug: "retrieve-banner",
    statistic: "thievery",
    statisticLabel: "Thievery",
    dc: 27,
    dcSlug: null,
    dcLabel: "DC 27",
  });
});

test("GM-started recovery sends the check to the selected Commander owner", async () => {
  const previousCanvas = globalThis.canvas;
  const previousGame = globalThis.game;
  const previousUi = globalThis.ui;
  const commander = {
    id: "commander",
    uuid: "Actor.commander",
    name: "Ulka",
  };
  const carrierActor = { id: "enemy", uuid: "Actor.enemy", name: "Banner Thief" };
  const commanderToken = {
    actor: commander,
    document: { uuid: "Scene.scene.Token.commander" },
    mechanicalBounds: { x: 0, y: 0, width: 100, height: 100 },
  };
  const carrierToken = {
    actor: carrierActor,
    document: { uuid: "Scene.scene.Token.carrier", mechanicalBounds: { x: 100, y: 0, width: 100, height: 100 } },
  };
  const placement = {
    actorId: commander.id,
    actorUuid: commander.uuid,
    tokenUuid: commanderToken.document.uuid,
    removed: true,
    removalMode: "carried",
    carrierTokenUuid: carrierToken.document.uuid,
    removedBy: { actorName: carrierActor.name },
  };
  const documents = new Map([
    ["commander", { ...commanderToken.document, object: commanderToken }],
    ["carrier", { ...carrierToken.document, object: carrierToken }],
  ]);
  const scene = {
    id: "scene",
    grid: { distance: 5 },
    tokens: { get: (id) => documents.get(id) },
    getFlag: () => ({ [commander.id]: placement }),
  };
  const requests = [];
  let rolled = false;
  const request = async (operation, payload, options) => {
    requests.push({ operation, payload, options });
    if (operation === RULE_BANNER_RECOVERY_OPERATION) {
      return {
        mode: "roll",
        rulingId: "ruling-id",
        action: "Grapple",
        statistic: "athletics",
        dc: 25,
        rollerUserId: "player",
      };
    }
    if (operation === ROLL_BANNER_RECOVERY_OPERATION) return { degreeOfSuccess: 3, success: true };
    return { retrieved: true, degreeOfSuccess: payload.degreeOfSuccess };
  };
  const roll = async (_commander, carrier, ruling) => {
    rolled = true;
    assert.equal(carrier.actor, carrierActor);
    assert.equal(ruling.action, "Grapple");
    return { degreeOfSuccess: 3, success: true };
  };

  globalThis.canvas = { scene, grid: { size: 100 }, dimensions: { size: 100, distance: 5 } };
  globalThis.game = {
    user: { id: "gm", isGM: true },
    users: { activeGM: { id: "gm", isGM: true, active: true } },
  };
  globalThis.ui = { notifications: { info() {}, warn() {} } };
  try {
    assert.equal(await recoverCarriedBanner(commander, scene, { request, roll }), true);
    assert.equal(rolled, false, "GM client must not roll for another active owner");
    assert.equal(requests.length, 3);
    assert.equal(requests[0].operation, RULE_BANNER_RECOVERY_OPERATION);
    assert.equal(requests[0].options.gmRequired, true);
    assert.equal(requests[0].options.timeoutMs, 120_000);
    assert.equal(requests[1].operation, ROLL_BANNER_RECOVERY_OPERATION);
    assert.equal(requests[1].options.authorityUserId, "player");
    assert.equal(requests[1].options.directed, true);
    assert.equal(requests[2].operation, RESOLVE_BANNER_RECOVERY_OPERATION);
    assert.equal(requests[2].payload.degreeOfSuccess, 3);
  } finally {
    globalThis.canvas = previousCanvas;
    globalThis.game = previousGame;
    globalThis.ui = previousUi;
  }
});

test("recovery workflow keeps explicit GM manual override", async () => {
  const source = await readFile(new URL("../scripts/foundry/banner-recovery.js", import.meta.url), "utf8");
  const template = await readFile(new URL("../templates/panel.hbs", import.meta.url), "utf8");
  const css = await readFile(new URL("../styles/commanderer.css", import.meta.url), "utf8");

  assert.match(source, /Retrieve Manually/);
  assert.match(source, /Request Commander Roll/);
  assert.match(source, /Disarm/);
  assert.match(source, /Grapple/);
  assert.match(template, /Ask the GM to rule a recovery check/);
  assert.match(css, /commanderer-recovery-approaches/);
});
