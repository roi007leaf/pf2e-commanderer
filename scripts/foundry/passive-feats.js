import { FLAG_SCOPE } from "../constants.js";
import { armoredBulkRules, bannerRadius, hasFeat } from "../domain/feat-rules.js";
import { adjacent, effectSource, save, confirm, chat } from "./workflow.js";
import { activeTokenFor, bannerToggle } from "./runtime.js";

let pending = false;
let running = false;
let rerun = false;
function isGM() { return game.user.isGM && (!game.users.activeGM || game.users.activeGM.id === game.user.id); }
function allActors() { return [...new Map([...game.actors, ...(canvas.tokens?.placeables ?? []).map((t) => t.actor)].filter(Boolean).map((a) => [a.uuid, a])).values()]; }

async function maintain(actor, kind, rules, origin = actor, item = { name: "Commander training", img: "icons/svg/book.svg" }) {
  const existing = [...actor.items].find((i) => i.getFlag?.(FLAG_SCOPE, "passive")?.kind === kind);
  if (!rules.length) { if (existing) await existing.delete(); return; }
  if (existing && JSON.stringify(existing._source.system.rules) === JSON.stringify(rules)) return;
  if (existing) { await existing.update({ "system.rules": rules }); return; }
  const source = effectSource(origin, item, { rules });
  source.system.duration = { value: -1, unit: "unlimited", expiry: null, sustained: false };
  source.flags[FLAG_SCOPE].passive = { kind, originUuid: origin.uuid };
  await actor.createEmbeddedDocuments("Item", [source]);
}

export async function syncPassiveFeats() {
  if (!isGM()) return;
  if (running) { rerun = true; return; }
  running = true;
  try {
    const actors = allActors();
    const companionRules = new Map();
    for (const actor of actors) {
      await maintain(actor, "armored-regiment", armoredBulkRules(actor));
      const link = hasFeat(actor, "commanders-companion") ? actor.getFlag(FLAG_SCOPE, "companion") : null;
      if (!link) continue;
      const companion = await fromUuid(link.actorUuid);
      if (!companion) continue;
      const placement = canvas.scene?.getFlag(FLAG_SCOPE, "plantedBanners")?.[actor.id];
      const native = bannerToggle(actor);
      if (link.banner && actor.rollOptions?.all?.["commanders-banner"] && native) {
        await actor.toggleRollOption(native.domain, native.option, native.itemId, false);
      }
      const rules = [];
      if ((link.banner && link.displayed !== false && !placement) || link.mascot) {
        const effects = [{ uuid: "Compendium.pf2e.feat-effects.Item.JZWi6512m9RlMrNO", affects: "allies",
          ...(hasFeat(actor, "glorious-banner") ? { alterations: [{ mode: "add", property: "other-tags", value: "glorious-banner" }] } : {}) }];
        if (hasFeat(actor, "glorious-banner")) effects.push({ uuid: "Compendium.pf2e.feat-effects.Item.8x5T5e5Gzh3NJ86H", affects: "enemies" });
        rules.push({ key: "Aura", slug: "commanders-banner", radius: link.banner && !placement ? bannerRadius(actor, { companion: true, mascot: link.mascot }) : 30,
          effects, traits: ["emotion", "mental", "visual", "aura"] });
      }
      companionRules.set(companion.uuid, { companion, actor, rules });
      const squad = actor.getFlag(FLAG_SCOPE, "squad") ?? [];
      if (!squad.some((m) => m.actorUuid === companion.uuid)) {
        const token = fromUuidSync(link.tokenUuid);
        if (token) await actor.setFlag(FLAG_SCOPE, "squad", [...squad, { actorUuid: companion.uuid, tokenUuid: token.uuid, name: token.name, img: companion.img }]);
      }
    }
    for (const actor of actors) {
      const grant = companionRules.get(actor.uuid);
      await maintain(actor, "companion-banner", grant?.rules ?? [], grant?.actor ?? actor);
      for (const item of [...actor.items]) {
        const flags = item.getFlag?.(FLAG_SCOPE, "workflow");
        if (!flags) continue;
        if (flags.adjacentTo) {
          const origin = fromUuidSync(flags.adjacentTo);
          if (!origin || !adjacent(actor, origin)) await item.delete();
        }
        if (flags.mercenary && (!game.combat?.started || game.combat.id !== flags.combatId)) await item.delete();
        if (flags.corpseCover) {
          const corpse = fromUuidSync(flags.corpseCover);
          if (!corpse?.actor || (Number(corpse.actor.system.attributes.hp.value) > 0 && !corpse.actor.hasCondition("unconscious") && !corpse.actor.statuses?.has("dead"))) {
            await item.delete();
          } else {
            const token = activeTokenFor(actor);
            const inside = token && corpse.object && token.distanceTo(corpse.object) <= Number(canvas.scene.grid.distance ?? 5);
            const toggle = item.system.rules.find((r) => r.key === "RollOption" && r.option === "corpse-crenellation-cover");
            if (toggle && toggle.value !== Boolean(inside)) await actor.toggleRollOption("all", "corpse-crenellation-cover", item.id, Boolean(inside));
          }
        }
      }
    }
  } finally { running = false; if (rerun) { rerun = false; schedule(); } }
}

function schedule() {
  if (!isGM()) return;
  if (running) { rerun = true; return; }
  if (pending) return;
  pending = true;
  setTimeout(() => { pending = false; syncPassiveFeats().catch((e) => { console.error(e); ui.notifications.error(e.message); }); }, 50);
}

export function registerPassiveFeats() {
  for (const hook of ["canvasReady", "createItem", "updateItem", "deleteItem", "updateActor", "updateToken", "deleteToken", "updateScene", "deleteCombat"]) Hooks.on(hook, schedule);
  Hooks.on("updateCombat", async (combat, changes) => {
    schedule();
    if (!isGM() || !("turn" in changes || "round" in changes)) return;
    const actor = combat.combatant?.actor;
    if (actor?.getFlag(FLAG_SCOPE, "opening")) await actor.unsetFlag(FLAG_SCOPE, "opening");
    for (const creature of allActors()) {
      for (const item of [...creature.items]) {
        const flags = item.getFlag?.(FLAG_SCOPE, "workflow");
        if (flags?.loseReaction && creature.uuid === actor?.uuid) {
          await chat(creature, "Slip and Sizzle", "Do not regain a reaction at the start of this turn.");
          await item.update({ [`flags.${FLAG_SCOPE}.workflow.loseReaction`]: false });
        }
      }
    }
  });
  const damaged = new Map();
  Hooks.on("preUpdateActor", (actor, changes) => {
    if ("system.attributes.hp.value" in changes || changes.system?.attributes?.hp?.value !== undefined) damaged.set(actor.uuid, actor.system.attributes.hp.value);
  });
  Hooks.on("updateActor", async (actor) => {
    const previous = damaged.get(actor.uuid); damaged.delete(actor.uuid);
    if (!isGM() || previous === undefined || actor.system.attributes.hp.value >= previous) return;
    for (const item of [...actor.items]) {
      const flags = item.getFlag?.(FLAG_SCOPE, "workflow");
      if (!flags?.mercenary) continue;
      const commander = await fromUuid(flags.commanderUuid);
      const source = await fromUuid(item.system.context.origin.item);
      if (!commander || !source) continue;
      if (await confirm(source.name, `${actor.name} took damage. Roll the new Will save to end control now?`)) {
        const degree = await save(actor, commander, source);
        if (degree >= 2 && actor.items.has(item.id)) await item.delete();
      }
    }
  });
  schedule();
}
