# PF2e Commanderer

[![Foundry VTT 14](https://img.shields.io/badge/Foundry_VTT-14-7b2c2c)](https://foundryvtt.com/)
[![PF2e 8.4+](https://img.shields.io/badge/PF2e-8.4%2B-31537a)](https://github.com/foundryvtt/pf2e)
[![Validation](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml/badge.svg)](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/roi007leaf/pf2e-commanderer)](https://github.com/roi007leaf/pf2e-commanderer/releases/latest)

High-automation support for Pathfinder Second Edition's **Commander** class. Commanderer turns squad setup, banner positioning, tactic orders, player responses, guided movement, and automated aftermaths into one shared Foundry workflow.

Designed around one principle: automate everything reliable, keep table rulings easy to override.

## Highlights

- One professional command panel opened from an owned Commander token or actor sheet.
- Live squad, aura, banner, preparation, and tactic readiness updates without reopening the panel.
- Carried and planted banner origins with native PF2e aura-effect synchronization.
- Plant Banner temporary HP renewal plus adjacent-enemy controls to pull the standard down or carry it away.
- Expandable tactic briefings with enriched PF2e rules and trait explanations.
- Responsive squadmate-card selection for exact, limited, and all-responder tactics.
- Shared, owner-aware chat cards: each player controls their own squadmate response.
- Terrain-aware movement planning with Speed, direction, adjacency, reach, and formation validation.
- Native PF2e actions, Strikes, reloads, effects, saves, conditions, healing, and target resolution where supported.
- Explicit player, Commander-owner, and GM escape hatches when automation does not match a table ruling.
- Optional [PF2e Dailies](https://foundryvtt.com/packages/pf2e-dailies) integration; no required module dependencies.

## Compatibility

| Component | Supported version |
| --- | --- |
| Foundry Virtual Tabletop | 14 |
| Pathfinder Second Edition | 8.4.0 or newer |
| PF2e Dailies | Optional |

## Installation

In Foundry's **Setup** screen:

1. Open **Add-on Modules**.
2. Click **Install Module**.
3. Paste this manifest URL:

```text
https://github.com/roi007leaf/pf2e-commanderer/releases/latest/download/module.json
```

4. Install, then enable **PF2e Commanderer** in your PF2e world.

## Quick start

1. Place a Commander actor's token on the active scene.
2. Right-click the owned token and press the gold flag in its Token HUD. The **Commander** actor-sheet header button opens the same panel.
3. Display the banner. If the Commander has **Plant Banner**, use **Plant**, choose a token corner, then retrieve it from the same panel when finished. An owned enemy token adjacent to the standard gets a red crossed-flag Token HUD control to remove it with Interact.
4. Open **Manage** under Squad. Add allied scene tokens, add nearby allies, or replace the roster from current targets.
5. Prepare tactics. When PF2e Dailies is active, use **Prepare in Dailies**; otherwise Commanderer manages preparation directly.
6. Expand tactic titles to review responder count, signal reach, readiness, traits, and full PF2e rules.
7. Press **Issue**, choose responder cards, then let each owning player answer from the shared chat order.

## Banner workflow

| State | Origin and area | Tactic behavior |
| --- | --- | --- |
| Displayed | Commander token; native 30-foot aura | Visual or auditory signals; Brandish allowed |
| Stowed | No active aura | Banner-dependent tactics unavailable |
| Planted | Chosen token corner; persistent 40-foot burst | Carried aura disabled; auditory signals only; Brandish unavailable |
| Pulled down | Original planted point | Every benefit inactive until retrieval |
| Taken | Enemy carrier token; follows its movement | Every benefit inactive; adjacent recovery uses a GM-ruled Commander check |

The planted standard is stored on the scene and rendered on the canvas. Native Commander's Banner effects follow the planted burst immediately as allied tokens enter or leave it. An adjacent enemy can pull it down in place or take it away; deleting a carrier token drops the banner at its last position. To recover a carried banner, the Commander moves adjacent and presses **Recover**. The GM chooses Disarm, Grapple, an Athletics DC, any custom statistic/defense pair, or manual success. **Rolling player** defaults to an active non-GM Commander owner, so the native PF2e check opens and posts from that player's client. Success restores the carried aura and origin.

## Tactic workflow

### Before issuing

Each tactic reports:

- required responder count;
- whether responders must be inside the banner aura;
- currently eligible squadmates;
- action cost, frequency, preparation state, and tactic traits;
- designated target requirements.

Exact-one tactics use exclusive squadmate cards. Limited responder tactics use multi-select cards. “All squadmates” tactics show every eligible responder preselected.

### Player responses

Each selected squadmate receives their own row on the shared chat card. Their actor owner can:

- **Respond** using normal automation;
- use **Drilled** when the Commander's once-per-round extra reaction is eligible;
- choose **Manual** to complete the response outside Commanderer;
- **Decline** the signal.

Movement responses activate and focus the correct token, then start Foundry's movement planner. Drag the token along the intended route. Commanderer validates the completed path against the tactic instead of guessing where the player wanted to move.

### Resolution

Shared-target tactics record the Commander's current target when issued. After squad responses, target only creatures affected by the completed formation and press **Resolve targeted creatures**.

Supported aftermaths validate target count and geometry, then use PF2e saves, roll options, conditions, effects, and immunity rules. Resolution can run only once.

## Multiplayer permissions and overrides

| User | Available control |
| --- | --- |
| Squadmate owner | Respond, Drilled when eligible, Manual, or Decline for owned actors |
| Commander owner | Issue tactics and resolve or hand off automated aftermaths |
| GM | Act for any participant, run authority-required effects, and use geometry override |

Overrides remain visible on the shared order:

- **Manual** skips response automation but still reserves that creature's tactic response for the round.
- **Handle manually** closes automated aftermath resolution without changing targets, rolls, conditions, or effects.
- **Resolve anyway** is GM-only. It bypasses formation and distance checks while retaining target relationship, target-count, save, and effect automation.

## Automation coverage

Commanderer's catalog provides tactic-specific mechanical or guided workflows for **35 of PF2e 8.4's 37 tactics**. Coverage includes:

- preparation, frequency, signal, banner, aura, responder-count, and once-per-round response rules;
- Drilled Reaction tracking;
- carried and planted banner origins;
- Plant Banner's immediate and turn-start temporary HP, hostile Interact removal, carried-banner tracking, and GM-ruled Commander recovery checks;
- shared designated targets and responder roles;
- half-, full-, double-, and fixed-Speed movement;
- direct-toward, retreat, adjacency, reach, area, and close-formation validation;
- filtered melee/ranged Strikes, reload capacity, maneuvers, token swaps, healing, saves, conditions, and duration tracking;
- active-GM socket authority for cross-user document changes.

### Tactic-by-tactic automation

Every tactic below also receives preparation, frequency, signal, audience, responder ownership, one-response-per-round, Drilled Reaction, chat-card, decline, and manual-override handling.

- **Automated:** Commanderer performs supported PF2e actions, effects, rolls, or aftermath after required user choices.
- **Guided:** Commanderer drives targets, paths, and action choices, then validates supported constraints; listed table decisions remain manual.
- **Tracked:** Commanderer records the rule state or applies a reminder effect while the table adjudicates the remaining outcome.
- **Manual:** Commanderer validates and tracks the order, but does not guess the mechanical result.

#### Mobility tactics

| Tactic | Mode | Shipped automation |
| --- | --- | --- |
| **Defensive Retreat** | Guided | Gives every eligible responder up to 15 feet of planned Step movement and requires the destination to finish farther from at least one observed hostile. |
| **Gather to Me!** | Guided | Reads available movement modes, activates Foundry's terrain-aware planner, enforces Speed, and requires the best reachable destination inside or nearest the banner aura. |
| **Mountaineering Training** | Automated | Grants PF2e's native 20-foot climb Speed effect to each responder. Warfare Lore substitution remains a normal PF2e roll choice. |
| **Naval Training** | Automated | Grants PF2e's native 20-foot swim Speed effect to each responder. Warfare Lore substitution remains a normal PF2e roll choice. |
| **Passage of Lines** | Guided | Validates an adjacent willing ally and swaps equal-footprint tokens atomically. Unequal sizes or elevations retain manual square placement. |
| **Protective Screen** | Guided | Selects one responder and an allied squadmate in the aura, then guides a full direct Stride ending adjacent. Follow-up protection follows the tactic's rules text. |
| **Shadows in the Moonlight** | Tracked | Applies a Following the Expert/noisy-armor reminder effect; supports one- or two-action use and lets up to two chosen responders invoke PF2e Hide or Sneak. |

#### Offensive tactics

| Tactic | Mode | Shipped automation |
| --- | --- | --- |
| **Coordinating Maneuvers** | Guided | Guides the optional Step, validates adjacency to the chosen enemy, then invokes PF2e Reposition. |
| **Double Team** | Guided | Selects the setup target and invokes PF2e Shove or Reposition. Adjacency after the maneuver and the second squadmate's reaction Strike remain table-confirmed. |
| **End It!** | Automated | Guides Steps toward an observed enemy, validates affected enemies within 10 feet of responders, rolls Will saves, then applies fleeing and frightened. |
| **Pincer Attack** | Automated | Guides each responder's Step, validates affected adjacent enemies, then applies a temporary off-guard rule scoped to melee attacks from the Commander and actual responders. |
| **Reload!** | Automated | Finds held reloadable weapons and compatible accessible ammunition, presents valid pairs, then performs PF2e ammunition attachment. Siege loading remains manual. |
| **Shields Up!** | Guided | Invokes PF2e Raise a Shield for each responder. Parry-weapon and shield-cantrip alternatives remain player-selected. |
| **Strike Hard!** | Automated | Filters available Strikes, lets the responder choose one, then rolls it through PF2e. |
| **Tactical Takedown** | Automated | Guides up to two half-Speed Strides, requires two responders adjacent to one target, rolls its Reflex save, and applies prone on failure. |

#### Expert tactics

| Tactic | Mode | Shipped automation |
| --- | --- | --- |
| **Alley-oop** | Manual | Tracks eligible responder, aura, signal, frequency, and round use. Receiver choice, free hand, item transfer, and consumable activation stay table-confirmed. |
| **Buckle-Cut Blitz** | Automated | Guides up to two full-Speed Strides; after users target enemies passed adjacent to, rolls Reflex saves and applies clumsy 1 or 2. |
| **Demoralizing Charge** | Automated | Guides direct full-Speed movement ending adjacent, rolls filtered melee Strikes, validates affected enemies, rolls Will saves, and applies frightened 1 or 2. |
| **Seek and Destroy** | Guided | Invokes PF2e Seek, then offers Point Out, guided movement toward an observed enemy, a Strike, or finish. |
| **Slip and Sizzle** | Guided | Locks one designated target, assigns Trip and spellcaster roles, invokes PF2e Trip first, then opens the caster's spell workflow. Spell qualification, Trip success, and slowed timing remain player-confirmed. |
| **Stupefying Raid** | Automated | Guides up to two full-Speed Strides; after users target enemies passed adjacent to, rolls Will saves and applies stupefied 1 or 2. |
| **Take the High Ground** | Guided | Selects an allied squadmate, guides a direct full-Speed Stride ending adjacent, then presents the correct Leap allowance for manual placement. |
| **The Bigger They Are** | Automated | Grants PF2e's native tactic effect, then invokes the responder's chosen Reposition, Shove, or Trip. Assistant participation remains table-confirmed. |
| **Wait for It...** | Tracked | Applies the +1 circumstance bonus to AC and saves with duration tracking. Delay/Ready linkage and early removal remain player-controlled. |

#### Master tactics

| Tactic | Mode | Shipped automation |
| --- | --- | --- |
| **Bloody Guillotine** | Guided | Locks one designated enemy, guides up to three direct half-Speed moves ending adjacent, then invokes each responder's chosen Trip or melee Strike. Death-effect resolution remains manual. |
| **Corpse Crenellation** | Guided | Locks one designated enemy, guides up to two half-Speed moves, and rolls chosen Strikes. Corpse cover and later Take Cover movement remain table-tracked. |
| **Mirrored Wall** | Automated | Raises shields through PF2e, validates one target within 60 feet of the Commander, applies the native save modifier, rolls Fortitude, then applies blinded and critical-failure dazzled duration. Shield-cantrip and reflector choices remain player-confirmed. |
| **Piranha Assault** | Tracked | Locks a creature inside the banner aura and grants each responder a one-minute, target-linked resistance-bypass roll note equal to Commander level. |
| **Pop, Drop, and Lock** | Guided | Locks one designated enemy and invokes each chosen Strike, Trip, or Grapple response. Players keep the three responses unique as required by the tactic. |
| **Ready, Aim, Fire!** | Automated | Locks one designated enemy, optionally reloads valid weapons, filters ranged Strikes, and rolls each response. Cantrip substitution remains player-controlled. |
| **Roaring Charge** | Automated | Guides movement up to twice Speed directly toward an observed enemy, validates affected creatures within 10 feet of responders, rolls Will saves with incapacitation handling, then applies frightened and fleeing. |

#### Legendary tactics

| Tactic | Mode | Shipped automation |
| --- | --- | --- |
| **Cry Havoc!** | Guided | Locks the designated enemy and guides every responder up to twice Speed directly toward it. Adjacency damage, combined dice, and deafened results remain table-resolved. |
| **Executioner's Volley** | Guided | Locks one designated enemy, filters ranged Strikes, and rolls each response. Damage stays unapplied so the table can combine it before weaknesses and resistances. |
| **For Talmandor! For Freedom!** | Manual | Tracks audience, aura, signal, frequency, and round use. Each source effect and its authoritative counteract DC and rank remain table-selected. |
| **Insta-Ballista** | Guided | Locks one target, guides formation movement, verifies every responder within 10 feet of every other responder and target within 200 feet, then reports exact item bonus and 10d12 package. Custom Strike construction remains manual. |
| **Sanguine Revitalization** | Automated | Locks a creature in the aura, filters eligible piercing/slashing melee responders, guides half-Speed movement into reach, rolls Strikes and Fortitude save, applies persistent bleed, rolls shared 10d6 healing once, and heals qualifying squadmates. |
| **Valkyrie's Charge** | Automated | Restores up to 80 HP to each responder, guides movement up to twice Speed directly toward an observed enemy using available movement modes, requires melee reach, then rolls a melee Strike. |

See [Commander automation plan](docs/PLAN.md) for tactic-by-tactic coverage and planned expansions.

### Human-confirmed boundaries

Two tactics deliberately remain guided instead of guessed:

- **Alley-oop:** receiver willingness, free-hand state, cross-owner inventory transfer, and consumable activation.
- **For Talmandor! For Freedom!:** source-effect selection and authoritative counteract DC/rank.

Coordinated damage tactics also leave final damage application human-controlled when PF2e requires separate Strike results to be combined before weaknesses and resistances.

## Rules notes

- The Commander counts as one of their own squadmates for participating in or benefiting from tactics and does not consume a squad slot.
- A Commander cannot use free actions or reactions granted by a **Brandish** tactic unless that tactic specifically says otherwise.
- A squadmate can always decline a tactical signal.
- A creature cannot respond to more than one tactic per round, regardless of source.

Rules references: [Commander class](https://2e.aonprd.com/Classes.aspx?ID=66) and [Commander tactics](https://2e.aonprd.com/Tactics.aspx).

## Module API

```js
const commander = game.actors.get("ACTOR_ID");
const api = game.modules.get("pf2e-commanderer").api;

api.open(commander);
api.execute(commander.items.get("TACTIC_ITEM_ID"), commander);
```

## Development

```bash
npm ci
npm run lint
npm test
npm run check
```

Husky runs ESLint before commits and the full test suite before pushes. Pushes and pull requests run dependency installation, manifest validation, syntax checks, ESLint, and tests. Publishing a GitHub release whose tag matches `module.json` attaches an installable `module.json` and `module.zip`. Stable releases can also publish to Foundry's package API when `FVTT_API_TOKEN` is configured.

Bug reports and feature requests: [GitHub issues](https://github.com/roi007leaf/pf2e-commanderer/issues).
