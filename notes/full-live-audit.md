# Commander automation audit — 2026-09-14

Foundry 14 build 367, PF2e 8.5.0, Visioner QA world. Commanderer is enabled and remains enabled. Earlier validation temporarily restored its disabled configuration; those earlier checks were not evidence that the user's client had the module enabled.

The full requested list was reviewed: 43 feats and 37 tactics. All 37 tactics issued native chat orders, and each tactic's response or guided resolution was exercised with real Foundry documents. This is not exhaustive testing of every saving-throw degree, character build, spell, weapon, terrain, or multiplayer combination.

Fixtures were disposable level-5 Ulka copies. High-level feats were added to test integration, not to represent a legal level-5 build. Most prompts used scripted answers and maximized/minimized native dice; native actors, rules, rolls, damage, item transfers and movement remained real. Character-building ChoiceSet/GrantItem prompts were omitted from bulk fixtures. Native grants were inspected separately; they are not claimed as end-to-end character-building tests.

## Completion and presentation

- Subsequent [separate-player/GM live verification](player-socket-live-validation.md) exercised real socket transport, cross-owner changes, player response records, GM resolutions, cancellation/refund and permission denial.
- Actual feat chat button click, visible confirmation, native effect, and completed status verified with Banner Twirl. Buttons use the module's burgundy primary and bordered secondary styles; screenshot inspected.
- Actual Manual → Mark completed interaction verified on The Bigger They Are. The card changes to Complete and records Completed manually.
- Actual Decline interactions followed by Handle manually verified on Tactical Takedown. The card records the manual resolution and shows Complete.
- Pending cards explain Respond/Decline/Manual. Once responses finish, cards explain target resolution. Feat buttons show progress, completion, cancellation and errors.
- GM requests run on the requesting GM's client. Non-GM cross-actor requests still use active-GM authority. The second-GM routing regression passes; simultaneous cross-client execution of the same feat is not exhaustively tested.

## Defects corrected and retested

| Defect | Verification |
|---|---|
| Interactive prompts opened on a different GM's screen | Requesting-GM routing regression; visible local chat workflow |
| Feat controls lacked module styling and completion feedback | Actual rendered buttons and completion screenshots |
| Native movement waypoints excluded their origin, producing zero movement cost | Native drag now measures 5 feet; regression includes origin, destination fallback and a returning path |
| Successive Defensive Retreat Steps stopped after the first | Three real 5-foot drags complete; waits for animation and pointer teardown |
| Alley-oop passed native transfer arguments in the wrong order | Real item transferred; declined catch drops a new stack without changing pre-existing stacks; unit regression |
| Desperate Resuscitation used unsupported duration unit `seconds` | Native seven-day effect creates all three recovery conditions; duration regression |
| The Bigger They Are offered Grapple | Live chooser now offers only Reposition, Shove and Trip |
| Companion action stamp persisted as `undefined:undefined` outside combat | Encounter stamp tested; independent action blocks same-round Command and resets next round |
| Brandish tactic permitted companion-held banner | Existing held-banner gate extended to companion placement |
| Create a Diversion omitted required native variant | Distracting words, gesture and trick all rolled live; cancellation regression |
| Cancelled native Strike was reported as completed | No-roll return now cancels instead of reporting a Strike |

## Feats — all 43

“Live” means the listed workflow or effect was exercised, not every possible branch. “Unit/source” means the shared upgrade was verified in code/tests or native data; it is not a separate live build test.

