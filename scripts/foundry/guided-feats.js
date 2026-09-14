import { FLAG_SCOPE, CONDITION_UUIDS } from "../constants.js";
import { hasFeat } from "../domain/feat-rules.js";
import { activeTokenFor, actorLevel } from "./runtime.js";
import { adjacent, chat, confirm, effect, numberInput, save, select, strike, targeted, now } from "./workflow.js";

export async function guidedMentalRetry(target, commander, item) {
  const candidates = [...target.items].filter((i) => ["effect", "condition", "affliction"].includes(i.type));
  const id = await select(item.name, `${target.name}: mental effect to retry`, [{ value: "skip", label: "No retry (frightened reduction only)" },
    ...candidates.map((i) => ({ value: i.id, label: i.name }))]);
  if (!id || id === "skip") return false;
  const source = target.items.get(id);
  if (!await confirm(item.name, `Confirm ${source.name} is a mental effect allowing a new save. Failure consequences still occur.`)) return false;
  const statistic = await select(item.name, "Original saving throw", ["will", "fortitude", "reflex"].map((s) => ({ value: s, label: s })));
  if (!statistic) return false;
  const dc = await numberInput(item.name, "Original effect DC", { min: 1, value: 20 });
  if (dc === null) return false;
  const roll = await target.getStatistic(statistic).roll({ dc: { value: dc }, extraRollOptions: ["mental"] });
  if (!roll) return false;
  const resolution = await select(item.name, `Apply ${source.name}'s result`, [
    { value: "keep", label: "Keep effect; apply its remaining consequences manually" },
    { value: "end", label: "This save ends the selected effect" },
  ]);
  if (resolution === "end") await source.delete();
  await chat(commander, item.name, `${target.name} retried ${source.name}; degree ${roll.degreeOfSuccess}. Resolve the source effect's consequences.`);
  return true;
}

export async function resolveOpening(commander, targets) {
  const opening = commander.getFlag(FLAG_SCOPE, "opening");
  if (!opening) throw new Error("No pending attack opening.");
  if (now() - opening.created > 6 && !game.combat?.started) throw new Error("This opening expired.");
  const item = await fromUuid(opening.itemUuid);
  const target = await fromUuid(opening.targetUuid);
  const [attackerToken] = targeted(targets);
  const attacker = attackerToken.actor;
  if (!item || !target?.actor || attacker.uuid === commander.uuid) throw new Error("Choose another creature to use the opening.");
  if (opening.slug === "set-up-strike" && !attacker.isAllyOf?.(commander)) throw new Error("Set-Up Strike requires an allied attacker.");
  if (!await confirm(item.name, `Confirm ${attacker.name} makes the next eligible attack against ${target.name}, no eligible attack has intervened, and the commander's next turn has not begun.`)) return false;
  const predicate = [`target:signature:${target.actor.signature}`];
  const rules = [];
  if (opening.slug === "guiding-shot") rules.push({ key: "FlatModifier", selector: "attack-roll", type: "circumstance", value: opening.bonus, predicate });
  if (opening.damaged && hasFeat(commander, "targeting-strike")) rules.push({ key: "FlatModifier", selector: "attack-damage", damageCategory: "precision",
    value: commander.abilities?.int?.mod ?? commander.system.abilities.int.mod, predicate });
  if (opening.damaged && hasFeat(commander, "fortunate-blow")) rules.push({ key: "RollTwice", selector: "attack-roll", keep: "higher", predicate });
  const created = await effect(attacker, commander, item, { rules, description: "Only the selected next attack. Resolve its damage before closing this workflow." });
  let offGuard = [];
  try {
    if (opening.slug === "set-up-strike") offGuard = await effect(target.actor, commander, item, { rules: [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: -2,
      predicate: [`origin:signature:${attacker.signature}`] }] });
    const mode = await select(item.name, "Next attack", [{ value: "strike", label: "Strike" }, { value: "other", label: "Spell or other attack (guided)" }]);
    if (!mode) return false;
    if (mode === "strike") {
      const result = await strike(attacker, item, target);
      if (!result) return false;
    } else {
      attacker.sheet.render({ force: true });
      if (!await confirm(item.name, `Target ${target.name}, roll the attack from ${attacker.name}'s sheet now, and continue after the roll.`)) return false;
    }
    await commander.unsetFlag(FLAG_SCOPE, "opening");
    await confirm(item.name, "Resolve this attack's damage now, then continue to remove the temporary bonuses. The opening has been consumed even if the attack missed.");
    return true;
  } finally {
    for (const document of [...created, ...offGuard]) if (document.parent?.items?.has(document.id)) await document.delete();
  }
}

