import { FLAG_SCOPE } from "../constants.js";
import { ACTIVE_FEATS, hasFeat, assessmentLimit, rallyingDice } from "../domain/feat-rules.js";
import { actorLevel, bannerActive, preparedTacticIds, getDailiesApi, dailiesPreparationActor } from "./runtime.js";
import { bannerOrigin, bannerRangeToToken, plantedBanner } from "./banner.js";
import { registerOperation, requestOperation } from "./socket.js";
import { action, adjacent, chat, condition, confirm, effect, immune, now, numberInput, owner, save, select, strike, targeted } from "./workflow.js";
import { guidedReaction, guidedRevival, guidedMentalRetry, guidedCompanion, guidedShieldRecovery, resolveOpening } from "./guided-feats.js";
import { piranhaDamage } from "./guided-tactics.js";

const locks = new Set();
const BUFFS = {
  "defiant-banner": "Compendium.pf2e.feat-effects.Item.Zy7rrPCgMTeSzKj9",
  "pennant-of-victory": "Compendium.pf2e.feat-effects.Item.aQkzGG9RCII50a4b",
};
export const immunityKey = (_commander, slug) => slug;
export const isImmuneToFeat = (target, commander, slug) => Number(target.getFlag(FLAG_SCOPE, "featImmunities")?.[immunityKey(commander, slug)] ?? 0) > now();
export async function markFeatImmunity(target, commander, slug, seconds) {
  await target.setFlag(FLAG_SCOPE, "featImmunities", { ...(target.getFlag(FLAG_SCOPE, "featImmunities") ?? {}), [immunityKey(commander, slug)]: now() + seconds });
}

function auraTargets(actor, { enemies = false, self = false } = {}) {
  const origin = bannerOrigin(actor);
  if (!origin || !bannerActive(actor)) throw new Error("Display your banner first.");
  return [...new Map(canvas.tokens.placeables.filter((t) => {
    if (!t.actor || bannerRangeToToken(actor, t) > origin.radius) return false;
    if (t.actor.uuid === actor.uuid) return self;
    return enemies ? t.actor.isEnemyOf?.(actor) ?? t.actor.alliance !== actor.alliance
      : t.actor.isAllyOf?.(actor) ?? t.actor.alliance === actor.alliance;
  }).map((t) => [t.actor.uuid, t.document])).values()];
}

export function requestCommanderFeat(item, actor = item.actor) {
  return requestCommanderWorkflow(actor, item.id);
}

export function requestCommanderWorkflow(actor, itemId) {
  return requestOperation("commander-feat", { actorUuid: actor.uuid, itemId,
    targetUuids: [...game.user.targets].map((t) => t.document.uuid) }, {
    gmRequired: !game.user.isGM, directed: game.user.isGM, authorityUserId: game.user.id, timeoutMs: 600_000,
  });
}

