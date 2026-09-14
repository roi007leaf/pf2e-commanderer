# Feat and tactic workflows

Local implementation, September 2026. Native PF2e 8.5.0 compendium records informed these workflows. See the [full coverage matrix](full-live-audit.md) and [earlier representative checks](live-ulka-validation.md) for exact live coverage and remaining manual boundaries.

## Entry points

- Continue issuing tactics and answering existing chat cards. Resolve aftermaths after the selected responders finish or decline.
- Post an owned feat to chat for its automation button, including guided reactions and companion setup. Guiding Shot/Set-Up Strike and Banner Twirl cards include follow-up buttons. Post the relevant training or Piranha Assault tactic for its guided follow-up; post the affected actor's Mercenary Reversal effect for its save retry. Buttons are visible to the actor's owners and GMs.
- Target affected creatures before opening a workflow. A GM's workflow runs on that GM's screen; a player's cross-actor workflow goes to the active GM. Guided dialogs can remain open while the GM resolves native sheet actions.
- Feat cards show progress and completion below their buttons. Tactic cards explain the next step: every selected responder must Respond, Decline, or use Manual after resolving their action on the sheet. Then resolve affected targets or choose Handle manually. Completed cards show Complete.
- Passive upgrades modify existing controls. Claim the Field upgrades Plant; Drilled/Practiced Reflexes increase the reaction allowance; Glorious Banner changes the aura; assessment and attack upgrades extend their base feats.

## Feats

| Workflows | Implemented behavior | Table-controlled portion |
|---|---|---|
| Adaptive Stratagem, Contact with the Enemy | Initiative prompt, eligible preparation replacement, Dailies flag integration | Initiative eligibility and replacement choice; restore normal preparations during daily preparation |
| Rapid Assessment, Unrivaled Analysis, Perfected Evaluations | Secret checks with upgraded check limits | Observed targets, skill, DC, knowledge answers |
| Combat Assessment, Observational Analysis | Melee Strike, knowledge follow-up, bonuses and target immunity | Confirm previous targeting and supply knowledge DC/results |
| Guiding Shot, Set-Up Strike, Targeting Strike, Fortunate Blow | Pending target-specific opening; temporary bonus/off-guard/precision/fortune on chosen next attack; cleanup after damage | Start follow-up before next eligible attack; confirm no intervening attack and actual damage |
| Unsteadying Strike | Melee Strike and native maneuver-specific DC penalties | Native Strike damage application |
| Defiant, Rallying, Quickening, Pennant, Confusing Commands, Banner's Inspiration | Aura recipients, effects/healing, saves, cooldowns/immunity where applicable | Perception, mental-effect source and consequences, restricted quickened action |
| Banner Twirl | Ranged-only protection reminder and guided DC 5 flat check | Invoke before ranged attack; adjacent-at-use eligibility |
| Demand Surrender, Mercenary Reversal | Saves, conditions, dropped held items, control reminders and repeat saves after damage | Battle prerequisites, hostility, allegiance, against-nature commands and tribute |
| Reactive Strike, Reactive Interference, Defensive Swap, Standard-Bearer's Sacrifice, Shield Warden | Trigger confirmation, native rolls, movement or damage/shield changes | Invoke before trigger resolves; redirect/cancel originating action manually |
| Shielded Recovery | Battle Medicine follow-up, AC/Reflex effect, adjacency cleanup | Battle Medicine's normal roll/healing and trigger confirmation |
| Desperate Resuscitation | Medicine DC 40, daily target immunity, 1 HP, wounded increase, one-week recovery penalties | Death eligibility and sheet resource expenditure |
| Commander's Companion and upgrades | Link companion, squad exemption, companion banner/mascot origin and radii, command/independent-action guidance | Build/progress companion and specialization stats on its sheet; spend its granted reaction manually |
| Armored Regiment Training | Heavy-armor Bulk reduction and exploration guidance | Group travel and rest |
| Deceptive Tactics | Warfare Lore Feint/Create a Diversion | Native result resolution |
| Drilled Reflexes, Practiced Reflexes, Glorious Banner, Claim the Field | Upgrade existing reaction and banner workflows | Normal action/resource expenditure |
| Efficient Preparation, Tactical Expansion, Officer's Education, Officer's Medical Training | Continue existing module preparation and native PF2e grants/rule elements | Native feat and skill choices; no duplicate grants |

## Added tactic behavior

| Tactics | Added behavior / boundary |
|---|---|
| Alley-oop | GM transfers one selected item; receiver confirms catch/activation. Sheet handles native activation/consumption. Declined catch records dropped item in receiver inventory. |
| For Talmandor! For Freedom! | Choose eligible source, DC and ranks; commander Warfare Lore counteract; remove chosen source on success. |
| Cry Havoc! | Confirm affected path-adjacent enemies; typed damage, basic Fortitude saves, deafened and daily immunity. |
| Executioner's Volley | Combine rolled damage by type and apply IWR once; death-triggered fear saves. Enter totals before any separate damage application. |
| Bloody Guillotine | Guided first-damaging-hit/prone confirmation, death save and witness sickened saves. Table must pause before later attacks when the trigger occurs; card aftermath is not a mid-roll interrupt. |
| Corpse Crenellation | Confirm fallen target; position-linked corpse cover effect and cleanup on revival. Native Take Cover handles improved cover. |
| Insta-Ballista | Confirm prepared crew and Bulk; temporary dedicated Strike, assist bonus, 200-foot range and native damage. |
| Slip and Sizzle | Successful Trip confirmation, native sheet spellcasting, slowed and next-turn reaction reminder. |
| Take the High Ground | Guided Leap allowance and landing-distance validation. |
| Double Team | Successful maneuver confirmation, different adjacent squadmate and follow-up melee Strike. |
| Protective Screen | Adjacent protected ally effect, end-of-ally-next-turn expiry and adjacency cleanup. |
| Piranha Assault | Target-linked effects plus guided partial-resistance damage calculator. Target the attacker and use the posted tactic's follow-up button; apply corrected damage once. |
| Seek and Destroy | Target-specific precision effect. Disable its toggle after the next successful Strike's damage; a miss does not consume it. |
| Shadows in the Moonlight | Guide-rank choice, conditional stealth bonuses, ignore noisy armor. Prepared commander can use Warfare Lore through the posted tactic's follow-up button. |
| Mountaineering Training, Naval Training | Existing speed effects; prepared commander Warfare Lore action shortcuts. |
| Wait For It... | Guarded stance only while its posture toggle remains enabled. End toggle when Delay/Ready eligibility ends. |
| Shields Up! | Native Raise a Shield or guided Parry/shield cantrip. |
| Ready, Aim, Fire! | Added guided qualifying damaging-cantrip alternative. |
| Defensive Retreat | Three separate Steps, each with movement validation. |

Other tactics retain their existing native-action, movement, save/effect and guided response implementations. A registered tactic is not a guarantee of complete automatic rules enforcement. Native reaction/action spending, sight and hearing, battle-history prerequisites, source-specific counteract consequences and narrative decisions remain guided.

## Validation

Run `npm test`, `npm run lint`, and `npm run check`. New tests cover passive scaling, origin/expiry, cancellation, ownership, native save context, dedicated Strike selection and Piranha source isolation. Reload all clients before live testing so socket handlers agree.