export async function guidedReaction(actor, item, targets) {
  if (!await confirm(item.name, "Confirm the feat's trigger is occurring now, before the triggering action resolves, and your reaction is available.")) return false;
  if (item.slug === "reactive-strike") {
    const [target] = targeted(targets);
    const reach = actor.getReach?.({ action: "attack" }) ?? actor.system.attributes.reach.base;
    if (activeTokenFor(actor).distanceTo(target.object) > reach) throw new Error("Target is outside melee reach.");
    const result = await strike(actor, item, target, { mode: "melee", noMap: true });
    if (!result) return false;
    return result.degree === 3 ? "Critical hit: disrupt if the trigger was a manipulate action. Resolve Strike damage." : "Reactive Strike rolled without MAP. Resolve damage normally.";
  }
  if (item.slug === "reactive-interference") {
    const [target] = targeted(targets);
    if (!adjacent(actor, target)) throw new Error("Target must be adjacent.");
    if (actorLevel(target.actor) <= actorLevel(actor)) return "Triggering reaction disrupted; GM stops it before resolving.";
    const result = await strike(actor, item, target, { noMap: true });
    return result ? (result.degree >= 2 ? "Attack roll succeeded: reaction disrupted. This roll deals no Strike damage." : "Attack roll failed: enemy reaction proceeds.") : false;
  }
  if (item.slug === "defensive-swap") {
    const [ally] = targeted(targets);
    if (!adjacent(actor, ally) || !ally.actor.isAllyOf?.(actor)) throw new Error("Target a willing adjacent ally.");
    if ([actor, ally.actor].some((a) => a.hasCondition("immobilized") || a.hasCondition("restrained") || a.hasCondition("grabbed"))) throw new Error("Both creatures must be able to move voluntarily.");
    const token = activeTokenFor(actor).document;
    if (token.width !== ally.width || token.height !== ally.height || token.elevation !== ally.elevation) {
      if (!await confirm(item.name, "Different footprints/elevations: place both tokens in rule-legal exchanged positions manually, then confirm.")) return false;
    } else {
      if (!await confirm(item.name, `${ally.name} is willing; exchange positions and redirect the triggering attack to the other creature?`)) return false;
      await canvas.scene.updateEmbeddedDocuments("Token", [{ _id: token.id, x: ally.x, y: ally.y }, { _id: ally.id, x: token.x, y: token.y }]);
    }
    return "Positions exchanged. Attacker must target the other creature before rolling; this workflow does not reroll an already-resolved attack.";
  }
  if (item.slug === "standard-bearers-sacrifice") {
    const [enemy] = targeted(targets);
    if (!await confirm(item.name, "Confirm this enemy targets an ally with a ranged attack, you observe both, and you are also in the attack's range.")) return false;
    const degree = await save(enemy.actor, actor, item);
    if (degree === null) return false;
    if (degree >= 2) return "Enemy's attack proceeds against the ally.";
    const effects = degree === 0 ? await effect(actor, actor, item, { rules: [{ key: "FlatModifier", selector: "ac", type: "circumstance", value: 2,
      predicate: [`origin:signature:${enemy.actor.signature}`] }] }) : [];
    try { await confirm(item.name, "Redirect the triggering attack to the commander and resolve it now. Continue after that attack."); }
    finally { for (const e of effects) if (actor.items.has(e.id)) await e.delete(); }
    return "Attack redirected to commander; temporary AC bonus ended.";
  }
  const [ally] = targeted(targets);
  if (!adjacent(actor, ally) || !ally.actor.isAllyOf?.(actor)) throw new Error("Shield Warden requires an adjacent ally.");
  if (!actor.hasCondition("shield-raised") && !actor.rollOptions?.all?.["self:shield:raised"]) {
    if (!await confirm(item.name, "Confirm your shield is currently raised.")) return false;
  }
  const shield = actor.heldShield;
  if (!shield || shield.isBroken || shield.isDestroyed) throw new Error("A usable held shield is required.");
  const amount = await numberInput(item.name, "Incoming physical damage after applicable immunity, weakness and resistance", { min: 0 });
  if (amount === null) return false;
  const remainder = Math.max(0, amount - Number(shield.hardness));
  await shield.update({ "system.hp.value": Math.max(0, shield.hitPoints.value - remainder) });
  await ally.actor.applyDamage({ damage: remainder, token: ally, skipIWR: true });
  return `Shield Block: prevented ${amount - remainder}; ${ally.name} and shield each take ${remainder}. Do not apply the original damage again.`;
}

export async function guidedShieldRecovery(actor, item, targets) {
  const [ally] = targeted(targets);
  if (!actor.heldShield || !adjacent(actor, ally) || !ally.actor.isAllyOf?.(actor)) throw new Error("Wield a shield and target an adjacent ally.");
  if (!await confirm(item.name, "Use Battle Medicine on this ally now. Resolve its check, healing and immunity normally, then continue.")) return false;
  await effect(ally.actor, actor, item, { rules: [{ key: "FlatModifier", selector: ["ac", "reflex"], type: "circumstance", value: 1 }], flags: { adjacentTo: activeTokenFor(actor).document.uuid } });
  return "Shielded Recovery applied; expires at your next turn or when adjacency ends.";
}