export async function executeCommanderFeat(payload, userId) {
  const actor = await fromUuid(payload.actorUuid);
  const user = game.users.get(userId);
  if (!owner(actor, user)) throw new Error("You do not own this commander.");
  if (locks.has(actor.uuid)) throw new Error("Finish the current commander workflow first.");
  const item = actor.items.get(payload.itemId);
  if (!["training", "opening", "piranha", "mercenary-save", "twirl-check"].includes(payload.itemId) && (!item || !ACTIVE_FEATS.has(item.slug))) throw new Error("This feat is unavailable.");
  const targets = await Promise.all((payload.targetUuids ?? []).map((uuid) => fromUuid(uuid)));
  if (targets.some((t) => !t?.actor || t.parent?.id !== canvas.scene?.id)) throw new Error("Targets must be on the active scene.");
  locks.add(actor.uuid);
  try {
    if (payload.itemId === "training") {
      const prepared = preparedTacticIds(actor);
      const actions = [...actor.items].filter((i) => prepared.has(i.id)).flatMap((i) => i.slug === "mountaineering-training" ? ["climb"]
        : i.slug === "naval-training" ? ["swim"] : i.slug === "shadows-in-the-moonlight" ? ["hide", "sneak"] : []);
      const slug = await select("Prepared training", "Action using Warfare Lore", actions.map((s) => ({ value: s, label: s })));
      if (!slug) return false;
      await action(actor, slug, { statistic: "warfare-lore" });
      return true;
    }
    if (payload.itemId === "opening") return await resolveOpening(actor, targets);
    if (payload.itemId === "twirl-check") {
      if (!hasFeat(actor, "banner-twirl")) throw new Error("Commander does not have Banner Twirl.");
      const [defender] = targeted(targets);
      if (!defender.actor.items.some((i) => i.getFlag?.(FLAG_SCOPE, "workflow")?.rangedConcealment && !i.system.expired)) throw new Error("Target has no active Banner Twirl protection.");
      if (!await confirm("Banner Twirl", "Resolve this flat check before the ranged attack. Confirm the attacker cannot ignore this concealment.")) return false;
      const roll = await new Roll("1d20").evaluate();
      await roll.toMessage({ flavor: "Banner Twirl: DC 5 concealment flat check" });
      await chat(actor, "Banner Twirl", roll.total >= 5 ? "Flat check passed; ranged attack may proceed." : "Flat check failed; ranged attack fails. Do not roll/apply its damage.");
      return true;
    }
    if (payload.itemId === "piranha") {
      const source = actor.items.find((i) => i.slug === "piranha-assault");
      if (!source) throw new Error("Commander does not know Piranha Assault.");
      const [attacker] = targeted(targets);
      return await piranhaDamage(attacker.actor, actor, source);
    }
    if (payload.itemId === "mercenary-save") {
      const source = actor.items.find((i) => i.getFlag?.(FLAG_SCOPE, "workflow")?.mercenary);
      if (!source) throw new Error("No Mercenary Reversal effect.");
      const origin = await fromUuid(source.system.context.origin.actor);
      const feat = await fromUuid(source.system.context.origin.item);
      const degree = await save(actor, origin, feat);
      if (degree !== null && degree >= 2) await source.delete();
      return degree !== null;
    }
    const expiry = actor.getFlag(FLAG_SCOPE, "featCooldowns")?.[item.slug];
    if (Number(expiry) > now()) throw new Error(`${item.name} is not ready yet.`);
    if (item.system.traits.value.includes("brandish") && (!bannerActive(actor) || plantedBanner(actor) || actor.getFlag(FLAG_SCOPE, "companion")?.banner)) {
      throw new Error("Brandish requires a displayed, held banner. Retrieve it first.");
    }
    if (item.system.frequency?.value === 0) throw new Error(`${item.name} has no uses remaining.`);
    const turn = game.combat?.started ? `${game.combat.id}:${game.combat.round}:${game.combat.turn}` : null;
    if (turn && item.system.traits.value.includes("flourish") && actor.getFlag(FLAG_SCOPE, "featFlourishTurn") === turn) throw new Error("A flourish was already used this turn.");
    const result = await runFeat(actor, item, targets);
    if (!result) return false;
    if (turn && item.system.traits.value.includes("flourish")) await actor.setFlag(FLAG_SCOPE, "featFlourishTurn", turn);
    if (["rallying-banner", "quickening-banner", "pennant-of-victory"].includes(item.slug)) {
      await actor.setFlag(FLAG_SCOPE, "featCooldowns", { ...(actor.getFlag(FLAG_SCOPE, "featCooldowns") ?? {}), [item.slug]: now() + 600 });
    }
    await chat(actor, item.name, result);
    return true;
  } finally { locks.delete(actor.uuid); }
}

