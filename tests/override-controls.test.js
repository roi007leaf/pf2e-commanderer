import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const template = await readFile(new URL("../templates/invocation.hbs", import.meta.url), "utf8");
const engine = await readFile(new URL("../scripts/engine.js", import.meta.url), "utf8");
const effects = await readFile(new URL("../scripts/foundry/effects.js", import.meta.url), "utf8");

test("chat card exposes participant and resolution escape hatches", () => {
  assert.match(template, /data-commanderer-action="manual-response"/);
  assert.match(template, /data-commanderer-action="manual-resolve"/);
  assert.match(template, /data-commanderer-action="force-resolve"[^>]*hidden/);
});

test("manual completion reserves the normal round response and skips automation", () => {
  assert.match(engine, /manual: action === "manual-response"/);
  assert.match(engine, /result = "completed manually; automation skipped"/);
  assert.match(engine, /setFlag\(FLAG_SCOPE, "lastResponseRound"/);
});

test("forced resolution is GM-only and bypasses geometry without bypassing target rules", () => {
  assert.match(engine, /if \(ignoreGeometry && !user\?\.isGM\)/);
  assert.match(effects, /minParticipants: ignoreGeometry \? 0 : resolution\.minParticipants/);
  assert.match(effects, /geometry: ignoreGeometry \? \{\} : resolution\.geometry/);
  assert.match(effects, /maxTargets: resolution\.maxTargets/);
  assert.match(effects, /Only affected enemy tokens can be resolved/);
});
