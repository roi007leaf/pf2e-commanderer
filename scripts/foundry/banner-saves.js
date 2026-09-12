import { FLAG_SCOPE } from "../constants.js";

export const BANNER_SAVE_RULE = "CommanderBannerSave";
const SAVES = ["fortitude", "reflex", "will"];
const SAVE_ITEM_FLAG = "bannerSaveAutomation";

// PF2e's native adjustment works with hazard statistics, but its rule-element
// actor-type whitelist only includes PCs/NPCs. Extend that rule for our objects
// without changing the built-in rule or any ordinary hazard.
export function registerBannerSaveRule() {
  const registry = globalThis.game?.pf2e?.RuleElements;
  const NativeAdjustment = registry?.builtin?.AdjustDegreeOfSuccess;
  if (!NativeAdjustment) throw new Error("PF2e's save adjustment rule is unavailable.");
  registry.custom[BANNER_SAVE_RULE] = class extends NativeAdjustment {
    static validActorTypes = ["hazard"];

    beforePrepareData() {
      if (!this.actor.getFlag?.(FLAG_SCOPE, "bannerObject")) return;
      return super.beforePrepareData();
    }
  };
}

export function bannerSaveItemSource() {
  return {
    name: "Banner object saves", type: "action",
    img: `modules/${FLAG_SCOPE}/assets/banner.svg`,
    flags: { [FLAG_SCOPE]: { [SAVE_ITEM_FLAG]: true } },
    system: {
      actionType: { value: "passive" }, actions: { value: null },
      description: { value: "<p>Applicable banner saves resolve as failures, regardless of the die result. Object immunities still apply; the GM determines whether an effect can target the banner.</p>" },
      rules: SAVES.map((selector) => ({ key: BANNER_SAVE_RULE, selector, adjustment: { all: "to-failure" } })),
    },
  };
}

export async function ensureBannerSaves(actor) {
  if (actor?.type !== "hazard" || !actor.getFlag?.(FLAG_SCOPE, "bannerObject")) return false;
  const source = bannerSaveItemSource();
  const item = actor.items.find((candidate) => candidate.getFlag?.(FLAG_SCOPE, SAVE_ITEM_FLAG));
  if (!item) await actor.createEmbeddedDocuments("Item", [source]);
  else if (JSON.stringify(item.system.rules) !== JSON.stringify(source.system.rules)) {
    await item.update({ "system.rules": source.system.rules });
  }
  const changes = {};
  for (const save of SAVES) {
    if (actor._source.system.saves[save]?.value == null) changes[`system.saves.${save}.value`] = 0;
  }
  if (Object.keys(changes).length) await actor.update(changes);
  return true;
}

export async function upgradeBannerSaves() {
  if (!game.user.isGM || (game.users.activeGM && game.users.activeGM.id !== game.user.id)) return;
  for (const actor of game.actors) {
    try { await ensureBannerSaves(actor); }
    catch (error) {
      console.error(`${FLAG_SCOPE} | Could not upgrade banner saves for ${actor.name}`, error);
      globalThis.ui?.notifications?.error?.(`Could not upgrade saves for ${actor.name}. See console for details.`);
    }
  }
}