async function runFeat(actor, item, targets) {
  const slug = item.slug;
  if (slug === "adaptive-stratagem") return adaptive(actor, item);
  if (slug === "rapid-assessment") return assessment(actor, item, targets);
  if (["combat-assessment", "guiding-shot", "set-up-strike", "unsteadying-strike"].includes(slug)) return attackFeat(actor, item, targets);
  if (["defensive-swap", "reactive-strike", "reactive-interference", "standard-bearers-sacrifice", "shield-warden"].includes(slug)) {
    return guidedReaction(actor, item, targets);
  }
  if (slug === "desperate-resuscitation") return guidedRevival(actor, item, targets);
  if (slug === "shielded-recovery") return guidedShieldRecovery(actor, item, targets);
  if (slug === "commanders-companion") return guidedCompanion(actor, item, targets);
  if (slug === "armored-regiment-training") {
    await chat(actor, item.name, "Exploration: calculate party travel using normal Speeds without armor penalties. You can rest in armor. Combat Speed penalties still apply.");
    return "Exploration travel and rest guidance displayed; heavy-armor Bulk adjustment is maintained automatically.";
  }
  if (slug === "deceptive-tactics") {
    const choice = await select(item.name, "Action using Warfare Lore", [{ value: "feint", label: "Feint" }, { value: "create-a-diversion", label: "Create a Diversion" }]);
      if (!choice) return false;
      let variant;
      if (choice === "create-a-diversion") {
        variant = await select(item.name, "Diversion method", [
          { value: "distracting-words", label: "Distracting words" },
          { value: "gesture", label: "Gesture" },
          { value: "trick", label: "Trick" },
        ]);
        if (!variant) return false;
      }
      await action(actor, choice, { statistic: "warfare-lore", ...(variant ? { variant } : {}) });
    return "Rolled using Warfare Lore.";
  }
  if (["demand-surrender", "mercenary-reversal"].includes(slug)) return surrender(actor, item, targets);
  const recipients = slug === "banner-twirl"
    ? canvas.tokens.placeables.filter((t) => t.actor && (t.actor.uuid === actor.uuid || (t.actor.isAllyOf?.(actor) && adjacent(actor, t.document)))).map((t) => t.document)
    : auraTargets(actor, { enemies: slug === "confusing-commands", self: Boolean(BUFFS[slug]) });
  if (!recipients.length) throw new Error("No eligible creatures are in range.");
  if (!await confirm(item.name, `Affect: ${recipients.map((t) => t.name).join(", ")}. Confirm these creatures can perceive the required visual/auditory signal.`)) return false;
  let healing;
  if (slug === "rallying-banner") {
    const roll = await new Roll(`${rallyingDice(actorLevel(actor))}d6`).evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: item.name });
    healing = game.combat?.started ? roll.total : Math.floor(roll.total / 2);
  }
  const results = [];
  for (const token of [...new Map(recipients.map((t) => [t.actor.uuid, t])).values()]) {
    const target = token.actor;
    if (immune(target, item.system.traits.value)) { results.push(`${target.name}: immune`); continue; }
    if (BUFFS[slug]) {
      const native = await fromUuid(BUFFS[slug]);
      await effect(target, actor, item, { rules: native.system.rules });
    } else if (slug === "rallying-banner") await target.applyDamage({ damage: -healing, token, item });
    else if (slug === "quickening-banner") {
      await condition(target, "quickened", actor, item);
      await chat(target, item.name, "Extra action may only Strike or Stride; lasts 1 round.");
    } else if (slug === "banner-twirl") {
      await effect(target, actor, item, { description: "Concealed from ranged attacks only. Resolve the DC 5 flat check for a ranged attacker before its attack.",
        rules: [{ key: "Note", selector: "ac", text: "Banner Twirl: concealed from ranged attacks; DC 5 flat check." }], flags: { rangedConcealment: true } });
    } else if (slug === "confusing-commands") {
      if (isImmuneToFeat(target, actor, slug)) { results.push(`${target.name}: temporary immunity`); continue; }
      const degree = await save(target, actor, item);
      if (degree === null) continue;
      if (degree >= 2) await markFeatImmunity(target, actor, slug, 86400);
      else await condition(target, "confused", actor, item, degree === 0 ? 2 : 1);
    } else if (slug === "banners-inspiration") {
      if (isImmuneToFeat(target, actor, slug)) continue;
      if (target.hasCondition("frightened")) await target.decreaseCondition("frightened");
      if (await guidedMentalRetry(target, actor, item)) await markFeatImmunity(target, actor, slug, 600);
    }
    results.push(target.name);
  }
  return `${healing === undefined ? "Resolved" : `Healed ${healing} HP`}: ${results.join(", ")}.`;
}

