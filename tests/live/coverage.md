# Live coverage inventory

The catalog contains 103 automated scenarios, with explicit mappings for all
43 Commander feats and 37 tactics in [feature-catalog.mjs](feature-catalog.mjs).
The local catalog check rejects missing mappings. Live cases compare those lists
with installed PF2e compendiums. Reports include per-feature status; a missing,
blocked, failed or evidence-free case cannot certify its feature.

| Area | Cases / observable assertions |
|---|---|
| Panel permissions | Real owner opens panel; non-owner API denied; player lacks GM override controls; production squad override rejects player. |
| Banner display | Player stow/display updates native roll option and both rendered panels. |
| Squad | Add/remove through planner; persisted roster on both clients; token movement updates in/out-of-aura labels. |
| Preparation | Native tactic prepare/unprepare persisted; GM control follows player change. |
| Rules chat | Native Plant Banner rules card created without item-use origin. |
| Plant/retrieve | GM and player operations create physical banner and restore carried state through production sockets. |
| Tactic issue | Cancel native participant dialog without creating order. |
| Tactic responses | GM order, player native climb/swim effects, decline, cancelled manual completion and retry; duplicate/non-owner denial. |
| Strike/Drilled | Cancel Strike chooser refunds allowance; retry rolls native attack and spends one Drilled Reaction. |
| Resolution | Stupefying Raid: native Will save, degree-dependent stupefied aftermath; manual handoff changes neither rolls nor enemy effects. Movement completion in save-resolution case is explicitly manual. |
| Combat | Native encounter round transition expires old cards; native Banner Twirl effect expires at next commander turn. |
| Feats | Banner Twirl crosses player-to-GM socket, cancels/retries, protects only adjacent allies. Rallying Banner native dice match HP gain and repeat-use cooldown. Confusing Commands native Will save yields confusion or immunity; allies excluded. Adaptive Stratagem replaces prepared tactic. |
| Reactions | Defensive Swap cancels/retries and exchanges exact native token positions on both clients. Reactive Interference disrupts an adjacent equal-level enemy without rolling. |
| Shields | Shield Warden applies native hardness once, verifies exact ally/shield HP loss and unchanged commander HP. Shielded Recovery cancels/retries the explicit Battle Medicine handoff, applies native AC/Reflex rules and removes protection after leaving adjacency. The medicine check/healing itself remains manual. |
| Companion | Cancel setup without linking; configure the fixture ally as companion, attach banner, verify companion token becomes banner range origin and squad member is not duplicated. Companion creature progression is not exercised. |
| Movement | Real Gather to Me token drags; Escape cancels held drag; legal path commits; path away from aura rejected and legal retry succeeds. |
| Banner durability | Damage marks broken; native GM repair caps HP/restores benefits; destruction and GM replacement clear stale placement. |
| Banner enemy actions | Take/drop/pickup production operations preserve carrier/dropped state; GM force retrieval cleans placement. |
| Banner recovery | Player requests GM ruling; cancel leaves carrier; manual ruling retrieves; native player check outcome determines recovery. |
| Banner guards | Player force retrieval/theft rejected; distant retrieval disabled and rejected by production action. |
| Dailies | Installed module really enabled/reloaded; native getCommanderTactics sees prepare/unprepare and Adaptive Stratagem replacement; module configuration restored afterward. |
| Every tactic | Each tactic issues its native order and exercises a production response or existing save-resolution case. New sequence cases use actual token drags and native actions; Defensive Retreat executes all three Steps. Reload verifies attached ammunition; Alley-Oop verifies a separate dropped receiver stack; counteract verifies effect removal against the actual degree/ranks; Valkyrie's Charge verifies healing; Piranha Assault verifies the designated target. Slip and Sizzle covers the Trip responder; its spell branch remains a guided follow-up. |
| Active feats | Every active feat executes through the real player/GM workflow. Native attacks, saves, buffs, conditions, healing, target immunity, private Recall Knowledge, and attack openings have outcome assertions. Revival checks 1 HP, wounded, recovery penalties and immunity. Armored Regiment Training checks worn heavy armor Bulk. |
| Passive upgrades | Real actor preparation/reaction/assessment limits and banner radii; upgraded Adaptive Stratagem accepts a master tactic; companion upgrades expose their native options; Claim the Field throws a banner and verifies native save-gated theft; attack upgrades run their base workflow and follow-up, including fortune dice and scoped precision rules. |
| Native build features | Officer's Medical Training verifies native Medicine proficiency, Intelligence and Battle Medicine grant. Officer's Education and Tactical Expansion verify visible native rules-card handoff and no duplicate module feat creation. Their build-choice dialogs and downstream skill/tactic grants are outside these two cases. |

## Remaining boundaries

- Each feature has a live case, but not every branch. Complex spell casting,
  combined-damage aftermaths, advanced companion actions, all shield variants,
  and native character-building choice wizards are not exhaustively exercised.
- A tactic response case does not certify every resolution/aftermath. Guided
  prompts test the module's handoff and recorded outcome, not an external action
  that the prompt asks the GM or player to resolve manually.
- Random rolls validate the observed degree and consequences; one run does not
  guarantee all four save degrees or critical-hit branches were sampled.
- Dailies API synchronization is covered; full Dailies daily-preparation wizard,
  retraining and overnight-rest workflow are not certified.
- Movement covers square-grid open ground; alternate movement types, terrain,
  walls, multilevel geometry and every guided sequence are not exhaustively tested.
- No exhaustive player role changes, concurrent users, multi-GM handover, network
  interruption or long-duration performance suite. Fixture ownership denial and
  normal GM/player socket transport are covered.
- Screenshots support review; no pixel comparison certifies banner artwork.

The older manual audit in `notes/full-live-audit.md` remains separate evidence;
its results are never counted toward this automated catalog.
