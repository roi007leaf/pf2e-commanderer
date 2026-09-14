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

### Banner objects and companion workaround

- **Plant → Material** selects cloth, thin leather, thin wood, thin steel, or custom durability. An affixed inventory item supplies its HP/Hardness when greater. Configure AC for the object as adjudicated by the GM. Unusual items without PF2e durability data need custom values.
- **Plant → Map** highlights the commander's four legal corners; click to plant, or cancel with Escape/right-click. The corner buttons remain available. **Chat** posts the native Plant Banner rules as a reference, without triggering Summons Assistant or another item-use placement workflow.
- Planting creates a reusable PF2e hazard actor and a targetable token at the holder's elevation and scene level. Native damage application handles Hardness and object immunities. The weapon/pole gains level + Intelligence modifier Hardness while planted; affixed shields retain their own Hardness. Token damage persists between placements. **Banner actor** opens its properties; **Repair** lets the GM apply HP restored after resolving the Crafting check, capped at maximum HP. Inventory-item HP is not linked.
- Banner tokens use Foundry's native lock. Unlock to correct a misplaced banner; its stored origin follows the token. **Retrieve** and enemy interactions use the acting creature's unarmed Interact reach. **Force retrieve** lets the GM bypass reach and carried-banner recovery checks, including when the commander's token is missing; it does not heal the banner.
- Fortitude, Reflex, and Will have rollable +0 placeholders for save automation. A banner-only extension of PF2e's native degree adjustment resolves applicable saves as failures, including natural 1s and 20s. Banners remain hazards with native object immunities, Hardness, and HP/2 Broken Threshold. Reload all clients after updating; the active GM automatically upgrades existing banner saves without changing HP or placements. Immunity and whether an effect can target an object remain separate from its save result.
- Broken banners stop granting benefits. Theft or destruction applies frightened 1 to actors currently receiving that banner's bonus, without lowering an existing frightened value. Pulling down a banner ends benefits but is not theft. A destroyed banner cannot be retrieved; **Replace banner** is GM-only.
- An NPC within unarmed reach has a Token HUD flag control for **Take Banner** or **Pull Down**, and **Pick Up** for a dropped banner. GMs can use these controls regardless of the NPC's alliance; player-controlled actors must be enemies of the commander.
- **Squad → Limit** lets the GM override each commander's squad capacity. Increase it by one and add the Commander's Companion as a squadmate. Blank restores the normal limit. Lowering capacity keeps the existing roster, allowing the GM to remove excess members explicitly.

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

See [local workflow coverage and remaining boundaries](notes/automation-workflows.md) and the [43-feat/37-tactic validation matrix](notes/full-live-audit.md). The published wiki may describe the previous release until these changes ship.

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
