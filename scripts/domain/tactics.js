import { SYSTEM_EFFECTS } from "../constants.js";

const manual = (selection, instruction, options = {}) => ({
  selection,
  response: { kind: "manual", instruction },
  ...options,
});
const guided = (selection, instruction, options = {}) => ({ selection, response: { kind: "guided", instruction }, ...options });

const sequence = (selection, instruction, steps, options = {}) => ({
  selection,
  response: { kind: "sequence", instruction, steps, reaction: options.reaction === true },
  ...options,
});

const move = (allowance, options = {}) => ({ kind: "movement", allowance, modes: "land", relation: "free", ...options });
const target = (type) => ({ kind: "target", target: type });
const strike = (mode = "any") => ({ kind: "strike", mode });
const actionChoice = (choices, label = "Granted action") => ({ kind: "action-choice", label, choices });

export const TACTICS = Object.freeze({
  "defensive-retreat": sequence("all", "Use up to three Steps, finishing farther from at least one observed hostile.", [
    move(5, { relation: "away-from-enemy" }),
    move(5, { relation: "away-from-enemy" }),
    move(5, { relation: "away-from-enemy" }),
  ], { aura: true }),
  "gather-to-me": {
    selection: "all",
    response: {
      kind: "gather-to-me",
      reaction: true,
      instruction: "Use the guided movement planner to end inside the banner aura, or as close as your Speed allows.",
    },
  },
  "mountaineering-training": { selection: "all", response: { kind: "effect", uuid: SYSTEM_EFFECTS.mountaineeringTraining, instruction: "Gain a 20-foot climb Speed for this movement." } },
  "naval-training": { selection: "all", response: { kind: "effect", uuid: SYSTEM_EFFECTS.navalTraining, instruction: "Gain a 20-foot swim Speed for this movement." } },
  "passage-of-lines": { selection: "all", aura: true, response: { kind: "swap", instruction: "Target one adjacent willing ally, then exchange positions." } },
  "protective-screen": sequence("one", "Target an allied squadmate in the banner aura, then Stride directly toward them and finish adjacent.", [
    move("full", { relation: "toward-target", target: "ally", squadmate: true, targetInAura: true, requireAdjacent: true }),
  ], { reaction: true }),
  "shadows-in-the-moonlight": {
    selection: "all",
    aura: true,
    response: {
      kind: "shadows-in-the-moonlight",
      instruction: "Track Following the Expert for Hide or Sneak and ignore noisy armor until the commander's next turn. If issued with 2 actions, choose up to two squadmates to Hide or Sneak manually as a free action.",
    },
  },
  "coordinating-maneuvers": sequence("one", "Target an adjacent enemy, Step if desired, then attempt to Reposition it.", [
    move(5, { target: "enemy", requireAdjacent: true }),
    { kind: "action", slug: "reposition", label: "Reposition" },
  ], { aura: true, reaction: true }),
  "double-team": sequence("one", "Target an enemy in reach, then Shove or Reposition it.", [
    target("enemy"),
    actionChoice([
      { kind: "action", slug: "shove", label: "Shove" },
      { kind: "action", slug: "reposition", label: "Reposition" },
    ], "Setup maneuver"),
  ]),
  "end-it": sequence("all", "Target an observed enemy, Step directly toward it, then target all enemies within 10 feet of responders for resolution.", [
    move(5, { relation: "toward-target", target: "enemy" }),
  ], { aura: true, resolve: { save: "will", effect: "end-it", traits: ["emotion", "fear", "mental"], options: ["area-effect", "inflicts:fleeing", "inflicts:frightened"], geometry: { withinAny: 10 } } }),
  "pincer-attack": sequence("all", "Step, then target enemies adjacent to at least one responder for scoped off-guard resolution.", [
    move(5),
  ], { reaction: true, resolve: { effect: "pincer-attack", geometry: { withinAny: 5 } } }),
  "reload": { selection: "all", response: { kind: "reload", instruction: "Interact to reload one held weapon using compatible carried ammunition." } },
  "shields-up": { selection: "all", aura: true, response: { kind: "raise-shield", instruction: "Raise a Shield. Parry and shield-cantrip alternatives remain player-selected." } },
  "strike-hard": { selection: "one", aura: true, response: { kind: "strike", reaction: true, instruction: "Strike with a ready weapon or unarmed attack." } },
  "tactical-takedown": sequence("up-to-2", "Target the shared enemy, then Stride up to half Speed and finish adjacent.", [
    move("half", { target: "enemy", requireAdjacent: true }),
  ], { aura: true, reaction: true, resolve: { save: "reflex", effect: "tactical-takedown", maxTargets: 1, minParticipants: 2, geometry: { adjacentToAll: true } } }),

  "alley-oop": guided("one", "Choose an eligible consumable and receiver. The GM transfers it; the receiver confirms catching and activates it from the sheet." , { aura: true }),
  "buckle-cut-blitz": sequence("up-to-2", "Stride up to your Speed. After all movement, target every enemy that was adjacent at any point and resolve Reflex saves.", [
    move("full"),
  ], { aura: true, reaction: true, resolve: { save: "reflex", effect: "buckle-cut-blitz" } }),
  "demoralizing-charge": sequence("up-to-2", "Target an observed enemy, Stride directly toward it, finish adjacent, then make a melee Strike.", [
    move("full", { relation: "toward-target", target: "enemy", requireAdjacent: true }),
    strike("melee"),
  ], { aura: true, reaction: true, resolve: { save: "will", effect: "demoralizing-charge", penaltyEffectUuid: SYSTEM_EFFECTS.demoralizingCharge, traits: ["emotion", "fear", "mental"], options: ["inflicts:frightened"], maxTargets: 2, geometry: { withinAny: 5 } } }),
  "seek-and-destroy": { selection: "up-to-2", aura: true, response: { kind: "seek", instruction: "Seek, then choose Point Out, movement toward an observed enemy, or a Strike." } },
  "slip-and-sizzle": {
    selection: "two",
    aura: true,
    designatedTarget: "enemy",
    response: {
      kind: "slip-and-sizzle",
      reaction: true,
      instruction: "Choose roles: the adjacent responder Trips the designated target; on success, the other casts a damaging ranged spell of 2 actions or fewer and becomes slowed 1 if a slot or Focus Point was spent.",
    },
  },
  "stupefying-raid": sequence("up-to-2", "Stride up to your Speed. After all movement, target every enemy that was adjacent at any point and resolve Will saves.", [
    move("full"),
  ], { aura: true, reaction: true, resolve: { save: "will", effect: "stupefying-raid", traits: ["mental"], options: ["inflicts:stupefied"] } }),
  "take-the-high-ground": sequence("one", "Target an observed allied squadmate, Stride directly toward them, finish adjacent, then Leap.", [
    move("full", { relation: "toward-target", target: "ally", squadmate: true, requireAdjacent: true }),
    { kind: "manual", instruction: "Leap up to 25 feet horizontally or 15 feet vertically (40/25 with legendary Warfare Lore)." },
  ], { aura: true, reaction: true }),
  "the-bigger-they-are": { selection: "one", aura: true, response: { kind: "effect-and-maneuver", uuid: SYSTEM_EFFECTS.biggerTheyAre, instruction: "Gain the tactic bonus, then Reposition, Shove, or Trip the chosen larger enemy; adjacent squadmates may assist." } },
  "wait-for-it": { selection: "up-to-2", aura: true, response: { kind: "wait-for-it", instruction: "Gain +1 circumstance bonus to AC and saves while Delaying or Readying, subject to the tactic's early-ending clauses." } },

  "bloody-guillotine": sequence("up-to-3", "Target the designated enemy, Stride up to half Speed directly toward it, then Trip or make a melee Strike.", [
    move("half", { relation: "toward-target", target: "enemy", requireAdjacent: true }),
    actionChoice([
      { kind: "action", slug: "trip", label: "Trip" },
      { kind: "strike", mode: "melee", label: "Melee Strike" },
    ]),
  ], { aura: true, reaction: true, designatedTarget: "enemy", resolve: { effect: "bloody-guillotine", maxTargets: 1 } }),
  "corpse-crenellation": sequence("up-to-2", "Target the designated enemy, Stride up to half Speed, then make a Strike.", [
    target("enemy"),
    move("half"),
    strike(),
  ], { aura: true, reaction: true, designatedTarget: "enemy", resolve: { effect: "corpse-crenellation", maxTargets: 1 } }),
  "mirrored-wall": {
    selection: "all",
    aura: true,
    response: { kind: "raise-shield", instruction: "Raise a Shield or cast shield. After choosing the reflecting squadmate, target the enemy and resolve its Fortitude save." },
    resolve: { save: "fortitude", effect: "mirrored-wall", penaltyEffectUuid: SYSTEM_EFFECTS.mirroredWall, maxTargets: 1, geometry: { withinCommander: 60 } },
  },
  "piranha-assault": {
    selection: "all",
    aura: true,
    designatedTarget: "creature",
    targetInAura: true,
    response: {
      kind: "piranha-assault",
      instruction: "Gain a 1-minute target-linked reminder: attacks against the designated creature ignore resistance equal to the commander's level when their damage type is resisted.",
    },
  },
  "pop-drop-and-lock": sequence("up-to-3", "Target the shared enemy, then choose one still-unused Strike, Trip, or Grapple option.", [
    target("enemy"),
    actionChoice([
      { kind: "strike", mode: "any", label: "Strike" },
      { kind: "action", slug: "trip", label: "Trip" },
      { kind: "action", slug: "grapple", label: "Grapple" },
    ]),
  ], { aura: true, reaction: true, designatedTarget: "enemy" }),
  "ready-aim-fire": sequence("up-to-3", "Target the designated enemy, optionally reload, then make a ranged Strike.", [
    target("enemy"),
    { kind: "reload", optional: true },
    strike("ranged"),
  ], { aura: true, reaction: true, designatedTarget: "enemy" }),
  "roaring-charge": sequence("all", "Target an observed enemy, Stride up to twice Speed directly toward it, then resolve enemies within 10 feet of responders.", [
    move("double", { modes: "all", relation: "toward-target", target: "enemy" }),
  ], { aura: true, reaction: true, resolve: { save: "will", effect: "roaring-charge", target: "creature", traits: ["emotion", "fear", "incapacitation", "mental"], options: ["inflicts:frightened", "inflicts:fleeing"], incapacitation: true, geometry: { withinAny: 10 } } }),

  "cry-havoc": sequence("all", "Target the designated enemy and Stride up to twice Speed directly toward it. Resolve adjacent enemies from the rules card.", [
    move("double", { modes: "all", relation: "toward-target", target: "enemy" }),
  ], { aura: true, reaction: true, designatedTarget: "enemy", resolve: { effect: "cry-havoc" } }),
  "executioners-volley": sequence("all", "Target the designated enemy and make a ranged Strike. Keep damage unapplied until the volley is combined.", [
    target("enemy"),
    strike("ranged"),
  ], { aura: true, reaction: true, designatedTarget: "enemy", resolve: { effect: "executioners-volley", maxTargets: 1 } }),
  "for-talmandor-for-freedom": guided("all", "Choose an eligible effect and its counteract DC/rank. Roll Warfare Lore and remove the selected source on success.", { aura: true }),
  "insta-ballista": sequence("all", "Stride into a formation where every participant is within 10 feet of every other participant, then verify the custom Strike's target and bonus.", [
    move("full"),
  ], { aura: true, designatedTarget: "enemy", resolve: { effect: "insta-ballista", maxTargets: 1, geometry: { pairwiseWithin: 10, withinCommander: 200 } } }),
  "sanguine-revitalization": sequence("all", "Target the designated creature, Stride up to half Speed, then make an eligible piercing or slashing melee Strike. Resolve only if it took damage; target it once after all Strikes.", [
    move("half", { relation: "toward-target", target: "creature", requireInReach: "piercing-slashing-melee" }),
    strike("piercing-slashing-melee"),
  ], { aura: true, reaction: true, requirement: "piercing-slashing-melee", designatedTarget: "creature", excludeDesignatedTarget: true, targetInAura: true, resolve: { save: "fortitude", effect: "sanguine-revitalization", target: "creature", penaltyEffectUuid: SYSTEM_EFFECTS.sanguineRevitalization, options: ["damaging-effect", "inflicts:bleed"], maxTargets: 1 } }),
  "valkyries-charge": sequence("all", "Restore 80 HP, target an observed enemy, Stride up to twice Speed directly toward it, then make a melee Strike if in reach.", [
    { kind: "heal", amount: 80 },
    move("double", { modes: "all", relation: "toward-target", target: "enemy", requireInReach: "melee" }),
    strike("melee"),
  ], { aura: true, reaction: true }),
});

export function tacticDefinition(slug) {
  return TACTICS[slug] ?? manual("all", "Resolve this tactic from its PF2e rules text. Participation and round limits are still tracked.");
}

export function isTacticItem(item) {
  return item?.system?.traits?.value?.includes("tactic") === true;
}
