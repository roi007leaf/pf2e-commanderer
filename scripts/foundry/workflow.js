import { FLAG_SCOPE } from "../constants.js";
import { activeTokenFor, actorLevel, classDC } from "./runtime.js";
import { grantTemporaryCondition } from "./effects.js";
import { formFromDialogSubmit } from "./dialog.js";

export const escape = (text) => foundry.utils.escapeHTML(String(text ?? ""));
export const now = () => Number(game.time.worldTime);
export const owner = (actor, user) => Boolean(actor && user && (user.isGM || actor.testUserPermission?.(user, "OWNER")));

export async function damageRoll(formula) {
  const DamageRoll = CONFIG.Dice.rolls.find((type) => type.name === "DamageRoll");
  if (!DamageRoll) throw new Error("PF2e DamageRoll is unavailable.");
  return new DamageRoll(formula).evaluate();
}

export async function select(title, label, choices) {
  if (!choices.length) throw new Error(`No eligible choices for ${label}.`);
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["pf2e-commanderer-dialog"], window: { title }, rejectClose: false,
    content: `<label>${escape(label)}<select name="selection">${choices.map((c) => `<option value="${escape(c.value)}">${escape(c.label)}</option>`).join("")}</select></label>`,
    buttons: [{ action: "ok", label: "Continue", default: true,
      callback: (_e, button, dialog) => ({ value: formFromDialogSubmit(button, dialog).elements.selection.value }) },
    { action: "cancel", label: "Cancel" }],
  });
  return result && typeof result === "object" ? result.value : null;
}

export async function confirm(title, text) {
  return foundry.applications.api.DialogV2.confirm({ classes: ["pf2e-commanderer-dialog"],
    window: { title }, content: `<p>${escape(text)}</p>`, rejectClose: false });
}

export async function numberInput(title, label, { min = 0, value = 0 } = {}) {
  const result = await foundry.applications.api.DialogV2.wait({
    classes: ["pf2e-commanderer-dialog"], window: { title }, rejectClose: false,
    content: `<label>${escape(label)}<input name="amount" type="number" min="${min}" step="1" value="${value}"></label>`,
    buttons: [{ action: "ok", label: "Continue", default: true,
      callback: (_e, button, dialog) => ({ value: Number(formFromDialogSubmit(button, dialog).elements.amount.value) }) },
    { action: "cancel", label: "Cancel" }],
  });
  if (!result || typeof result !== "object") return null;
  if (!Number.isInteger(result.value) || result.value < min) throw new Error(`Enter a whole number of at least ${min}.`);
  return result.value;
}

export function effectSource(commander, item, { name = item.name, rules = [], rounds = 1, seconds, description = "", flags = {}, expiry = "turn-start" } = {}) {
  const combatant = game.combat?.combatants?.find((c) => c.actor?.uuid === commander.uuid);
  const duration = seconds === undefined ? { value: rounds, unit: "rounds", expiry }
    : seconds % 86400 === 0 ? { value: seconds / 86400, unit: "days", expiry: null }
      : { value: seconds / 60, unit: "minutes", expiry: null };
  return { name: `Effect: ${name}`, type: "effect", img: item.img,
    flags: { [FLAG_SCOPE]: { workflow: { commanderUuid: commander.uuid, ...flags } } },
    system: { slug: null, rules, description: { value: `<p>${escape(description)}</p>` },
      level: { value: actorLevel(commander) },
      context: { origin: { actor: commander.uuid, item: item.uuid }, target: null, roll: null },
      start: { value: now(), initiative: combatant?.initiative ?? game.combat?.combatant?.initiative ?? null },
      duration: { ...duration, sustained: false },
      tokenIcon: { show: true }, traits: { value: [] } } };
}

export async function effect(actor, commander, item, options) {
  return actor.createEmbeddedDocuments("Item", [effectSource(commander, item, options)]);
}

