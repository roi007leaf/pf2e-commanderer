# Changelog

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
