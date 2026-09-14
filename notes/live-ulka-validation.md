# Live Ulka validation — 2026-09-14

Environment: Foundry v14 build 367, PF2e 8.5.0, Visioner QA world. Imported Ulka (Level 5) from the native Iconics compendium into a temporary scene, with a copied ally and NPC enemy. Advanced feats were temporarily added to this disposable copy for integration checks; their use at level 5 was a test fixture, not a legal character build.

## Verified

- Rendered Commander panel and feat chooser. Updating an actor while the chooser is open leaves its Continue button clickable. Metrics remain on one row.
- Banner's Inspiration: frightened 2 became frightened 1 on the allied recipient; opposition was excluded. Declining the mental-save option completed the workflow.
- Set-Up Strike: native Strike used target AC 22 and returned critical success. Its opening was recorded. Ally follow-up used the scoped AC penalty, preserved native cover, consumed the opening, and deleted temporary effects after completion.
- Strike Hard: issued a card, chose the ally, completed a native Strike using Drilled Reaction, and recorded both participant response and allowance.
- Defiant Banner: native physical resistances of 4 from Ulka's Intelligence. Quickening Banner: quickened condition. Pennant of Victory: native modifiers and 40 temporary HP. Rallying Banner: healing and cooldown; a repeat use was rejected.
- Piranha Assault: guided normal damage 8, resistance prevented 20 and 3, commander level 5 produced 16 final damage; NPC HP changed exactly once, 60 to 44.
- Shadows: native Note entries, +3 Following the Expert rule and untrained proficiency rule were created; noisy-armor option survived native armor preparation in the skill-check domain. Wait For It created its posture-gated bonus.
- Claim the Field: configured dagger attachment; Plant accepted a ranged grid corner and applied Glorious Banner's 80-foot planted radius. An enemy's native Will save against DC 21 included incapacitation; failure blocked the attempt. Retrieval removed placement and restored carried banner.
- Protective Screen: native Note and restriction effect were created, then automatically deleted after the protecting ally moved away, including during animated movement.
- Armored Regiment Training: heavy armor source Bulk stayed 4 while effective Bulk became 3. Rule validation passed.
- A non-owner player's feat request was rejected before execution.

## Defects found and corrected

1. Forced background rendering raised the panel over open workflow dialogs. Refresh now renders without force.
2. Native Strike expects a Token placeable and `options`; passing TokenDocument and `extraRollOptions` lost its target AC and action context.
3. PF2e recognizes the `Note` rule key, not `RollNote`.
4. Native armor preparation rebuilds `armor:*` options in the all domain. The noisy-armor option now uses skill-check.
5. Native Bulk alteration only supports override mode. Per-item overrides derive from source Bulk, preventing repeated subtraction.
6. Passive sync compared prepared rules to source definitions and discarded updates while running. It now compares source rules and queues another pass when needed.
7. Placeable coordinates lag document updates during animation. Adjacency checks use current document geometry on square grids.

Validation: 154 unit tests pass, ESLint passes, syntax checks pass. Existing Foundry/PF2e encounter-tracker and V1-dialog warnings also appeared; they were separate from the corrected Commanderer rule warnings.

This is representative live coverage, not a claim that every feat/tactic or every multiplayer and combat-expiry combination was tested. Scripted confirmation answers were used for the bulk effect/damage checks; native documents, rule preparation, rolls and HP updates remained real. Temporary QA actors, scene, banner and associated chat messages were cleaned up; the module's previous disabled configuration was restored.

## Posted feat chat controls — September 14, 2026, 11:30 UTC

Retested in Visioner Automated QA using a temporary level-5 Ulka copy and isolated scene. Added Banner Twirl and Adaptive Stratagem only to the test copy.

- Native Banner Twirl card renders both controls without changing the rules text; screenshot visually inspected.
- Clicking Use Banner Twirl and confirming creates its native effect with the AC Note and ranged-concealment workflow flag.
- Targeting Ulka and clicking the flat-check follow-up rolls 1d20. Result 2 correctly posts that the ranged attack fails; the roll message has no feat buttons.
- Adaptive Stratagem disables its button while its dialog is open; No cancels and restores the button.
- Repeated chat rendering leaves one button group. Set-Up Strike has its attack-opening follow-up; passive Warfare Expertise has no controls.
- Live action-resolution checks with real User documents return two Banner Twirl controls for GM/owner and none for a nonowner. Deleting Adaptive Stratagem makes its old message unavailable. These ownership checks used the live resolver, not a separate player browser session.
- Open Commander panel contains no old feats button. No Commanderer errors observed.

Temporary actor, scene, four posted cards, workflow results, and flat-check roll removed. Previous module configuration restored. No implementation changes needed from this pass.
