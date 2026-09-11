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
- Planting creates a reusable PF2e hazard actor and a targetable token. Native damage application handles Hardness and object immunities. The weapon/pole gains level + Intelligence modifier Hardness while planted; affixed shields retain their own Hardness. Token damage persists between placements. Use **Object** to inspect HP or let the GM repair it.
- Broken banners stop granting benefits. Theft or destruction applies frightened 1 to actors currently receiving that banner's bonus, without lowering an existing frightened value. Pulling down a banner ends benefits but is not theft. A destroyed banner cannot be retrieved; **Replace banner** is GM-only.
- An adjacent NPC's Token HUD has a flag control for **Take Banner** or **Pull Down**, and **Pick Up** for a dropped banner. GMs can use these controls regardless of the NPC's alliance; player-controlled actors must be enemies of the commander.
- **Squad → Limit** lets the GM override each commander's squad capacity. Increase it by one and add the Commander's Companion as a squadmate. Blank restores the normal limit. Lowering capacity keeps the existing roster, allowing the GM to remove excess members explicitly.

The companion option is a squad-capacity workaround; companion reaction grants and mounting the banner on the companion remain manual. Inventory transfers, inventory-item damage, and whether an area effect affects an unattended object remain GM rulings. Enemy removal retains the feat's Interact action; it does not substitute Disarm, Grapple, or Trip. Existing planted overlays can be retrieved and replanted to create their object token.

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

- **16 automated** tactics perform supported PF2e actions, rolls, effects, or aftermaths.
- **16 guided** tactics drive choices and movement, then validate supported constraints.
- **3 tracked** tactics apply rule state or reminders while the table handles the outcome.
- **2 manual** tactics retain full order tracking without guessing table-dependent mechanics.

See the [complete automation matrix](https://github.com/roi007leaf/pf2e-commanderer/wiki/Automation-Coverage).

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
