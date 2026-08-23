import test from "node:test";
import assert from "node:assert/strict";
import { formFromDialogSubmit } from "../scripts/foundry/dialog.js";

test("Foundry v14 DialogV2 submit resolves the button's owning form", () => {
  const form = { elements: { signal: { value: "visual" } } };
  const button = { form };
  const dialog = { element: { querySelector: () => null } };

  assert.equal(formFromDialogSubmit(button, dialog), form);
});

test("DialogV2 form lookup falls back to the dialog element", () => {
  const form = { elements: { choice: { value: "0" } } };
  const dialog = { element: { querySelector: (selector) => selector === "form" ? form : null } };

  assert.equal(formFromDialogSubmit(null, dialog), form);
});
