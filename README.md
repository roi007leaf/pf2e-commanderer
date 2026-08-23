# PF2e Commanderer

High-automation support for the Pathfinder Second Edition Commander class on Foundry VTT 14 and PF2e 8.4+.

## Current workflow

1. Right-click an owned Commander token and click the gold flag in its Token HUD. The **Commander** character-sheet header button opens the same panel.
2. Display or stow the native PF2e Commander's Banner aura from the panel header. Commanders with **Plant Banner** can choose any corner of their token from the same header; planting disables the carried aura, moves the native banner effect to allies inside the Scene's gold 40-foot burst, and **Retrieve** restores the aura to the Commander.
3. Open **Manage squad** to discover allied tokens on the scene, see who is inside the banner aura, add nearby allies, or replace the roster from current targets. The Commander is always a squadmate and does not consume a slot.
4. Prepare tactics. When PF2e Dailies is active, Commanderer reads its Commander preparation and opens Dailies for changes. Otherwise, preparation is stored by this module.
5. Each tactic shows its responder rule, signal reach, and currently ready squadmates. Click its title for native PF2e rules or **Issue** to choose a legal signal and responders.
6. Each owning player answers from the shared chat card. Native actions/effects run on that player's actor. Movement tactics highlight and control the responder token; drag it to plot Foundry's terrain-aware path. Commanderer enforces Speed, direction, adjacency, reach, and formation constraints defined by that tactic. If the automation does not fit the table's ruling, the owner can choose **Manual** and complete the response outside the module while preserving round tracking.
7. Shared-target tactics lock the Commander's current canvas target into the order so every responder acts against the same creature. For area aftermaths, the Commander targets only affected creatures and clicks **Resolve targeted creatures**. The active GM validates final geometry, rolls saves, and applies supported outcomes once. The Commander owner can hand resolution back to the table with **Handle manually**; a GM can use **Resolve anyway** to skip only formation and distance checks while retaining target and effect automation.

No dependency is required. PF2e Dailies integration is optional.

## Automation boundary

The module has tactic-specific mechanical or guided workflows for 35 of the 37 tactics in PF2e 8.4. It automates state, carried/planted banner origin, target identity, range, participant roles and limits, round limits, preparation, frequency, native actions, filtered Strikes, reloads, effects, saves, conditions, healing, guided movement, final geometry, and multi-user authority.

Two boundaries remain deliberately confirmed by people: **Alley-oop** transfers and activates another owner's consumable, while **For Talmandor! For Freedom!** needs a source effect's real counteract DC and rank. Commanderer still tracks their signal, audience, frequency, responses, and rules card without guessing those values.

Automation is advisory, never a lock. Every response offers an explicit manual completion path, automated aftermaths can be closed without applying anything, and GM geometry overrides are visibly recorded on the shared card. Target-count and enemy/creature safeguards remain active during **Resolve anyway**.

## Releases

GitHub Actions runs syntax checks and tests on pushes and pull requests. Publishing a GitHub release whose tag matches `module.json` (with or without a leading `v`) attaches an installable `module.json` and `module.zip`. Add the repository secret `FVTT_API_TOKEN` to also publish stable releases to Foundry VTT's package API.

See [docs/PLAN.md](docs/PLAN.md) for the architecture and expansion matrix.
