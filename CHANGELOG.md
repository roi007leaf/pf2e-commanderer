# Changelog

## Unreleased

## 1.3.0

- Add required live-test mappings for every Commander feat and tactic, native GM/player workflow checks, and per-feature evidence reports.
- Keep Commander Recall Knowledge checks private on Foundry 14 by using the current native message mode.

- Check banner eligibility before native token visibility when rendering the banner overlay. Tokens without a banner no longer run expensive sight/detection checks; visible, hidden and planted banner behavior remains covered by regression tests. Verified alongside Visioner in three fresh-browser 100-token/25-light performance runs.

## 1.2.0

- Style posted feat buttons consistently with tactic cards and show running, cancelled, and completed states. Add explicit next-step and completion guidance to tactic cards.
- Keep interactive GM workflows on the requesting GM's screen instead of opening their dialogs on another GM's client.
- Fix live-tested movement path measurement and sequential Steps, Alley-oop item transfers, Desperate Resuscitation's week-long effect duration, Create a Diversion variants, and The Bigger They Are's maneuver choices. Correct companion action tracking outside encounters and reject Brandish while a companion carries the banner.
- Move active feat controls from the Commander panel onto posted feat chat cards, with guided follow-ups and owner/GM access checks.
- Fix live-tested Commander workflow integration: preserve dialog stacking during panel refresh, pass native Strike targets/options, use PF2e Note rules, retain noisy-armor benefits, and apply heavy-armor Bulk through supported overrides. Keep adjacency cleanup correct during animated movement.
- Add active Commander feat workflows, automatic passive upgrades, companion banner integration, and guided reaction/knowledge/attack follow-ups.
- Extend tactic cards with guided inventory transfers, counteract checks, coordinated damage and aftermaths, defensive alternatives, and source-scoped benefits. Document remaining table-controlled steps.
- Upgrade Plant Banner automatically for Claim the Field when the configured attachment supports thrown placement.
- Verify player feat requests, tactic responses, guided transfers, token swaps, target resolution, and Drilled Reaction cancellation/refund across separate player and GM sessions.

## 1.1.1

- Add GM force retrieval to bypass banner reach and recovery checks, including stale placements with a missing commander token.
- Rename Object to Banner actor and add a GM Repair button to apply restored HP after resolving the Crafting check.
- Preserve the holder's elevation and scene level when planting or dropping a banner.
- Use Foundry's native token lock for banners, allowing manual placement corrections after unlocking while keeping the banner's stored origin synchronized.
- Use unarmed Interact reach for PC and NPC banner retrieval and enemy interactions.
- Make banner saves rollable and resolve them as failures through a banner-only extension of PF2e's native save adjustment. Preserve hazard Hardness, object immunities, and HP/2 Broken Threshold; automatically upgrade existing banners without changing their HP or placement.

## 1.1.0

- Plant banners as targetable objects with configurable materials, HP, AC, and Hardness, including affixed item statistics and Plant Banner's bonus Hardness. Damage persists when retrieving and replanting; GMs can replace destroyed banners.
- Add direct map placement alongside the existing corner buttons, plus a chat button for the Plant Banner rules without triggering duplicate summons.
- Stop banner benefits when broken or destroyed, and apply frightened 1 to benefiting creatures when the banner is stolen or destroyed.
- Let GMs use NPCs to take adjacent banners, and prevent banner objects from being accidentally added to combat.
- Add a GM squad limit override as a workaround for Commander's Companion.
- Fix overlapping banner effect cleanup that could report a missing item after retrieving a banner.
- Restrict Plant Banner temporary HP to allies, including effects and renewals from PF2e Summons Assistant.
- Improve banner controls and include banner artwork in release downloads.

## 1.0.9

- Keep Commander tactic messages opaque by resolving the Foundry parchment texture from a stable route and retaining a solid fallback when the texture is unavailable.

## 1.0.8

- Register tactic chat ownership controls before Foundry hydrates existing chat history so player-specific button visibility survives a browser refresh.

## 1.0.7

- Hide tactic response controls from players who do not own the responding squadmate while preserving shared response status for everyone and full GM control.

## 1.0.6

- Clear managed 40-foot Plant Banner effects before restoring the native 30-foot Commander aura, preventing distant allies from retaining banner benefits after retrieval.

## 1.0.5

- Replace silent socket-operation failures and vague timeouts with immediate, actionable errors for missing GM handlers, inactive GMs, and unresponsive authority clients.

## 1.0.4

- Route Plant Banner and normal banner retrieval through active-GM socket authority so owned players can use Scene-backed banner controls without Scene update permission errors.

## 1.0.3

- Let adjacent owned enemies pick up a fallen banner from their Token HUD and carry it again, with live Drop/Pick Up control swapping plus ownership and adjacency validation.

## 1.0.2