async function adaptive(actor, item) {
  if (!await confirm(item.name, "Use this free action now because you just rolled initiative?")) return false;
  const prepared = preparedTacticIds(actor);
  const tierAllowed = (i) => hasFeat(actor, "contact-with-the-enemy")
    || ![...(i.system.traits.otherTags ?? []), ...(i.system.traits.value ?? [])].some((tag) => ["commander-master-tactic", "commander-legendary-tactic", "master", "legendary"].includes(tag));
  const eligible = [...actor.items].filter((i) => prepared.has(i.id) && tierAllowed(i));
  const remove = await select(item.name, "Prepared tactic to replace", eligible.map((i) => ({ value: i.id, label: i.name })));
  if (!remove) return false;
  const add = await select(item.name, "Replacement from folio", [...actor.items].filter((i) => i.system?.traits?.value?.includes("tactic") && !prepared.has(i.id))
    .map((i) => ({ value: i.id, label: i.name })));
  if (!add) return false;
  prepared.delete(remove); prepared.add(add);
  const base = getDailiesApi() ? dailiesPreparationActor(actor) : actor;
  await base.setFlag(getDailiesApi() ? "pf2e-dailies" : FLAG_SCOPE, getDailiesApi() ? "extra.dailies.commander-tactics.tactics" : "preparedTactics", [...prepared]);
  return "Prepared tactic replaced for this encounter.";
}

async function knowledge(actor, item, target, bonus = 0) {
  const skills = Object.entries(actor.skills ?? {}).map(([key, s]) => ({ value: key, label: s.label ?? key }));
  const skill = await select(item.name, `Recall Knowledge about ${target.name}: choose applicable skill`, skills);
  if (!skill) return false;
  const dc = await numberInput(item.name, "GM: Recall Knowledge DC (include rarity and repeat-check adjustments)", { value: 20 });
  if (dc === null) return false;
  const roll = await actor.getStatistic(skill).roll({ dc: { value: dc }, messageMode: "blind", extraRollOptions: ["action:recall-knowledge"],
    modifiers: bonus ? [new game.pf2e.Modifier({ label: item.name, modifier: bonus, type: "circumstance" })] : [] });
  if (!roll) return false;
  return true;
}

async function assessment(actor, item, targets) {
  if (!targets.length) throw new Error("Target observed enemies first.");
  if (!await confirm(item.name, "Confirm initiative was just rolled and all chosen creatures are observed. The GM supplies secret knowledge results.")) return false;
  const count = await numberInput(item.name, `Number of checks (maximum ${assessmentLimit(actor)})`, { min: 1, value: Math.min(targets.length, assessmentLimit(actor)) });
  if (count === null) return false;
  if (count > assessmentLimit(actor)) throw new Error("Too many assessment checks.");
  for (let i = 0; i < count; i++) {
    const uuid = await select(item.name, `Target for check ${i + 1}`, targets.map((t) => ({ value: t.uuid, label: t.name })));
    if (!uuid || !await knowledge(actor, item, targets.find((t) => t.uuid === uuid))) return false;
  }
  return `${count} secret Recall Knowledge checks completed; GM provides results.`;
}

async function attackFeat(actor, item, targets) {
  const [target] = targeted(targets);
  if (item.slug === "combat-assessment" && isImmuneToFeat(target.actor, actor, item.slug)) throw new Error("Target is temporarily immune to Combat Assessment.");
  const outcome = await strike(actor, item, target, { mode: item.slug === "guiding-shot" ? "ranged" : item.slug === "set-up-strike" ? "any" : "melee" });
  if (!outcome) return false;
  if (item.slug === "combat-assessment") await markFeatImmunity(target.actor, actor, item.slug, 86400);
  const degree = Number.isInteger(outcome.degree) ? outcome.degree : await numberInput(item.name, "Strike result: 0 critical failure, 1 failure, 2 success, 3 critical success", { value: 2 });
  if (degree === null || degree < 2) return "Strike did not hit; no follow-up effect.";
  if (item.slug === "combat-assessment") {
    const observed = hasFeat(actor, "observational-analysis") && await confirm(item.name, "Has you or an ally targeted this creature with a Strike or spell since the start of your last turn (before this Strike)?");
    await knowledge(actor, item, target, observed ? degree === 3 ? 4 : 2 : degree === 3 ? 2 : 0);
    return "Combat Assessment resolved; target immune for 1 day.";
  }
  if (item.slug === "unsteadying-strike") {
    const native = await fromUuid("Compendium.pf2e.feat-effects.Item.uUIpCXtvKvPVNunx");
    await effect(target.actor, actor, item, { rules: native.system.rules });
    return "Applied scoped maneuver penalties until your next turn.";
  }
  const damaged = (hasFeat(actor, "targeting-strike") || hasFeat(actor, "fortunate-blow"))
    && await confirm(item.name, "Resolve damage now. Did this Strike actually deal damage after immunity, resistance and other reductions?");
  await actor.setFlag(FLAG_SCOPE, "opening", { targetUuid: target.uuid, itemUuid: item.uuid, slug: item.slug,
    bonus: degree === 3 ? 2 : 1, damaged, created: now(), combatId: game.combat?.id, round: game.combat?.round, turn: game.combat?.turn });
  return "Opening recorded. Use Resolve next attack opening on the feat's posted chat card for the next eligible attack before your next turn.";
}

