import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("participant picker presents selection as a responsive squadmate-card grid", async () => {
  const [engine, css] = await Promise.all([
    readFile(new URL("../scripts/engine.js", import.meta.url), "utf8"),
    readFile(new URL("../styles/commanderer.css", import.meta.url), "utf8"),
  ]);

  assert.match(engine, /function participantChoiceCard/);
  assert.match(engine, /commanderer-choice-indicator/);
  assert.match(css, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/);
  assert.match(css, /\.commanderer-choice:has\(input:checked\)/);
});