| Feat | Coverage and remaining boundary |
|---|---|
| Adaptive Stratagem | Live preparation replacement; initiative eligibility is confirmed by user. |
| Armored Regiment Training | Live exploration guidance; earlier live source Bulk 4/effective Bulk 3; unit override regression. Travel/rest adjudicated. |
| Banner Twirl | Live native effect, styled chat activation, ranged flat-check follow-up. Attacker eligibility remains guided. |
| Banner's Inspiration | Live frightened reduction, mental-effect retry, selected source removal and immunity. User resolves original effect consequences. |
| Battle-Hardened Companion | Live independent-action/Command round exclusion and reset. Companion progression stays on its sheet. |
| Battle-Tested Companion | Unit radius 40/70 and native rules inspected. Mature companion sheet progression is manual. |
| Claim the Field | Earlier live thrown placement, 80-foot planted aura, native incapacitation save and retrieval; regressions. |
| Combat Assessment | Live melee Strike and Recall Knowledge follow-up; knowledge answers remain GM-controlled. |
| Commander's Companion | Live linking, squad exemption, attached banner and command guidance. Sheet handles native companion actions. |
| Confusing Commands | Live critical-failure confusion and critical-success no-effect branch. Other degree branches inspected, not separately forced live. |
| Contact with the Enemy | Live upgraded Adaptive Stratagem preparation replacement. |
| Deceptive Tactics | Live Feint and all three Create a Diversion variants using Warfare Lore. |
| Defensive Swap | Live native token exchange; guided attack redirection. Different footprints remain manual. |
| Defiant Banner | Live native physical resistance effects. |
| Demand Surrender | Live critical-failure prone/item dropping and critical-success branch. Allegiance/hostility remains guided. |
| Desperate Resuscitation | Live successful HP/wounded/recovery effects; failed attempt and repeat-use immunity. Daily resource clearing remains guided. |
| Drilled Reflexes | Unit allowance and reservation/refund checks; earlier live Drilled response. |
| Efficient Preparation | Existing preparation-capacity calculation and tests; native feat has no rule elements. |
| Fortunate Blow | Live next-attack fortune roll uses 2d20 keep higher and consumes opening. |
| Glorious Banner | Live planted and companion/mascot radii; shared radius regressions. |
| Guiding Shot | Live target-specific opening and +2 on eligible follow-up attack; cleanup verified. |
| Mercenary Reversal | Live control effect and successful retry removing it in an encounter. Allegiance/commands/tribute remain GM decisions. |
| Observational Analysis | Shared Combat Assessment upgrade inspected; live upgraded knowledge flow. Immunity and prior-target eligibility guided. |
| Officer's Education | Native choices inspected; first trained-skill rule is malformed in PF2e 8.5.0 (see below). Language and sheet corrections manual. |
| Officer's Medical Training | Native Medicine/Intelligence/Battle Medicine rules inspected. Replacement skill if already trained is manual. |
| Peerless Mascot Companion | Live second aura, attached 100-foot aura with Glorious Banner and cleanup. Specialization stats/language manual. |
| Pennant of Victory | Live native modifiers and 40 temporary HP. |
| Perfected Evaluations | Unit six-check limit; live upgraded assessment dialog. One check executed, not all six in one activation. |
| Plant Banner | Earlier live placement, aura benefits, hostile removal and retrieval; broad banner regression suite. |
| Practiced Reflexes | Unit four-reaction allowance replacing lower allowances; shared reservation logic. |
| Quickening Banner | Live native quickened effect. Restricted extra action remains guided. |
| Rallying Banner | Live healing/cooldown and repeat-use rejection; scaling regression. |
| Rapid Assessment | Live native secret knowledge check with upgraded limit; GM supplies DC and answer. |
| Reactive Interference | Live equal-level disruption and higher-level native attack branch. GM stops originating reaction. |
| Reactive Strike | Live native attack with no MAP. Trigger and actual damage application remain native/guided. |
| Set-Up Strike | Live ally opening lowers target AC 22 to 20; next attack consumes and cleans it. |
| Shield Warden | Live hardness prevention and one-time HP/shield damage. Original damage must not also be applied. |
| Shielded Recovery | Live effect; earlier live adjacency cleanup. Battle Medicine uses normal sheet action. |
| Standard-Bearer's Sacrifice | Live successful enemy save and failed-save redirect; critical-failure AC effect exists during guided attack and is removed afterward. |
| Tactical Expansion | Native two tactic ChoiceSet/GrantItem pairs and tier filters inspected. Build choices remain native. |
| Targeting Strike | Scoped precision rule and opening cleanup inspected/tested through shared attack flow. Actual precision damage total was not separately rolled live. |
| Unrivaled Analysis | Unit four-check limit; shares upgraded assessment flow. |
| Unsteadying Strike | Live native attack and maneuver-DC penalty effect. Strike damage uses normal PF2e handling. |

## Tactics — all 37

Every row issued a real order card. Movement rows used actual token dragging. Guided sheet confirmations verify the module's handoff and resulting document changes; they do not claim automatic casting or item activation.