export async function condition(actor, slug, commander, item, rounds = 1) {
  return grantTemporaryCondition(actor, slug, 1, { commander, item, name: `Effect: ${item.name}`, duration: rounds });
}

export function immune(actor, traits) {
  const immunities = actor.attributes?.immunities ?? actor.system?.attributes?.immunities ?? [];
  return immunities.some((i) => traits.includes(i.type) && !i.exceptions?.length);
}

export async function save(actor, commander, item, { dc = classDC(commander), traits = item.system?.traits?.value ?? [] } = {}) {
  if (immune(actor, traits)) return 3;
  const statistic = actor.saves?.will ?? actor.getStatistic?.("will");
  if (!statistic?.roll) throw new Error(`${actor.name} has no Will save.`);
  const roll = await statistic.roll({ dc: { value: dc }, origin: commander, item, traits,
    extraRollOptions: [...traits, `origin:item:slug:${item.slug}`] });
  if (!roll) return null;
  if (!Number.isInteger(roll.degreeOfSuccess)) throw new Error("PF2e returned no save result.");
  return roll.degreeOfSuccess;
}

export async function chat(actor, title, text) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<h3>${escape(title)}</h3><p>${escape(text)}</p>` });
}

export async function action(actor, slug, options = {}) {
  const camel = slug.replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
  const entry = game.pf2e.actions.get?.(slug) ?? game.pf2e.actions[camel];
  if (entry?.use) return entry.use({ actors: [actor], ...options });
  if (typeof entry === "function") return entry({ actors: actor, ...options });
  throw new Error(`PF2e action ${slug} is unavailable.`);
}

export async function strike(actor, item, target, { mode = "any", noMap = false, slug } = {}) {
  const choices = (actor.system?.actions ?? []).filter((s) => s.type === "strike" && s.visible !== false
    && (!slug || s.item?.slug === slug)
    && (mode === "any" || (mode === "melee" ? s.item?.isMelee : s.item?.isRanged)));
  const index = await select(item.name, "Strike", choices.map((s, i) => ({ value: String(i), label: s.label })));
  if (index === null) return null;
  const selected = choices[Number(index)];
  const variant = noMap ? "0" : await select(item.name, "Multiple attack penalty", [
    { value: "0", label: "First attack" }, { value: "1", label: "Second attack" }, { value: "2", label: "Third or later attack" },
  ]);
  if (variant === null) return null;
  const roll = await selected.variants[Number(variant)].roll({ target: target?.object ?? target, options: [`action:${item.slug}`] });
  return roll ? { roll, strike: selected, degree: roll.degreeOfSuccess } : null;
}

export function targeted(tokens, count = 1) {
  if (tokens.length !== count || tokens.some((t) => !t.actor)) throw new Error(`Target exactly ${count} creature${count === 1 ? "" : "s"} first.`);
  return tokens;
}

export function adjacent(actor, token) {
  const origin = activeTokenFor(actor);
  const a = origin?.document?.mechanicalBounds;
  const b = token?.mechanicalBounds;
  const grid = globalThis.canvas?.scene?.grid;
  if (a && b && grid?.type === 1 && typeof grid.measurePath === "function") {
    // TokenDocument coordinates update before the animated Token placeable.
    const half = Number(grid.size) / 2;
    const center = (bounds, axis, extent, toward) => {
      const inset = Math.min(half, bounds[extent] / 2);
      return Math.max(bounds[axis] + inset, Math.min(toward, bounds[axis] + bounds[extent] - inset));
    };
    const p = { x: center(a, "x", "width", b.x + b.width / 2), y: center(a, "y", "height", b.y + b.height / 2), elevation: origin.document.elevation };
    const q = { x: center(b, "x", "width", p.x), y: center(b, "y", "height", p.y), elevation: token.elevation };
    return grid.measurePath([p, q]).distance <= Number(grid.distance ?? 5);
  }
  return Boolean(origin && token?.object && origin.distanceTo(token.object) <= Number(canvas.scene.grid.distance ?? 5));
}
