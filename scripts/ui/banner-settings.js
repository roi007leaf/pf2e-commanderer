import { FLAG_SCOPE } from "../constants.js";
import { BANNER_MATERIALS, bannerObjectStats } from "../domain/banner-object.js";
import { formFromDialogSubmit } from "../foundry/dialog.js";
import { setSquadLimit } from "../foundry/squad.js";

export async function configureBanner(actor) {
  if (!actor.isOwner) throw new Error("You do not own this commander.");
  const saved = actor.getFlag(FLAG_SCOPE, "bannerConfiguration") ?? {};
  const escape = foundry.utils.escapeHTML;
  const materials = [...Object.entries(BANNER_MATERIALS), ["custom", { label: "Custom material" }]]
    .map(([key, value]) => `<option value="${key}" ${key === (saved.material ?? "wood") ? "selected" : ""}>${value.label}</option>`).join("");
  const items = [...actor.items].filter((item) => ["weapon", "shield", "equipment"].includes(item.type))
    .map((item) => `<option value="${escape(item.id)}" ${item.id === saved.itemId ? "selected" : ""}>${escape(item.name)}</option>`).join("");
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["pf2e-commanderer-dialog"], window: { title: "Banner material and attachment" },
    content: `<div class="commanderer-settings">
      <label>Banner material<select name="material">${materials}</select></label>
      <label>Affixed item<select name="itemId"><option value="">Simple pole / no inventory item</option>${items}</select></label>
      <p>Uses the greater material or item HP and Hardness. Choose custom values for unusual materials or items without durability data.</p>
      <label>Custom base Hardness<input name="hardness" type="number" min="0" step="1" value="${Number(saved.hardness ?? 3)}"></label>
      <label>Custom maximum HP<input name="hp" type="number" min="1" step="1" value="${Number(saved.hp ?? 12)}"></label>
      <label>Object AC (GM adjudication)<input name="ac" type="number" min="0" step="1" value="${Number(saved.ac ?? 10)}"></label>
      <p>Plant Banner adds level + Intelligence modifier to a weapon or pole's Hardness while planted (not a shield's). Damage persists between placements. Objects automatically fail applicable saves; GM decides which area effects affect objects.</p>
    </div>`,
    buttons: [{ action: "save", label: "Save", default: true, callback: (_event, button, dialog) => {
      const form = formFromDialogSubmit(button, dialog);
      const data = Object.fromEntries(new FormData(form));
      bannerObjectStats(actor, data);
      return data;
    } }, { action: "cancel", label: "Cancel" }],
    rejectClose: false,
  });
  if (!result || typeof result !== "object") return false;
  if (globalThis.canvas?.scene?.getFlag(FLAG_SCOPE, "plantedBanners")?.[actor.id]) {
    throw new Error("Retrieve the banner before changing its material.");
  }
  await actor.setFlag(FLAG_SCOPE, "bannerConfiguration", result);
  return true;
}

export async function configureSquadLimit(actor) {
  if (!game.user.isGM) throw new Error("Only a GM can change squad limits.");
  const saved = actor.getFlag(FLAG_SCOPE, "squadLimit");
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["pf2e-commanderer-dialog"], window: { title: "Squad limit" },
    content: `<div class="commanderer-settings"><label>Maximum squadmates<input name="limit" type="number" min="0" step="1" value="${Number.isInteger(saved) ? saved : ""}" placeholder="Default: 2 + Intelligence"></label>
      <p>Leave blank for the standard limit. Increase by one to include a Commander's Companion, then add that companion to the squad. Lowering the limit preserves existing members; remove excess members manually.</p></div>`,
    buttons: [{ action: "save", label: "Save", default: true, callback: (_event, button, dialog) => ({
      value: formFromDialogSubmit(button, dialog).elements.limit.value,
    }) }, { action: "cancel", label: "Cancel" }], rejectClose: false,
  });
  if (!result || typeof result !== "object") return;
  await setSquadLimit(actor, result.value);
}
