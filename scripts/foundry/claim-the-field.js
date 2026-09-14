import { FLAG_SCOPE } from "../constants.js";
import { classDC } from "./runtime.js";
import { grantTemporaryCondition } from "./effects.js";

export async function claimTheFieldAllowsAttempt(commander, enemy, placement) {
  if (!placement?.claimTheField || placement.removed) return true;
  const immunities = enemy.attributes?.immunities ?? enemy.system?.attributes?.immunities ?? [];
  if (immunities.some((immunity) => immunity.type === "mental" && !immunity.exceptions?.length)) return true;
  const statistic = enemy.saves?.will ?? enemy.getStatistic?.("will");
  if (!statistic?.roll) throw new Error(`${enemy.name} has no Will save.`);
  const item = commander.items.find((item) => item.slug === "claim-the-field");
  const roll = await statistic.roll({
    dc: { value: classDC(commander) }, origin: commander, item,
    traits: ["incapacitation", "mental"],
    // PF2e applies incapacitation itself from these options and the origin's level.
    extraRollOptions: ["incapacitation", "mental", "origin:item:slug:claim-the-field", "inflicts:fleeing"],
  });
  if (!roll) return false;
  const degree = roll.degreeOfSuccess;
  if (!Number.isInteger(degree) || degree < 0 || degree > 3) throw new Error("PF2e did not return a valid Will save result.");
  if (degree === 0) await grantTemporaryCondition(enemy, "fleeing", 1, {
    commander, item, name: "Effect: Claim the Field — Fleeing", duration: 1,
  });
  if (degree < 2) globalThis.ui?.notifications?.info?.("Claim the Field: the attempt fails.");
  return degree >= 2;
}

const WRAPPED = Symbol("claimTheFieldDamage");

export function registerClaimTheFieldDamage() {
  const prototype = CONFIG.PF2E.Actor.documentClasses.hazard.prototype;
  if (prototype[WRAPPED]) return;
  const applyDamage = prototype.applyDamage;
  prototype.applyDamage = async function (options, ...args) {
    const origin = this.getFlag?.(FLAG_SCOPE, "bannerObject");
    const damage = typeof options.damage === "number" ? options.damage : options.damage?.total;
    if (origin && damage > 0) {
      const placement = [...game.scenes].flatMap((scene) => Object.values(scene.getFlag(FLAG_SCOPE, "plantedBanners") ?? {}))
        .find((entry) => entry.objectActorId === this.id && entry.claimTheField && !entry.removed);
      if (placement) {
        const commander = await fromUuid(origin.commanderUuid);
        const enemy = options.item?.actor;
        if (!commander) throw new Error("Claim the Field's commander is unavailable.");
        if (!enemy) {
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Claim the Field" },
            content: "<p>This damage has no source actor. Resolve the attacker's Will save against the commander's class DC first (mental, incapacitation; critical failure: fleeing for 1 round). Apply this damage only if the attempt is allowed.</p>",
            yes: { label: "Apply damage" }, no: { label: "Cancel" }, rejectClose: false,
          });
          if (!confirmed) return this;
        } else if (enemy.uuid !== commander.uuid && !(enemy.isAllyOf?.(commander)
          ?? (enemy.alliance != null && enemy.alliance === commander.alliance))) {
          if (!await claimTheFieldAllowsAttempt(commander, enemy, placement)) return this;
        }
      }
    }
    return applyDamage.call(this, options, ...args);
  };
  prototype[WRAPPED] = true;
}
