import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const styles = await readFile(new URL("../styles/commanderer.css", import.meta.url), "utf8");

test("Commander chat messages keep an opaque background when Foundry's parchment variable is relative", () => {
  const rule = styles.match(/\.chat-message\.pf2e-commanderer-message\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;

  assert.ok(rule, "Commander chat-message rule exists");
  assert.doesNotMatch(rule, /var\(--chat-message-background/);
  assert.match(rule, /background-color:\s*#e7e3d9/);
  assert.match(rule, /url\(["']?\.\.\/\.\.\/\.\.\/ui\/parchment\.jpg["']?\)/);
});
