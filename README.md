# PF2e Commanderer
[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/pf2e-commanderer?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/pf2e-commanderer/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/pf2e-commanderer/total)](https://github.com/roi007leaf/pf2e-commanderer/releases)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-commanderer)](https://forge-vtt.com/bazaar)
[![Validation](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml/badge.svg)](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml)
[![Foundry VTT 14](https://img.shields.io/badge/Foundry_VTT-14-7b2c2c)](https://foundryvtt.com/)
[![PF2e 8.4+](https://img.shields.io/badge/PF2e-8.4%2B-31537a)](https://github.com/foundryvtt/pf2e)

High-automation support for Pathfinder Second Edition's **Commander** class. Commanderer brings squad management, banner positioning, tactic orders, player responses, guided movement, and mechanical resolution into one shared Foundry workflow.

> Automate reliable rules. Keep table rulings easy to override.
<img width="1368" height="1444" alt="CleanShot 2026-08-26 at 13 19 56@2x" src="https://github.com/user-attachments/assets/29a43473-4643-432e-ac89-55f4fe89790d" />
<img width="960" height="742" alt="CleanShot 2026-08-26 at 13 20 48@2x" src="https://github.com/user-attachments/assets/0a958893-81a5-46c0-b1ee-ab6260909d59" />
<img width="1328" height="1184" alt="CleanShot 2026-08-26 at 13 22 30@2x" src="https://github.com/user-attachments/assets/2cbf0c26-4708-4d4f-9b67-a80cee9faa09" />


## Features

- Professional Commander panel opened from an owned token or actor sheet.
- Live squad, banner, aura, preparation, and tactic-readiness updates.
- Displayed, planted, fallen, and enemy-carried banner states on canvas.
- Plant Banner temporary HP, renewal, hostile removal, and recovery workflows.
- Plant automatically uses Claim the Field when the commander has the feat and the banner is attached to a thrown weapon under **Plant → Material → Affixed item**. **Map** allows any corner within its first range increment; both map placement and token-corner shortcuts gain the protective Will save. Enemy removal and sourced item damage resolve native incapacitation and one-round fleeing on critical failure. Damage without a source actor prompts for a manual ruling; direct HP edits remain GM adjudication.
- Expandable tactic rules, responder selection, trait explanations, and readiness checks.
- Owner-aware chat orders: each player controls their own squadmate.
- Terrain-aware movement guidance with Speed and formation validation.
- Native PF2e actions, Strikes, saves, conditions, effects, healing, and targeting where supported.
- Clear player, Commander-owner, and GM manual overrides.
- Optional [PF2e Dailies](https://foundryvtt.com/packages/pf2e-dailies) preparation integration.

## Requirements

| Component | Version |
| --- | --- |
| Foundry Virtual Tabletop | 14 |
| Pathfinder Second Edition | 8.4.0 or newer |
| PF2e Dailies | Optional |

## Installation

1. Open Foundry's **Add-on Modules** tab.
2. Select **Install Module**.
3. Paste this manifest URL:

   ```text
   https://github.com/roi007leaf/pf2e-commanderer/releases/latest/download/module.json
   ```

4. Install, then enable **PF2e Commanderer** in your PF2e world.

## Quick start

1. Place an owned Commander token on the active scene.
2. Open its Token HUD and press the gold flag, or use **Commander** in the actor-sheet header.
3. Display the banner; use **Plant** from the same panel when Plant Banner is available.
4. Open **Manage** under Squad and select allied scene tokens.
5. Prepare tactics directly or press **Prepare in Dailies** when PF2e Dailies is active.
6. Expand a tactic, press **Issue**, then choose its responders.
7. Each actor owner answers from the shared chat order; the Commander owner or GM resolves any aftermath.

### Banner objects and companions

- **Plant → Material** selects cloth, thin leather, thin wood, thin steel, or custom durability. An affixed inventory item supplies its HP/Hardness when greater. Configure AC for the object as adjudicated by the GM. Unusual items without PF2e durability data need custom values.
- **Plant → Map** highlights the commander's four legal corners; click to plant, or cancel with Escape/right-click. The corner buttons remain available. **Chat** posts the native Plant Banner rules as a reference, without triggering Summons Assistant or another item-use placement workflow.
- Planting creates a reusable PF2e hazard actor and a targetable token at the holder's elevation and scene level. Native damage application handles Hardness and object immunities. The weapon/pole gains level + Intelligence modifier Hardness while planted; affixed shields retain their own Hardness. Token damage persists between placements. **Banner actor** opens its properties; **Repair** lets the GM apply HP restored after resolving the Crafting check, capped at maximum HP. Inventory-item HP is not linked.
- Banner tokens use Foundry's native lock. Unlock to correct a misplaced banner; its stored origin follows the token. **Retrieve** and enemy interactions use the acting creature's unarmed Interact reach. **Force retrieve** lets the GM bypass reach and carried-banner recovery checks, including when the commander's token is missing; it does not heal the banner.
- Fortitude, Reflex, and Will have rollable +0 placeholders for save automation. A banner-only extension of PF2e's native degree adjustment resolves applicable saves as failures, including natural 1s and 20s. Banners remain hazards with native object immunities, Hardness, and HP/2 Broken Threshold. Reload all clients after updating; the active GM automatically upgrades existing banner saves without changing HP or placements. Immunity and whether an effect can target an object remain separate from its save result.
- Broken banners stop granting benefits. Theft or destruction applies frightened 1 to actors currently receiving that banner's bonus, without lowering an existing frightened value. Pulling down a banner ends benefits but is not theft. A destroyed banner cannot be retrieved; **Replace banner** is GM-only.
- An NPC within unarmed reach has a Token HUD flag control for **Take Banner** or **Pull Down**, and **Pick Up** for a dropped banner. GMs can use these controls regardless of the NPC's alliance; player-controlled actors must be enemies of the commander.
- **Squad → Limit** lets the GM override each commander's squad capacity. Blank restores the normal limit. A companion linked through its feat workflow is exempt from the normal capacity automatically. Lowering capacity keeps the existing roster, allowing the GM to remove excess members explicitly.

Post Commander's Companion to chat to link a companion, configure its banner origin and guide its command/reaction use. Companion progression remains on its sheet. Alley-oop handles its guided inventory transfer; inventory-item damage and whether an area effect affects an unattended object remain GM rulings. Enemy removal retains the feat's Interact action; it does not substitute Disarm, Grapple, or Trip. Existing planted overlays can be retrieved and replanted to create their object token.

## Documentation

Full documentation lives in the [project wiki](https://github.com/roi007leaf/pf2e-commanderer/wiki).

| Guide | Contents |
| --- | --- |
| [Installation](https://github.com/roi007leaf/pf2e-commanderer/wiki/Installation) | Requirements, updates, optional integration, troubleshooting |
| [Commander panel](https://github.com/roi007leaf/pf2e-commanderer/wiki/Commander-Panel) | Squad, preparation, status, and live controls |
| [Banner workflow](https://github.com/roi007leaf/pf2e-commanderer/wiki/Banner-Workflow) | Planting, temporary HP, hostile removal, carrying, and recovery |
| [Tactic workflow](https://github.com/roi007leaf/pf2e-commanderer/wiki/Tactic-Workflow) | Issuing, player responses, movement, and resolution |
| [Automation coverage](https://github.com/roi007leaf/pf2e-commanderer/wiki/Automation-Coverage) | Full tactic-by-tactic matrix and manual boundaries |
| [Permissions and overrides](https://github.com/roi007leaf/pf2e-commanderer/wiki/Permissions-and-Overrides) | Player ownership, GM authority, and escape hatches |
| [API and development](https://github.com/roi007leaf/pf2e-commanderer/wiki/API-and-Development) | Module API, validation, and release workflow |

## Automation coverage

All 37 Commander tactics receive shared preparation, frequency, signal, audience, ownership, round-use, chat-card, decline, and override handling.

- Existing tactic cards now include guided inventory transfer, counteract checks, spell alternatives, coordinated damage, death/fear aftermaths, cover, and follow-up attacks.
- Post an owned feat to chat to use its automation button. Guided follow-ups appear on the relevant feat or tactic card; Mercenary Reversal save retries appear on the affected actor's posted effect card.
- Feat buttons show progress and completion. Follow the open prompts; a GM's prompts stay on that GM's screen. Player requests requiring cross-actor changes go to the active GM.
- Tactic cards show the next step: every responder must **Respond**, **Decline**, or choose **Manual** after handling the action on their sheet. Then resolve affected targets or choose **Handle manually**. Finished cards show **Complete**.
- Owned passive feats automatically upgrade the existing reaction allowances, banner radii, preparation and attack workflows. Claim the Field upgrades **Plant** when the configured attachment is a thrown weapon.
- Guided workflows ask the GM to confirm triggers and choices, then perform supported rolls and document changes. Manual positioning, spell/item activation, knowledge answers, companion progression, and certain early-expiry/one-use toggles remain table-controlled.

The tables below describe **implemented support**, not complete automatic rules enforcement. **Passive upgrades** modify existing controls when the feat is owned. **Native PF2e** entries use the system's existing rules and character-building choices. Other entries run when you use the relevant chat button or respond to a tactic.

Movement automation means you drag a token through Foundry's planner; the module checks its movement allowance and applicable destination/formation requirements. It does not choose a path for you. Native Strike automation rolls the attack; apply its damage normally unless the workflow explicitly combines or applies damage. Perception, willingness, triggering events, and ordinary action/reaction expenditure still require the players or GM.

Jump to [feats](#feat-automation), [tactics](#tactic-automation), or [shared limits and follow-ups](#shared-limits-and-follow-ups).

### Feat automation

| Feat | Automated or assisted behavior | Guided or manual portion |
| --- | --- | --- |
| Adaptive Stratagem | Initiative prompt and replacement of a prepared tactic from the folio; integrates with Dailies selections. | Confirm timing and choose the replacement; restore normal preparations during daily preparation. |
| Armored Regiment Training | Passive heavy-armor Bulk reduction; exploration travel/rest guidance. | Adjudicate group travel and resting in armor. |
| Banner Twirl | Grants adjacent eligible allies ranged-concealment reminders; chat follow-up rolls the DC 5 flat check. | Invoke the flat check before an affected ranged attack and resolve whether concealment applies. |
| Banner's Inspiration | Reduces frightened; guides a new save against a selected mental effect, effect removal, and retry immunity. | Select the original effect, save/DC, and appropriate consequences. |
| Battle-Hardened Companion | Adds independent Stride/Strike guidance and tactic-reaction effect; prevents Command after an independent action in the same round. | Configure nimble/savage progression and perform the companion's action on its sheet. |
| Battle-Tested Companion | Passively increases the banner radius while attached to the linked companion. | Configure mature companion progression on its sheet. |
| Claim the Field | Upgrades the existing Plant control for a configured thrown attachment; ranged placement and protective Will-save workflow for hostile removal/sourced damage. | Configure the attachment; adjudicate item damage without a source actor and unusual targeting. |
| Combat Assessment | Native melee Strike, Recall Knowledge follow-up, applicable bonus and target immunity. | Supply the knowledge skill/DC and GM answer; confirm prior-target eligibility. |
| Commander's Companion | Links a companion, exempts it from squad capacity, supports an attached banner origin, and guides Command/reaction use. | Build the companion, resolve Command an Animal, and spend its granted reaction. |
| Confusing Commands | Finds enemy recipients in the aura, rolls saves, applies confusion and records immunity where applicable. | Confirm signal perception and resolve confused behavior. |
| Contact with the Enemy | Passively expands Adaptive Stratagem's eligible preparation replacements. | Use the Adaptive Stratagem workflow. |
| Deceptive Tactics | Rolls Feint or Create a Diversion using Warfare Lore; offers distracting words, gesture, or trick. | Choose the action/method and resolve its native outcome. |
| Defensive Swap | Exchanges equal-footprint adjacent allies' token positions after confirmation. | Redirect the triggering attack before it rolls; place unequal-footprint/elevation swaps manually. |
| Defiant Banner | Applies native physical-resistance effects to eligible recipients. | Confirm recipients can perceive the signal. |
| Demand Surrender | Rolls Will, applies fleeing/prone and surrender reminders, and drops held items on critical failure. | Confirm battle prerequisites; enforce hostile-action restrictions and their ending conditions. |
| Desperate Resuscitation | Medicine DC 40, daily target immunity, 1 HP, increased wounded, removal of dying/dead, and seven-day recovery penalties on success. | Confirm death eligibility/tool requirements; clear daily resources on the revived actor's sheet. |
| Drilled Reflexes | Passively raises Drilled Reaction allowance to two; shared reservations prevent overspending and refund cancelled responses. | Choose **Drilled** on the response card. |
| Efficient Preparation | Passively increases the module's tactic preparation capacity. | Choose prepared tactics; Dailies handles its own preparation UI when installed. |
| Fortunate Blow | Adds fortune to the selected next-attack opening after confirmed damage. | Start the opening follow-up before the next eligible attack. |
| Glorious Banner | Passively upgrades carried, planted, and applicable companion/mascot aura radii. | Normal banner positioning and eligibility. |
| Guiding Shot | Native Strike; records a target-specific opening and applies its bonus to a chosen next attack. | Invoke **Resolve next attack opening** and confirm no eligible attack intervened. |
| Mercenary Reversal | Will save, stunned/control effects, immunity, and repeat-save follow-up that removes control on success. | Adjudicate allegiance, against-nature commands, tribute, and repeat-save triggers. |
| Observational Analysis | Passively upgrades Combat Assessment's knowledge follow-up. | Confirm relevant targeting history and resolve knowledge answers. |
| Officer's Education | Uses native PF2e skill/general-feat choices rather than duplicating grants. | Choose language and verify skill ranks; PF2e 8.5.0's first trained-skill rule needs manual correction. |
| Officer's Medical Training | Uses native Medicine training, Intelligence substitution, and Battle Medicine grant. | Choose a replacement skill manually if already trained in Medicine. |
| Peerless Mascot Companion | Adds the linked mascot's second aura and upgraded combined radius when the banner is attached. | Configure specialization statistics, Speeds, traits, HP, language, and Warfare Lore on the companion sheet. |
| Pennant of Victory | Applies native modifiers and 40 temporary HP; tracks cooldown. | Confirm eligible recipients and signal perception. |
| Perfected Evaluations | Passively raises Rapid Assessment's check limit to six. | Choose checks, skills, targets and DCs; GM supplies knowledge answers. |
| Plant Banner | Creates a targetable banner object; manages aura/temp HP, durability, hostile removal, frightened consequences, repair and retrieval. | Resolve repair checks and unusual object/area-effect interactions. |
| Practiced Reflexes | Passively raises Drilled Reaction allowance to four, replacing lower allowances. | Choose **Drilled** on the response card. |
| Quickening Banner | Applies quickened effects and tracks cooldown. | Use only the permitted extra action. |
| Rallying Banner | Rolls level-scaled healing, applies it to eligible recipients, and tracks cooldown; halves healing outside encounters. | Confirm eligible recipients and signal perception. |
| Rapid Assessment | Initiative prompt and native secret knowledge checks, with limits upgraded by its later feats. | Select observed creatures, skills and DCs; GM supplies answers. |
| Reactive Interference | Checks adjacency; reports automatic disruption against eligible lower/equal-level enemies or rolls against a higher-level enemy. | Invoke before the reaction resolves; GM stops it if disrupted. The attack-roll branch deals no Strike damage. |
| Reactive Strike | Native reaction Strike without MAP. | Confirm trigger/reaction availability; apply native damage and disruption consequences. |
| Set-Up Strike | Native melee Strike; records a target-specific opening and applies off-guard for the selected ally's next attack. | Invoke the opening follow-up before the next eligible attack. |
| Shield Warden | Applies shield Hardness, remaining shield damage and ally HP damage once. | Confirm the trigger/raised shield and enter incoming damage after other reductions; do not apply the original damage again. |
| Shielded Recovery | Applies AC/Reflex protection after Battle Medicine; removes it when adjacency ends or duration expires. | Perform Battle Medicine's normal check, healing and immunity handling first. |
| Standard-Bearer's Sacrifice | Enemy Will save, guided attack redirection, and temporary AC bonus with cleanup on critical failure. | Confirm targeting/range and redirect the original attack before resolving it. |
| Tactical Expansion | Uses native PF2e tactic choices and grants, with tier eligibility. | Make the native folio choices. |
| Targeting Strike | Adds target-specific precision damage to the selected opening after confirmed damage from Guiding Shot/Set-Up Strike. | Resolve follow-up damage before closing the workflow. |
| Unrivaled Analysis | Passively raises Rapid Assessment's check limit to four. | Choose checks and resolve knowledge answers. |
| Unsteadying Strike | Native melee Strike and maneuver-specific DC penalty effect. | Apply native Strike damage normally. |

### Tactic automation

Every tactic below also receives the shared order, ownership, response, and completion handling described above.

| Tactic | Automated or assisted behavior | Guided or manual portion |
| --- | --- | --- |
| Alley-oop | Transfers one selected consumable/ammunition item through GM authority; declined catch records it as dropped in the receiver's inventory. | Confirm catch/free hand/reaction and activate or load the item from the receiver's sheet. |
| Bloody Guillotine | Half-Speed approach, Trip/melee Strike choice, death save, death-state update and witness sickened saves. | Pause at the first damaging hit against the prone target; confirm death eligibility and witnesses. Aftermath is not an automatic mid-attack interrupt. |
| Buckle-cut blitz | Speed-limited movement, selected enemies' Reflex saves and clumsy effects. | Target enemies that were adjacent at any point along the path. |
| Coordinating Maneuvers | Step planning followed by native Reposition. | Select the target and resolve the maneuver's movement. |
| Corpse Crenellation | Half-Speed movement and Strike/cantrip choice; grants position-linked corpse-cover effects after the target falls. | Confirm the fallen target; use native Take Cover and resolve any extra movement. |
| Cry Havoc! | Double-Speed approach; typed bludgeoning/sonic damage, basic Fortitude saves, deafened and daily immunity. | Confirm which selected enemies were adjacent along a participant's path. |
| Defensive Retreat | Up to three separate 5-foot Step plans with retreat-destination validation. | Drag each desired Step; confirm observed hostile creatures. |
| Demoralizing Charge | Direct approach, melee Strike, native penalty choice, Will saves and frightened effects. | Resolve Strike damage and select the appropriate aftermath penalty. |
| Double Team | Native Shove/Reposition; guided successful-maneuver follow-up with a different adjacent squadmate's melee Strike. | Confirm maneuver success and the follow-up ally's eligibility/reaction. |
| End it! | Step toward an enemy, nearby-target validation, Will saves and fear conditions. | Select affected enemies after movement. |
| Executioner's Volley | Ranged Strike or guided cantrip; combines entered damage by type, applies immunity/weakness/resistance once, and resolves death-triggered fear saves. | Roll participant damage without applying it, enter combined totals, and confirm whether the target died. |
| For Talmandor! For Freedom! | Warfare Lore counteract check and removal of the selected source on success. | Choose eligible effect, counteract DC/ranks and any source-specific consequences. |
| Gather to Me! | Native movement-mode/Speed planning; validates an ending inside the aura or as close as Speed allows. | Drag the desired path toward the banner. |
| Insta-Ballista | Movement and crew formation/range validation; temporary ballista Strike, assist bonus and cleanup. | Confirm assembly, crew/Bulk requirements, target and native damage. |
| Mirrored Wall | Native Raise a Shield or guided shield casting; Fortitude save, selected penalty and blind/dazzled effects. | Choose the reflecting squadmate/penalty and resolve any spellcasting on the sheet. |
| Mountaineering Training | Native climb-Speed effect; prepared commander's chat follow-up can roll Climb using Warfare Lore. | Perform the movement and any other required checks. |
| Naval Training | Native swim-Speed effect; prepared commander's chat follow-up can roll Swim using Warfare Lore. | Perform the movement and any other required checks. |
| Passage of Lines | Swaps equal-footprint adjacent willing allies' tokens through GM authority. | Confirm willingness; unequal-footprint swaps need manual placement. |
| Pincer Attack | Step planning and nearby-target validation; off-guard AC effect applies only to melee attacks from the commander/responders. | Target the affected enemies after movement. |
| Piranha Assault | Target-linked benefit and guided resistance-bypass calculator; applies corrected damage once. | Target the attacker for the posted tactic's follow-up; enter normal final damage and resistance prevented by type before applying damage. |
| Pop, Drop, and Lock | Shared target and native Strike, Trip or Grapple choice. | Coordinate the still-unused action choices between responders; uniqueness is not enforced across clients. |
| Protective Screen | Direct approach to a squadmate in the aura; adjacent-ally protection with duration and adjacency cleanup. | Choose the protected ally; adjudicate whether a triggering reaction is prevented. |
| Ready, Aim, Fire! | Shared target, optional native reload and ranged Strike; guided damaging-cantrip alternative. | Cast cantrips from the sheet and apply native damage normally. |
| Reload! | Selects a held reloadable weapon and compatible accessible ammunition; loads one ammunition item. | Choose the weapon/ammunition pairing. |
| Roaring Charge | Double-Speed approach, nearby-target validation, Will saves with incapacitation, frightened and fleeing. | Select affected creatures and resolve their fleeing behavior. |
| Sanguine Revitalization | Half-Speed approach, eligible piercing/slashing melee Strike, Fortitude save, persistent bleed, shared 10d6 healing and target-linked penalty. | Confirm the target took damage and resolve Strike damage before the aftermath. |
| Seek and Destroy | Native Seek, guided newly observed target benefit, and Point Out/approach/Strike follow-up; target-specific precision effect. | Confirm what became observed; disable precision after the next successful Strike's damage. Misses do not consume it. |
| Shadows in the Moonlight | Following the Expert effects, guide-rank choice, noisy-armor benefit, and one-/two-action responder handling; Warfare Lore Hide/Sneak shortcut. | Resolve selected free Hide/Sneak actions and visibility outcomes. |
| Shields Up! | Native Raise a Shield; guided Parry or shield-cantrip alternative. | Apply Parry or cast shield through the actor sheet. |
| Slip and Sizzle | Assigns Trip/spell roles, rolls native Trip, gates the spell response, and applies slowed/resource reminders when appropriate. | Confirm Trip success, cast the spell from the sheet and report whether a slot/Focus Point was spent. |
| Strike Hard! | Native weapon or unarmed Strike, with normal/Drilled response handling. | Select the attack and apply native damage normally. |
| Stupefying Raid | Speed-limited movement, selected enemies' Will saves and stupefied effects. | Target enemies that were adjacent at any point along the path. |
| Tactical Takedown | Half-Speed approach, two-responder adjacency validation, Reflex save and prone effect. | Select the shared enemy and plot each responder's movement. |
| Take the High Ground | Direct approach to a squadmate, guided Leap allowance and landing-distance validation. | Choose horizontal/vertical Leap and a legal landing position. |
| The Bigger They Are | Native tactic-bonus effect and Reposition/Shove/Trip choice. | Confirm larger-target eligibility and assistance; choose the appropriate native bonus. |
| Valkyrie's Charge | Restores up to 80 HP, then guides movement and native melee Strike. | Plot movement, choose the attack and apply native damage normally. |
| Wait For It... | Guarded-stance AC/save bonus controlled by a posture toggle. | Confirm Delay/Ready eligibility; turn the toggle off when acting or another ending condition occurs. |

### Shared limits and follow-ups

- Post **Guiding Shot** or **Set-Up Strike**, then use **Resolve next attack opening** before the next eligible attack. Keep the workflow open through that attack's damage so temporary benefits can be cleaned up afterward.
- Post **Banner Twirl** for its ranged-concealment flat check, **Piranha Assault** for its resistance-bypass calculator, or a prepared training tactic for its Warfare Lore shortcut. Post the affected actor's **Mercenary Reversal effect** for a retry save.
- Player requests that change other actors require an active GM with Commanderer loaded. That GM completes prompted steps; the requesting player receives the result. Reload all clients after updating.
- Native character-building support is not duplicated. In PF2e 8.5.0, verify Officer's Education's first trained skill manually, choose its language, and choose Officer's Medical Training's replacement skill when applicable. Companion progression and specialization statistics remain on the companion sheet.
- Sight/hearing, narrative prerequisites, damage-trigger timing, certain early endings, and one-use/posture toggles remain table-controlled. **Manual** and **Handle manually** complete tracking without running the skipped automation.

See [workflow details](notes/automation-workflows.md), the [43-feat/37-tactic validation matrix](notes/full-live-audit.md), and [separate player/GM socket verification](notes/player-socket-live-validation.md) for exact tested coverage. The published wiki may lag behind this README.

## Rules references

- [Commander class](https://2e.aonprd.com/Classes.aspx?ID=66)
- [Commander tactics](https://2e.aonprd.com/Tactics.aspx)
- [Plant Banner](https://2e.aonprd.com/Feats.aspx?ID=7796)
- [Item damage and object immunities](https://2e.aonprd.com/Rules.aspx?ID=2160)

## Development

```bash
npm ci
npm run check
npm run lint
npm test
```

Husky validates commits and pushes. GitHub Actions validates every push and pull request, builds release assets, and can publish stable releases to Foundry.

Bug reports and feature requests: [GitHub issues](https://github.com/roi007leaf/pf2e-commanderer/issues).

## License

PF2e Commanderer is licensed under the [GNU General Public License version 3](LICENSE).
