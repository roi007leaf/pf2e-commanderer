# Commander feat feasibility: first 22 feats

Research only; no implementation. Rules verified against installed PF2e 8.5.0 compendium, extracted to `C:/Users/User/AppData/Local/Temp/commander-feats-audit.json`. Native item UUIDs below are exact primary implementation sources. Public upstream reference: [Foundry PF2e](https://github.com/foundryvtt/pf2e). Current upstream master does not contain the installed Commander feat files at guessed paths; do not invent file URLs. Feasibility is implementation judgment, not evidence of existing module support.

| Feat | Mechanics and possible support | Limits / native implementation |
|---|---|---|
| Adaptive Stratagem | Initiative-triggered prompt to exchange one prepared expert, mobility, or offensive tactic for another folio tactic. | No native RE. Restrict outgoing category, preserve preparation count, prompt once per initiative event. |
| Armored Regiment Training | Heavy armor counts 1 Bulk lighter; rest in armor; ignore armor Speed penalties for party exploration travel. | No native RE. Bulk adjustment feasible; travel integration requires exploration-specific calculation, never global combat Speed increase. Rest permission mostly informational. |
| Banner Twirl | One action; commander and adjacent allies gain concealment against ranged attacks until commander's next turn. | No native RE. Feasible targeted roll/flat-check support with adjacency and expiry. Generic concealed condition would incorrectly affect melee attacks. Brandish requirements apply. |
| Banner's Inspiration | Reduce frightened 1 for benefiting allies; each may retry one mental-effect save; participants who save gain 10-minute immunity. | No native RE. Frightened reduction and immunity easy. User selects effect; missing original DC/outcome data requires GM entry; failed-save consequences must recur. Brandish/flourish/visual/emotion/mental. |
| Battle-Hardened Companion | Companion becomes nimble/savage; may independently Stride/Strike once on commander's turn and gain tactic-only reaction; cannot then be Commanded that round. | No native RE. Reaction/action tracking feasible with linked companion; stat advancement needs companion subsystem or manual actor setup. |
| Battle-Tested Companion | Companion becomes mature; banner affixed to companion gains +10 feet aura. | No native RE. Radius modifier easy after companion origin exists; companion maturation delegated to companion tooling. |
| Combat Assessment | Melee Strike; hit grants Recall Knowledge, critical hit grants +2; target immune 1 day. | Native conditional +2 FlatModifier exists (`critical-assessment`). Workflow can sequence Strike, secret knowledge roll, immunity. GM controls DC/questions/false information. |
| Commander's Companion | Young companion can carry banner and becomes aura origin; always squadmate, excluded from squad cap. Command an Animal grants tactic-only reaction expiring end of commander turn. | No native RE. Link existing companion actor, redirect origin, exclude cap, track reaction. Building companion stats is separate subsystem. |
| Confusing Commands | Two actions; enemies in banner aura make Will vs class DC; fail confused 1 round, critical fail 2; successes immune 1 day. | No native RE. Saves, conditions, timed immunity highly automatable. Confused behavior/target choices remain player/GM decisions. Auditory/mental; no incapacitation trait in installed source. |
| Contact With the Enemy | Adaptive Stratagem additionally allows replacement of prepared master/legendary tactics from folio. | No native RE. Extend existing preparation prompt; no separate button needed. Exact scope wording says "any" master/legendary tactics; do not silently impose lower-tier one-swap wording without resolving interpretation. |
| Deceptive Tactics | Warfare Lore substitutes for Deception on Create a Diversion/Feint and qualifying proficiency prerequisites; grants Lengthy Diversion. | Native GrantItem and Warfare Lore action links already cover much. Optional action integration; prerequisite substitution needs sheet/character-builder cooperation. |
| Defensive Swap | Reaction before attack resolves: swap with adjacent willing ally; swap attack target. | No native RE. Position swap and target reassignment feasible through explicit prompt. Reliable universal pre-attack interception difficult; require trigger before roll. Prone allowed; grabbed/immobilized/otherwise unable to move not allowed. |
| Defiant Banner | One action; commander and allies currently in aura gain B/P/S resistance equal to Int until commander next turn. | Existing feat-effect reusable. Snapshot recipients at activation, not persistent aura membership. Brandish/flourish/manipulate/visual. |
| Demand Surrender | Two actions; require outnumbering enemies and recent allied restraint/0-HP event. Will: success bars hostility toward commander 1 round; failure also fleeing 1; critical failure drops held items, prone, no hostility toward team 1 minute or until team attacks. | No native RE. Saves/incapacitation/conditions/durations feasible. Battlefield membership, historical trigger, hostile intent, surrender roleplay require confirmation. |
| Desperate Resuscitation | Three actions; DC40 Medicine on mostly intact creature dead <=3 rounds, not death-effect killed. Success Raise Dead effects but pre-death wounded +1; target immune 1 day regardless. | No native RE. Check and immunity easy; death timing, cause, old wounded, body state, willingness/Raise Dead details require recorded data or GM input. |
| Drilled Reflexes | Drilled Reactions grants extra reaction to up to two allies rather than one. | No native RE. Replace per-round boolean with per-commander recipient count/set; coordinate higher Practiced Reflexes cap. |
| Efficient Preparation | Increase prepared tactics cap by one. | No native RE. Straight automatic cap modifier; parent reports module already handles this. |
| Fortunate Blow | After Guiding Shot/Set-Up Strike actually damages enemy, next other creature's attack against same target before commander next turn rolls twice, keeps higher. | Native feat only appends description; native effect exists. Hook damage confirmation and consume target-scoped benefit once; do not trigger on hit with zero damage. Modify existing attack action, no extra button. |
| Glorious Banner | 60-foot carried emanation /80-foot planted burst; fear Will bonus +2; allies +1 AC/Fort/Reflex; enemies seeing banner -2 Will. | Native Aura with ally/enemy effects and glorious-banner tag exists. Module must preserve effects and visibility checks while moving origin/altering radius; parent reports planted implementation currently loses them. |
| Guiding Shot | One-action ranged Strike; next other creature's attack on target before commander next turn gains +1 circumstance (+2 on critical hit). | Existing feat-effect reusable. Workflow requires target-scoped next-attacker consumption, not blanket party buff; flourish. |
| Mercenary Reversal | Two actions while outnumbered; Will: critical success immune24h, success stunned1, failure controlled through battle with saves on damage or unnatural orders; critical failure additionally gives wealth after combat. | No native RE. Saves, condition, temporary allegiance and damage retry prompt feasible; unnatural orders, actual control/roleplay and tribute require GM. Incapacitation applies. Avoid automatic permanent ownership transfer. |
| Observational Analysis | If target attacked by commander/ally with Strike/spell since commander last turn, Combat Assessment Recall Knowledge gains +2 (+4 critical Strike). | Native RollOption + AdjustModifier handles upgraded critical bonus. Track eligible target history and pass proper options to same Combat Assessment workflow. GM still adjudicates knowledge. |

## Exact native sources

- Adaptive Stratagem: `Compendium.pf2e.feats-srd.Item.44pzixSVmRQiUoba`
- Armored Regiment Training: `Compendium.pf2e.feats-srd.Item.sebJQz7jABxL0pQS`
- Battle-Hardened Companion: `Compendium.pf2e.feats-srd.Item.ollJpDIYG2z8oSm1`
- Battle-Tested Companion: `Compendium.pf2e.feats-srd.Item.x2a3Qb5pWj6Bgu6a`
- Combat Assessment: `Compendium.pf2e.feats-srd.Item.5FyvwI24mnROzh61`
- Commander's Companion: `Compendium.pf2e.feats-srd.Item.cxWEBBu8oyKTrqbi`
- Defensive Swap: `Compendium.pf2e.feats-srd.Item.l3YdGb3S9f4dVdUz`
- Fortunate Blow: `Compendium.pf2e.feats-srd.Item.xdqSgSfybmBOCw5q`; effect `Compendium.pf2e.feat-effects.Item.x9xNnTl1sRGCqthu`
- Guiding Shot: `Compendium.pf2e.feats-srd.Item.3OHdjgDGn4yzMD9b`; effect `Compendium.pf2e.feat-effects.Item.21pCT4n3Aixyvp4h`
- Defiant Banner effect: `Compendium.pf2e.feat-effects.Item.Zy7rrPCgMTeSzKj9`
- Glorious Banner ally effect: `Compendium.pf2e.feat-effects.Item.JZWi6512m9RlMrNO`; enemy effect `Compendium.pf2e.feat-effects.Item.8x5T5e5Gzh3NJ86H`

All 22 names correspond to exact records in the extraction; remaining exact IDs can be resolved there by `system.slug` without ambiguity. Screenshot's "Armor Regiment Training" is installed feat "Armored Regiment Training".

- Banner Twirl: Compendium.pf2e.feats-srd.Item.9L0iFYeSCMvrzme4
- Confusing Commands: Compendium.pf2e.feats-srd.Item.ABPDBNWvhJRWB86m
- Contact With the Enemy: Compendium.pf2e.feats-srd.Item.FaNRkgN6q2QTXCmk
- Drilled Reflexes: Compendium.pf2e.feats-srd.Item.Fen0uXQLiKRDP4ui
- Banner's Inspiration: Compendium.pf2e.feats-srd.Item.L2mQO4q8nPdUDVjO
- Deceptive Tactics: Compendium.pf2e.feats-srd.Item.MuhskZsUcN6g8QK6
- Glorious Banner: Compendium.pf2e.feats-srd.Item.TrE7lZdKLrWzbyoZ
- Efficient Preparation: Compendium.pf2e.feats-srd.Item.UvQjCHNAQVhKvTWb
- Demand Surrender: Compendium.pf2e.feats-srd.Item.XmjvHxW5f7vKFIv7
- Desperate Resuscitation: Compendium.pf2e.feats-srd.Item.ZO37MZEQVNNtg46b
- Observational Analysis: Compendium.pf2e.feats-srd.Item.bYyou5TjkCmzoizu
- Mercenary Reversal: Compendium.pf2e.feats-srd.Item.dCGg0nRvk8jUQxz8
- Defiant Banner: Compendium.pf2e.feats-srd.Item.eAEq2FVnneuvOYUD
