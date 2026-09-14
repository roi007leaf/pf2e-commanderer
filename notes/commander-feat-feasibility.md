# Commander feat feasibility

Assessed 2026-09-14. Research only; no implementation in this audit.

All 43 Commander-trait feats from installed PF2e 8.5.0 match the supplied list. The installed name is **Armored Regiment Training**. Rules and Rule Elements were inspected directly in a temporary copy of the installed `systems/pf2e/packs/feats` and `feat-effects` compendiums. These are the system's Battlecry! rule representations, not claims that every effect already runs automatically. Official system release: https://github.com/foundryvtt/pf2e/releases/tag/pf2e-8.5.0 . The feat records retain their `Compendium.pf2e.feats-srd.Item.*` source UUIDs. The evidence snapshot is `C:/Users/User/AppData/Local/Temp/commander-feats-audit.json`.

Feasibility means implementation is possible with existing Foundry/PF2e concepts. It does not mean implemented or runtime-tested. Passive upgrades should modify their existing action automatically; they should not add separate buttons.

| Feat | Existing support / feasible addition | Boundary |
|---|---|---|
| Adaptive Stratagem | Initiative prompt to replace a prepared eligible tactic with one from the folio; synchronize module/Dailies preparation. | Player chooses replacement. |
| Armored Regiment Training | Heavy-armor Bulk adjustment and exploration travel-speed calculation. | Rest permission is narrative; do not remove combat Speed penalties. |
| Banner Twirl | One-round protection for commander and adjacent allies; ranged-only concealment checks. | Requires attack-context integration, not a global concealed condition. |
| Banner's Inspiration | Reduce frightened, choose a mental effect, reroll its save, track ten-minute immunity. | Source DC and failed-save consequences may require GM input. |
| Battle-Hardened Companion | Companion progression integration, autonomous Stride/Strike option, tactic reaction and lockout of later Command that round. | Needs linked companion and companion-sheet support. |
| Battle-Tested Companion | Mature-companion integration; banner attached to it gains ten feet of radius. | Companion building is distinct from banner automation. |
| Claim the Field | Implemented locally: Plant detects feat and attached thrown weapon; ranged placement and protective saves. | Live validation outstanding; unsourced damage/manual HP changes require adjudication. |
| Combat Assessment | Melee Strike followed on hit by Recall Knowledge, critical bonus, target immunity for a day. | GM controls secret information and knowledge answers. |
| Commander's Companion | Link companion, exempt it from squad capacity, place banner origin on it, track Command-granted tactic reaction. | Existing manual squad override is not full support. |
| Confusing Commands | Enemy selection in banner aura, Will saves, confused duration and success immunity. | Hearing/mental immunity and confused behavior require correct handling. |
| Contact With the Enemy | Extend Adaptive Stratagem's eligible prepared tactic tiers to master/legendary. | Automatic upgrade of Adaptive Stratagem. |
| Deceptive Tactics | Native Lengthy Diversion grant and Warfare Lore action links exist; convenient action integration possible. | Prerequisite substitution needs validation; do not replace Deception globally. |
| Defensive Swap | Validate willing adjacent ally, swap tokens and change triggering attack target. | Must resolve before attack; generic interception/rollback is substantial work. |
| Defiant Banner | Select commander/allies in aura and apply native resistance effect with source Intelligence and expiry. | Respect brandish requirement. |
| Demand Surrender | Will save, fleeing/prone, durations and surrender reminders. | GM confirms battle numbers, recent prerequisite event and hostile conduct. |
| Desperate Resuscitation | DC 40 Medicine, recent-death tracking, daily immunity, Raise Dead follow-through preserving/increasing wounded. | GM confirms intact body, death cause and resurrection eligibility. |
| Drilled Reflexes | Upgrade existing Drilled Reactions allowance to two distinct allies. | Current engine records only one use per round. |
| Efficient Preparation | Already included in module preparation capacity (+1). | Preserve Dailies integration. |
| Fortunate Blow | Upgrade successful damaging Guiding Shot/Set-Up Strike with fortune on next eligible creature's attack. | Shared one-use target tracking; native effect alone does not enforce global consumption. |
| Glorious Banner | Integrate native bonuses/enemy penalties with 60-foot carried and 80-foot planted aura. | Current module hardcodes 30/40 and planted base effects omit Glorious alterations; visual eligibility matters. |
| Guiding Shot | Ranged Strike then +1/+2 circumstance bonus on next other creature's attack. | Native marked effect exists; needs global next-attack consumption and commander exclusion. |
| Mercenary Reversal | Will save, stunned/controlled, temporary allegiance and damage-triggered saves. | GM rules actions against nature, battle composition and postbattle tribute; avoid automatic ownership transfer. |
| Observational Analysis | Detect recent allied Strike/spell targeting; upgrade Combat Assessment's knowledge bonus. | Native toggle/adjustment exists; ordinary-hit +2 and critical-hit +4 both need validation. |
| Officer's Education | Native skill choices and general-feat grant mostly exist. | Language/fallback choices and skill updates need validation; not a combat feature. |
| Officer's Medical Training | Native Medicine training, Intelligence modifier and Battle Medicine grant exist. | Alternate trained skill and prerequisites need validation. |
| Peerless Mascot Companion | Specialized-companion integration, secondary banner origin or combined 60/100-foot aura, special stat/Speed adjustments. | Largest companion addition; use selected specialization, prevent duplicate aura benefits. |
| Pennant of Victory | Native bonuses, all-Speed increase, temporary HP, recipients, cooldown and start-of-next-turn expiry. | Includes commander; respect brandish. |
| Perfected Evaluations | Upgrade Rapid Assessment to up to six checks. | GM still controls knowledge answers; upgrades do not stack to extra check counts. |
| Plant Banner | Existing module placement, object, aura, temporary HP, removal/recovery support. | Existing implementation is not a blanket guarantee of every edge case. |
| Practiced Reflexes | Upgrade Drilled Reactions to up to four allies. | Supersedes Drilled Reflexes; does not add four to two. |
| Quickening Banner | Grant one-round quickened to eligible allies, mark Strike/Stride restriction, cooldown. | Restriction must remain explicit; generic quickened is not unrestricted extra action. |
| Rallying Banner | Scale healing by level, select allies, halve outside combat, track cooldown. | Excludes commander from ally-only recipient list; mental/healing eligibility matters. |
| Rapid Assessment | Initiative-triggered observed-target selection and secret Recall Knowledge workflow. | GM selects/rules information and uncommon/custom DC adjustments. |
| Reactive Interference | Reaction prompt; level comparison or attack versus AC; mark disruption. | Cannot reliably cancel every arbitrary module action after it has executed. |
| Reactive Strike | Trigger assistance and no-MAP melee Strike; critical manipulate disruption. | Full interruption of movement/actions is more invasive than prompted execution. |
| Set-Up Strike | On successful Strike, scoped off-guard against next ally attack. | Must not apply unrestricted off-guard; consume on attack, not only damage. |
| Shield Warden | Adjacent-ally Shield Block using commander's shield, Hardness, shield HP and reaction. | Needs damage interception before application; avoid double damage/reduction. |
| Shielded Recovery | Battle Medicine follow-up effect, expire at turn start or loss of adjacency. | Native bonus effect exists; adjacency expiration and shield-hand allowance need integration. |
| Standard-Bearer's Sacrifice | Observe/range checks, Will save, redirected ranged attack and critical-failure AC bonus. | Reaction must precede attack resolution; cannot reliably retarget already-applied damage. |
| Tactical Expansion | Native two tactic choices/grants already exist; module discovers tactic items. | Repeatable and tier prerequisites should be retained. |
| Targeting Strike | Upgrade damaging Guiding Shot/Set-Up Strike with Intelligence precision damage on next other creature's attack. | Detect actual damage and scope to correct target/attack; no lingering unlimited damage bonus. |
| Unrivaled Analysis | Upgrade Rapid Assessment to up to four checks. | GM controls knowledge results; Perfected Evaluations supersedes count. |
| Unsteadying Strike | Successful melee Strike applies native scoped Fortitude/Reflex DC penalties until next turn. | Restrict to listed maneuvers, not all saves/DCs. |