async function surrender(actor, item, targets) {
  const [token] = targeted(targets);
  const target = token.actor;
  const demand = item.slug === "demand-surrender";
  if (isImmuneToFeat(target, actor, item.slug)) throw new Error("Target is temporarily immune.");
  if (!await confirm(item.name, demand
    ? "Confirm you outnumber enemies, observe this target, and you or an ally restrained or reduced an opponent to 0 HP since the start of your last turn."
    : "Confirm enemies outnumber your side and this target is observed and can hear you.")) return false;
  const degree = await save(target, actor, item);
  if (degree === null) return false;
  if (demand) {
    if (degree === 1) await condition(target, "fleeing", actor, item);
    if (degree === 0) {
      await target.increaseCondition("prone");
      const updates = [...target.items].filter((i) => i.system?.equipped?.carryType === "held")
        .map((i) => ({ _id: i.id, "system.equipped.carryType": "dropped", "system.equipped.handsHeld": 0 }));
      if (updates.length) await target.updateEmbeddedDocuments("Item", updates);
    }
    if (degree < 3) await effect(target, actor, item, { rounds: degree === 0 ? 10 : 1,
      flags: { surrender: true }, description: degree === 0 ? "No hostile actions against commander or allies for 1 minute, ending if they attack you. GM adjudicates hostility."
        : "Cannot take hostile actions including this commander as a target for 1 round." });
  } else if (degree === 3) await markFeatImmunity(target, actor, item.slug, 86400);
  else if (degree === 2) await target.increaseCondition("stunned", { value: 1 });
  else {
    await effect(target, actor, item, { rounds: 1000, flags: { mercenary: true, combatId: game.combat?.id },
      description: "Controlled for this battle. New Will save whenever damaged or directed against nature. GM controls allegiance and actions; on success this effect ends.",
      rules: [{ key: "GrantItem", inMemoryOnly: true, uuid: "Compendium.pf2e.conditionitems.Item.9qGBRpbX9NEwtAAr" }] });
    await chat(actor, item.name, `${target.name} joins your side. GM updates allegiance as appropriate; use the effect's origin to resolve repeat saves. ${degree === 0 ? "If alive after combat, it offers monetary possessions as tribute." : ""}`);
  }
  return `Resolved ${item.name} against ${target.name}; degree ${degree}.`;
}

export function registerFeatWorkflows() {
  registerOperation("commander-feat", executeCommanderFeat);
  Hooks.on("updateCombatant", async (combatant, changes, _options, userId) => {
    if (userId !== game.user.id || changes.initiative == null || !owner(combatant.actor, game.user)) return;
    for (const slug of ["adaptive-stratagem", "rapid-assessment"]) {
      const feat = combatant.actor.items.find((i) => i.slug === slug);
      if (!feat) continue;
      try {
        if (await confirm(feat.name, "Initiative rolled. Open this free-action workflow now? For assessment, target observed enemies first.")) await requestCommanderFeat(feat);
      } catch (error) { ui.notifications.error(error.message); }
    }
  });
  Hooks.on("createChatMessage", async (message) => {
    if (message.author?.id !== game.user.id) return;
    const context = message.flags?.pf2e?.context;
    if (!context?.options?.includes("action:battle-medicine")) return;
    const actor = message.actor;
    const feat = actor?.items.find((i) => i.slug === "shielded-recovery");
    if (!feat || !owner(actor, game.user)) return;
    try { await requestCommanderFeat(feat); } catch (error) { ui.notifications.error(error.message); }
  });
}
