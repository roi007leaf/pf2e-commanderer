# PF2e Commanderer
[![Latest Version](https://img.shields.io/github/v/release/roi007leaf/pf2e-commanderer?display_name=tag&sort=semver&label=Latest%20Version)](https://github.com/roi007leaf/pf2e-commanderer/releases/latest)
[![GitHub all releases](https://img.shields.io/github/downloads/roi007leaf/pf2e-commanderer/total)](https://github.com/roi007leaf/pf2e-commanderer/releases)
[![Forge Installs](https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https%3A%2F%2Fforge-vtt.com%2Fapi%2Fbazaar%2Fpackage%2Fpf2e-commanderer)](https://forge-vtt.com/bazaar)
[![Validation](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml/badge.svg)](https://github.com/roi007leaf/pf2e-commanderer/actions/workflows/release.yml)
[![Foundry VTT 14](https://img.shields.io/badge/Foundry_VTT-14-7b2c2c)](https://foundryvtt.com/)
[![PF2e 8.4+](https://img.shields.io/badge/PF2e-8.4%2B-31537a)](https://github.com/foundryvtt/pf2e)

High-automation support for Pathfinder Second Edition's **Commander** class. Commanderer brings squad management, banner positioning, tactic orders, player responses, guided movement, and mechanical resolution into one shared Foundry workflow.

> Automate reliable rules. Keep table rulings easy to override.

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

PF2e Commanderer is source-visible proprietary software. Its [license](LICENSE)
permits installing and running an unmodified copy for tabletop gameplay, but
does not permit code or asset reuse, modification, redistribution, or
derivative works without written permission.
