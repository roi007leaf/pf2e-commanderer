# Commander automation plan

## Product shape

One small surface: a **Commander** sheet-header button or Commander Token HUD flag opens one panel. The panel owns squad setup and prepared tactics. Issuing a tactic creates one shared response card. No permanent canvas HUD, no extra hotbar, no tactic-specific dialog maze.

The deep Module is `CommanderEngine`. Its public Interface is deliberately narrow:

```js
game.modules.get("pf2e-commanderer").api.open(actor)
game.modules.get("pf2e-commanderer").api.execute(tacticItem, actor)
```

Everything volatile sits behind that Seam: PF2e action APIs, actor flags, token distance, chat rendering, sockets, saves, effects, and optional PF2e Dailies preparation. This gives high Leverage while keeping Foundry-specific Implementation local.

## Shipped foundation

- Commander detection from class/archetype/tactic items.
- Persistent squad, enforced at `2 + Intelligence modifier`; Commander excluded from the limit.
- Allied-token roster discovery with target/aura ranking, capacity-safe squad management, and explicit drilled/on-scene/aura states.
- Tactic-specific audience projections showing responder count, signal reach, and current readiness before issuing.
- Optional PF2e Dailies preparation adapter; standalone preparation otherwise.
- Prepared tactic progression and common slot-increasing feats.
- 30-foot banner-aura eligibility and Brandish/banner validation.
- Persistent canvas banner identity layered over PF2e's native footprint-aware aura.
- Plant Banner corner placement, Scene-persistent standard and 40-foot burst, Retrieve workflow, planted-origin squad range, and auditory-only tactic enforcement.
- **Gather to Me!:** native Foundry movement planning plus route-aware banner destination validation.
- Visual/auditory signal choice.
- Shared per-owner response card with decline state.
- Owner-side manual response completion with the same round reservation as automated responses.
- Commander-side manual aftermath handoff and a recorded GM-only geometry override.
- One tactic response per creature per combat round.
- Once-per-round Drilled Reaction grant tracking.
- Embedded tactic frequency consumption.
- Active-GM socket authority for enemy saves and conditions.
- Existing PF2e effects reused instead of duplicated.

## Automation matrix

### Native actions and effects

- PF2e effects: **Mountaineering Training, Naval Training, The Bigger They Are, Wait For It, Mirrored Wall**, and save-penalty effects.
- Native actions: **Reload, Shields Up, Strike Hard, Seek and Destroy, Coordinating Maneuvers, Double Team, Slip and Sizzle, Pop Drop and Lock, Ready Aim Fire**, and tactic Strike sequences.
- Tracked custom effects: scoped **Pincer Attack**, **Shadows in the Moonlight**, and target-linked **Piranha Assault**.

### Guided movement and formations

- Enforced direction/budget: **Defensive Retreat, Gather to Me, Protective Screen, End It, Demoralizing Charge, Take the High Ground, Bloody Guillotine, Roaring Charge, Cry Havoc, Sanguine Revitalization**, and **Valkyrie's Charge**.
- Free movement with aftermath targeting: **Buckle-Cut Blitz, Stupefying Raid, Corpse Crenellation**, and **Insta-Ballista**.
- Direct position transaction: equal-footprint **Passage of Lines** swaps; unequal footprints retain their required square-choice confirmation.

### Automated aftermath

- Saves and conditions: **End It, Tactical Takedown, Buckle-Cut Blitz, Demoralizing Charge, Stupefying Raid, Mirrored Wall**, and **Roaring Charge**.
- Geometry: responder adjacency/area, Commander range, pairwise formation distance, and exact target count.
- **Pincer Attack:** attacker-scoped melee off-guard until the Commander's next turn.
- **Sanguine Revitalization:** chosen penalty, Fortitude save, persistent bleed, one shared 10d6 healing roll, and healing for drilled squadmates in the target's 20-foot emanation.
- **Insta-Ballista:** validates formation and 200-foot target range, then reports the exact assistant item bonus and 10d12 damage package.

### Human-confirmed boundaries

- **Alley-oop:** receiver willingness/free hand, cross-owner item transfer, and activation.
- **For Talmandor! For Freedom!:** source-effect selection and its authoritative counteract DC/rank.
- Coordinated damage tactics still leave damage application human-controlled where PF2e must combine separate Strike rolls before weaknesses/resistances.

## Next slices

1. Native Delay/Ready state linkage for Wait For It.
2. Path-history capture for passed-adjacent enemy tactics.
3. Coordinated damage workbench for Bloody Guillotine, Executioner's Volley, and Cry Havoc.
4. Receiver-confirmed inventory transaction UI for Alley-oop.
5. Source-aware counteract effect picker for For Talmandor! For Freedom!
6. Native custom Strike construction for Insta-Ballista after its existing formation validation.
7. Banner-companion origin selection and Plant Banner temporary Hit Point renewal.

Each slice should deepen `CommanderEngine`; tactic-specific complexity must not leak into more buttons or panels.
