# Player/GM socket verification — 2026-09-14

Actual end-to-end checks using separate browser contexts and real Foundry logins: Ass Gm (active GM) and a disposable role-1 player. Foundry 14 build 367, PF2e 8.5.0. Both clients loaded current Commanderer and viewed the same isolated QA scene. The player initially owned the commander and one responder, but not the other ally or enemy. Commander ownership was then revoked to test a responder-only player.

Socket transport was real. No replacement of `game.user`, socket handlers, permissions, dialogs, or document writes. Buttons and confirmation dialogs were clicked in their respective clients; native saving throw and Strike dialogs were rolled normally.

| Path | Result |
|---|---|
| Player posts Banner Twirl and clicks Use | `commander-feat` request reached active GM with `gmRequired: true`; player displayed waiting status; GM saw confirmation. |
| GM confirms player feat | Exactly one protection effect on commander, owned responder and unowned ally; none on enemy. Player received successful socket response and completed status. |
| GM declines player feat confirmation | Player received cancellation, and buttons became enabled again. |
| Player responds to GM-authored Mountaineering Training | Native effect created on owned responder. `reserve-response`, `record-response` and `release-response` crossed the socket; GM-authored chat card updated on both clients. |
| Player issues Tactical Takedown, marks responses manually, then resolves | Native issue dialog created player-authored card. Manual response records traveled through GM authority. `resolve-invocation` reached active GM, who rolled enemy Reflex save. Success/no-effect result returned to player and closed resolution. |
| Player responds to Alley-oop | `guided-tactic` reached GM. GM selected consumable and unowned receiver. Declined catch transferred one potion into receiver inventory as a dropped item. Player's response card completed. Native item activation itself remains guided. |
| Player responds to Passage of Lines targeting unowned ally | Willingness confirmation appeared on player. `swap-tokens` reached GM; both tokens exchanged positions and card completed. Verified final positions after animation. |
| Player owns responder but not commander: Drilled Reaction | GM reserved allowance on unowned commander. Cancelling Strike selection refunded allowance and re-enabled button. Retry rolled native Strike and recorded responder plus Drilled usage. |
| Nonowned squadmate controls | Hidden on player client; controls for owned actors remained available. |
| Direct nonowner requests | Real player requests for another actor's feat, response reservation and response record were rejected by GM handlers. |
| GM-side validation error | Out-of-range Reactive Interference returned `Target must be adjacent.` to player's card; button became enabled again. |

No implementation changes required from this pass. [Raw socket/results evidence](player-socket-live-results.json) retains requests, response packets and document assertions. One initial swap-position assertion sampled the animation midway; the settled-position retest passed. This was an observation-timing issue, not a failed swap.

Scope: verifies shared player button/authority paths, including cross-owner writes, cancellation/refund and permission denial. It does not mean every feat was individually replayed as a player. GM disconnection/timeouts, simultaneous same-feat requests, malicious user-id spoofing, and clients viewing different scenes were not exercised here. Existing unit tests cover no-active-GM and timeout errors. Cross-actor workflows require an active GM with the module loaded; guided steps still require that GM's participation.

Cleanup: disposable player, four actors, isolated scene and associated messages removed after verification. Existing users/scenes were preserved. Module remains enabled.