- Let an owned banner carrier release the taken banner from its Token HUD, dropping it at the carrier's current position while keeping banner benefits inactive until retrieval.
- License PF2e Commanderer under GNU GPL version 3.

## 1.0.1

- Grant and renew Plant Banner's temporary Hit Points for eligible allies, including turn-start renewal and immediate cleanup when the banner falls.
- Let adjacent owned enemies pull a planted banner down or take it with them, disabling every banner benefit until retrieval.
- Track taken banners on their carrier token, center the canvas marker above the carrier, and drop the banner at the carrier's last position when its token is deleted.
- Add GM-ruled carried-banner recovery with Disarm, Grapple, Athletics, custom PF2e checks, and explicit manual success.
- Route recovery rolls to the selected active Commander owner instead of the adjudicating GM, with stale-state and adjacency validation before retrieval.
- Fix PF2e Dailies 4.x tactic preparation by using its global API and current Commander tactic flag path while retaining manual preparation.

## 1.0.0

- Add Commander squad and prepared-tactic panel.
- Add Commander Token HUD flag button for owned Commander tokens.
- Add direct Deploy/Stow Banner control to the Commander panel.
- Add Plant Banner and Retrieve controls to the Commander panel, with four rule-legal token-corner choices.
- Persist planted standards on the Scene, render their 40-foot burst on canvas, and use that point for squad and Gather range.
- Disable the Commander's carried PF2e aura while planted, synchronize its native base effect from the planted burst, and restore the carried aura on retrieval.
- Enforce auditory-only tactics and reject Brandish tactics while a banner is planted.
- Redesign the Commander panel as a polished command center with compact status metrics, squad cards, and clearer tactic states.
- Keep the Commander panel synchronized live while preserving its scroll position and expanded tactic details.
- Add integrated allied-token squad discovery, nearby-aura suggestions, and capacity-safe roster management.
- Show tactic-specific responder selection, signal reach, and live squad readiness before issuing.
- Replace responder checkboxes with an accessible squadmate-card grid, omit the Commander from squad responses, and allow actor owners to answer their own tactics.
- Redesign tactic chat messages as compact command briefs with responsive responder controls and clear progress states.
- Add expandable tactic titles with enriched PF2e rules text, action cost, available uses, and PF2e trait tooltips.
- Add a professional canvas banner indicator using PF2e's native aura origin and radius.
- Keep banner canvas guidance text-free to avoid collisions with token distance and status tooltips.
- Fix banner corner controls clipping beneath the panel header.
- Apply planted-banner effects on the first qualifying movement and prevent cleanup races with PF2e-owned aura effects.
- Automate Gather to Me! with Foundry's terrain-aware movement planner, movement-mode selection, and enforced aura destination.
- Make Gather movement mode unmistakable with a responder-token canvas cue, explicit drag instructions, forced token-layer activation, and planner-start validation.
- Fix Foundry v14 tactic and response-choice dialogs failing on submit.
- Add shared, owner-aware tactic response cards.
- Keep response outcomes concise by omitting internal movement type and path-distance bookkeeping.
- Enforce banner, aura, participant, frequency, response-round, and Drilled Reaction rules.
- Automate native PF2e actions, existing effects, enemy saves, and supported tactic conditions.
- Expand tactic-specific automation to 35 of PF2e's 37 tactics with shared designated targets, exact responder roles, native movement planning, Strike filtering, reload capacity checks, maneuver choices, healing, and geometric resolution gates.
- Add direct-toward, retreat, half-Speed, double-Speed, reach, adjacency, close-formation, area, and Commander-range movement validation.
- Add safe Passage of Lines token swapping for equal-footprint willing allies, with GM socket authority and manual placement retained for unequal footprints.
- Scope Pincer Attack's off-guard effect to melee attacks from the Commander and actual responders.
- Automate Sanguine Revitalization's Fortitude save, persistent bleed, shared 10d6 healing, qualifying-weapon audience, and target-linked save penalty.
- Add Demoralizing Charge saves and frightened outcomes, Tactical Takedown two-responder geometry, Mirrored Wall range, and Insta-Ballista formation/range verification.
- Lock shared-target tactics to the Commander's designated canvas target and show it prominently on the chat card.
- Assign and sequence Slip and Sizzle's Trip and spellcaster roles, and add one- versus two-action Shadows in the Moonlight responder handling.
- Track Piranha Assault with a one-minute target-linked effect and damage-roll resistance reminder.
- Prevent repeated resolution and require all selected squadmates to answer before aftermath effects are applied.
- Add owner-side manual response completion that skips automation while preserving response-round tracking.
- Add Commander-side manual resolution handoff with no automated rolls or effects.
- Add a recorded GM-only geometry override that keeps target-count, relationship, save, and effect automation intact.
- Synchronize prepared tactics with PF2e Dailies while retaining direct manual preparation controls.
- Add ESLint, Husky commit/push gates, GitHub Actions validation, packaged release assets, and optional Foundry VTT publishing.