## Recommended order

1. Drilled/Practiced Reflexes and Glorious Banner: close gaps in already-existing module behavior.
2. Defiant, Rallying, Quickening, Pennant, Confusing Commands and Unsteadying Strike: repeatable recipient/effect workflows.
3. Adaptive Stratagem/Contact With the Enemy and attack-follow-up feat family.
4. Companion integration and prompted reaction/knowledge/GM-ruling workflows.

## Code inspected

- `scripts/foundry/runtime.js`: native banner toggle, preparation limits/Dailies integration and tactic discovery.
- `scripts/foundry/banner.js`, `scripts/domain/banner-placement.js`: carried/planted origin/radius, Claim the Field and banner operations.
- `scripts/foundry/banner-effects.js`: planted base-effect cloning and recipient handling.
- `scripts/foundry/squad.js`: squad capacity and roster; no linked-companion exemption.
- `scripts/engine.js`: prepared-tactic-only dispatch and single Drilled Reactions use flag.
- `scripts/foundry/effects.js`: existing save, condition/effect, duration and targeting helpers.
- Installed `systems/pf2e/pf2e.mjs`: native save context/incapacitation and damage entry point were inspected during preceding Claim the Field implementation.

No browser/runtime test was performed for these proposed additions. Native compendium data is evidence of supplied rules/effects, not proof of complete automation. No code changes were made during this audit.