| Tactic | Exercised response/resolution |
|---|---|
| Alley-oop | Native item transfer; catch guidance; declined catch drops separate stack. |
| Bloody Guillotine | Actual movement and Trip; failed death save sets HP 0/dead. Witness sickened branch inspected, not live exercised. |
| Buckle-cut blitz | Actual movement; critical save branches and clumsy 2 effect. |
| Coordinating Maneuvers | Actual movement followed by native Reposition. |
| Corpse Crenellation | Actual movement/Strike; corpse cover effect with position and revival tracking. |
| Cry Havoc! | Actual movement; combined typed damage, critical failure, deafened and daily immunity. |
| Defensive Retreat | Three separate actual 5-foot Steps completed after fix. |
| Demoralizing Charge | Actual movement/Strike; native penalty choice and frightened resolution. |
| Double Team | Guided successful maneuver and different adjacent ally's native follow-up Strike. |
| End it! | Actual movement; critical save branches, fleeing and frightened effects. |
| Executioner's Volley | Loaded Crossbow Strike; combined typed damage applied once. Death-trigger fear branch inspected, not live exercised. |
| For Talmandor! For Freedom! | Native Warfare Lore counteract and selected source removal. |
| Gather to Me! | Actual movement from outside aura into it; native final position verified. Destination/budget rejection unit tests. |
| Insta-Ballista | Actual crew movement; native temporary ballista attack/bonus and cleanup. Crew/assembly/aim choices guided. |
| Mirrored Wall | Guided shield response; native penalty choice and blind/dazzled resolution. |
| Mountaineering Training | Native effect and prepared Warfare Lore Climb shortcut. |
| Naval Training | Native effect; Warfare Lore Swim shortcut shares tested action path. |
| Passage of Lines | Actual native token swap. |
| Pincer Attack | Actual movement; source-scoped melee AC effect. |
| Piranha Assault | Native target-linked grant; guided resistance correction changes HP once. |
| Pop, Drop, and Lock | Native designated-target Strike choice. Table must coordinate still-unused Strike/Trip/Grapple options. |
| Protective Screen | Actual movement and adjacent ally protection; earlier live cleanup when adjacency ends. |
| Ready, Aim, Fire! | Native reload handling and ranged Crossbow Strike. Cantrip alternative remains guided. |
| Reload! | Native Crossbow ammunition attachment verified. |
| Roaring Charge | Actual movement; critical save branches, frightened/fleeing. |
| Sanguine Revitalization | Actual movement/Strike with ready eligible weapon; persistent bleed and native healing roll. |
| Seek and Destroy | Native Seek and follow-up Strike; scoped precision grant. Toggle must end after first successful Strike's damage. |
| Shadows in the Moonlight | Native guide-rank effect, Note and noisy-armor option; earlier rank-3 check. |
| Shields Up! | Native Raise a Shield and guided shield-cantrip alternative. Parry remains guided. |
| Slip and Sizzle | Native designated-target Trip; guided spell handoff and slowed/resource flag. Native spellcasting is not automated. |
| Strike Hard! | Native Strike; earlier live chat response and Drilled allowance recording. |
| Stupefying Raid | Actual movement; critical save branches and stupefied 2. |
| Tactical Takedown | Actual movement; critical save branches/prone; actual Decline and manual-resolution completion UI. |
| Take the High Ground | Actual approach movement and guided Leap displacement; landing validation. |
| The Bigger They Are | Native bonus effect and corrected Reposition/Shove/Trip chooser; actual manual-completion UI. |
| Valkyrie's Charge | Healing call, actual movement and native Strike. Full-HP fixture used in movement test. |
| Wait For It... | Native guarded-stance effect and posture toggle. User ends toggle when posture eligibility ends. |

## Native/manual gaps and test limits

- PF2e 8.5.0 Officer's Education first trained-skill rule targets `system.skills.{selection}` instead of `system.skills.{selection}.rank`. Commanderer does not rewrite system compendium data. Verify/correct that trained skill on the actor sheet; choose the common language manually. The other skill and general-feat choices remain native.
- Officer's Medical Training grants native Medicine, Intelligence substitution and Battle Medicine. If already trained, select the replacement skill on the sheet.
- Companion maturity/specialization statistics, languages, spell/consumable use, reaction expenditure, knowledge answers and narrative eligibility still require native sheet actions or GM judgment. Follow the confirmation prompts before continuing.
- Pop, Drop, and Lock's per-responder unique action selection is guided, not enforced across concurrent clients. Precision/posture toggle consumption and some early-ending clauses are likewise table-controlled.
- Not all ordinary-success/failure save branches, death-trigger witnesses, source-damage callbacks, high-level legal builds, off-scene clients or simultaneous same-feat requests were separately exercised live. Do not interpret this report as exhaustive coverage of those combinations.

Validation: 161 automated tests, syntax checks and ESLint passed. [Raw execution log](full-live-audit-results.json) retains 166 recorded checks including initial failures, fixture rejections, and superseded attempts; a recorded pass means only its stated assertions. Use this matrix and the retests above when interpreting early records (notably the original zero-foot movement, Grapple choice, fixture equipment failures, concurrent actor locks and missing diversion variant).

Cleanup: removed the isolated Commander Regression 1142 scene, its four actors and 115 associated messages. Preserved Commander Full Audit and its actors because the second GM was actively using that scene. Reloaded the test client with the final code; module configuration remains enabled. Other open clients need a refresh to load the changes.