export async function guidedCompanion(actor, item, targets) {
  const [companion] = targeted(targets);
  if (!companion.actor.isAllyOf?.(actor)) throw new Error("Target your allied animal companion.");
  if (!await confirm(item.name, "Confirm this is the animal companion granted by this feat. Its progression and specialization should be configured on its companion sheet.")) return false;
  const attach = await confirm(item.name, "Attach the commander's banner to this companion? The module will use its space for banner range.");
  const mascot = hasFeat(actor, "peerless-mascot-companion") && await confirm(item.name, "Did you select the peerless mascot specialization (rather than another specialization)?");
  await actor.setFlag(FLAG_SCOPE, "companion", { actorUuid: companion.actor.uuid, tokenUuid: companion.uuid, banner: attach, mascot });
  const squad = actor.getFlag(FLAG_SCOPE, "squad") ?? [];
  if (!squad.some((m) => m.actorUuid === companion.actor.uuid)) await actor.setFlag(FLAG_SCOPE, "squad", [...squad, {
    actorUuid: companion.actor.uuid, tokenUuid: companion.uuid, name: companion.name, img: companion.actor.img,
  }]);
  const mode = await select(item.name, "Companion action (optional)", [
    { value: "done", label: "Finish setup" }, { value: "command", label: "Command an Animal: grant tactic reaction this turn" },
    ...(hasFeat(actor, "battle-hardened-companion") ? [{ value: "independent", label: "Independent Stride/Strike: cannot Command later this round" }] : []),
  ]);
  if (mode === "command" || mode === "independent") {
    if (mode === "independent" && !game.combat?.started) throw new Error("Independent Stride or Strike requires an active encounter.");
    const stamp = game.combat?.started ? `${game.combat.id}:${game.combat.round}` : null;
    const previous = companion.actor.getFlag(FLAG_SCOPE, "companionAction");
    if (stamp && previous?.stamp === stamp) throw new Error("Companion action already recorded this round; do not Command again.");
    if (mode === "command") {
      actor.sheet.render({ force: true });
      if (!await confirm(item.name, "Spend Command an Animal now and resolve any required check on the sheet, then continue.")) return false;
    }
    else {
      companion.actor.sheet.render({ force: true });
      await confirm(item.name, "Take one Stride or Strike from the companion's sheet now. It cannot receive Command an Animal later this round.");
    }
    await companion.actor.setFlag(FLAG_SCOPE, "companionAction", { stamp, mode, commanderUuid: actor.uuid });
    await effect(companion.actor, actor, item, { expiry: "turn-end", rounds: 0,
      description: "One extra reaction for this commander's tactics, lost at the end of the current turn.", flags: { companionReaction: true } });
  }
  return "Companion linked and exempted from squad capacity. Banner placement and reaction guidance configured.";
}

export async function guidedRevival(actor, item, targets) {
  const [target] = targeted(targets);
  const key = "resuscitation-immunity";
  if (Number(target.actor.getFlag(FLAG_SCOPE, key)) > now()) throw new Error("Target is immune to Desperate Resuscitation for 1 day.");
  if (!await confirm(item.name, "GM: confirm target died within 3 rounds, body mostly intact, no death effect, toolkit/free-hand requirements met, and Raise Dead can return this creature.")) return false;
  const roll = await actor.getStatistic("medicine").roll({ dc: { value: 40 }, extraRollOptions: ["action:desperate-resuscitation"] });
  if (!roll) return false;
  await target.actor.setFlag(FLAG_SCOPE, key, now() + 86400);
  if (roll.degreeOfSuccess < 2) return "Revival failed; target immune for 1 day.";
  const wounded = Number(target.actor.getCondition("wounded")?.value ?? 0);
  await effect(target.actor, actor, item, { name: "Desperate Resuscitation recovery", seconds: 604800,
    rules: ["clumsy", "drained", "enfeebled"].map((slug) => ({ key: "GrantItem", inMemoryOnly: true, uuid: CONDITION_UUIDS[slug],
      alterations: [{ mode: "override", property: "badge-value", value: 2 }] })),
    description: "Clumsy 2, drained 2, enfeebled 2 for one week; these cannot be reduced or removed before recovery ends." });
  await target.actor.update({ "system.attributes.hp.value": 1 });
  await target.actor.decreaseCondition("dying", { forceRemove: true });
  await target.actor.increaseCondition("wounded", { value: wounded + 1 });
  if (target.actor.statuses?.has("dead")) await target.actor.toggleStatusEffect("dead", { active: false });
  target.actor.sheet.render({ force: true });
  await confirm(item.name, "On the revived creature's sheet, expend prepared spells, spell slots, Focus Points and other daily pools as Raise Dead requires. Retain long-term debilitations. Continue after recording them.");
  await chat(actor, item.name, "Returns with 1 HP. Clear prepared spells, available slots, pools and other daily resources on the sheet; retain long-term debilitations. One-week recovery penalties applied. Wounded preserved and increased by 1.");
  return "Creature revived; HP and wounded updated, immunity recorded.";
}
