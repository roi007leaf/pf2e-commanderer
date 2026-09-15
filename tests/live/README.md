# Local Foundry live tests

Adapted from PF2e Visioner's local live-test harness. Runs real GM and player
sessions against a running **disposable Foundry 14 / PF2e world** with this source
checkout enabled. Never starts, shuts down, creates or switches worlds.
Not loaded by the module, run in CI, or included in release archives.

## Setup

1. Launch `commanderer-qa` in Foundry Setup; enable PF2e Commanderer.
2. Create separate GM and player accounts. GM needs a password. Close other
   sessions using that GM so its socket authority remains available.
3. Run `npm ci`, then `npx playwright install chromium` once.
4. Run `npm run test:live:full`; supply URL and credentials when prompted.

For another disposable world, set `COMMANDERER_DISPOSABLE_WORLD` to its exact ID
or save a `world` field in local defaults.
World identity is checked before login credentials and again before mutations.
Do not point this suite at a campaign.

```powershell
npm run test:live                      # four smoke scenarios
npm run test:live:full                 # all 103 scenarios, every feat and tactic
npm run test:live:list
npm run test:live:harness              # runner tests; no Foundry required
npm run test:live:cleanup              # recover interrupted run
npm run test:live:matrix -- artifacts/live/<run-id>/report.json
npm run test:shipping -- artifacts/live/<run-id>/report.json
```

`COMMANDERER_LIVE_CASE=banner-toggle,player-plant-retrieve` selects exact case
names (unknown names fail). `--headless` disables visible browsers;
`COMMANDERER_BROWSER_CHANNEL=chrome` uses installed Chrome. Normal runs use
visible Chromium for canvas rendering. Requires Node 22.13+ or Node 24.

## Local defaults and unattended runs

Defaults live outside Foundry's served directory and Git:
`~/.config/pf2e-commanderer/live.json`:

```json
{
  "url": "http://localhost:30000",
  "gm": { "username": "QA GM", "password": "YOUR_LOCAL_PASSWORD" },
  "player": { "username": "QA Player", "password": "", "allowBlankPassword": true }
}
```

Enter accepts saved prompt defaults; passwords remain masked. `--saved` uses
saved settings without prompts. Environment variables override saved fields:
`COMMANDERER_FOUNDRY_URL`, `COMMANDERER_GM_USER`, `COMMANDERER_GM_PASSWORD`,
`COMMANDERER_PLAYER_USER`, `COMMANDERER_PLAYER_PASSWORD`, and
`COMMANDERER_PLAYER_ALLOW_BLANK=1` for an intentionally passwordless player.
Changing usernames never inherits another account's saved password.
Never commit credentials or pass them as command arguments.

## Evidence and coverage

103 scenarios cover all 43 Commander feats and 37 tactics, plus panel/ownership controls, native banner stow/display, squad
add/remove, preparation, range refresh, rules chat, tactic issue/cancel,
effect/manual/declined responses, native Strikes and Drilled Reaction refunds,
native save resolution and manual handoff, feat cancellation/healing/cooldowns,
combat card/effect expiration, native movement cancel/commit/invalid-path retry,
banner damage/repair/replacement/theft/drop/pickup, player recovery rolls and GM
manual rulings, real Dailies preparation/Adaptive Stratagem integration, native
swim Speed, Defensive Swap, Reactive Interference, companion banner setup,
Shield Warden damage and Shielded Recovery adjacency cleanup.
See [coverage inventory](coverage.md) for exact assertion boundaries.

`npm run test:live:features -- artifacts/live/report.json` prints evidence status
for every feat and tactic. The catalog test rejects missing feature mappings;
live cases compare the inventory against installed PF2e compendiums. Newly added
native feats or tactics therefore fail the inventory check until covered.

Tests click real controls, assert persisted state in both sessions, and capture
screenshots. Fixtures copy native Ulka iconic actors and native compendium items;
character-building ChoiceSet/GrantItem prompts are excluded for additional items.
Officer's Medical Training preserves its native fixed grant and verifies Medicine
proficiency, Intelligence and Battle Medicine. Officer's Education and Tactical
Expansion verify the native rules-card handoff and absence of duplicate module
feat creation; their character-building choice wizards remain PF2e-owned.
Production handlers, dialog methods, dice and role checks are never replaced.
Ownership rejection tests revoke and restore ownership only on disposable actors.
Rolls are genuinely random; assertions compare consequences with the actual roll.
Attack-upgrade and revival fixtures use native temporary AC/Medicine modifiers
to reach successful follow-up branches without replacing dice. These are test
fixtures, not legal character builds. Every feature's roll assertions use only
messages created during that case.
Exact expected socket rejection messages are recorded separately during their
negative test operation; all other runtime errors still fail the scenario.

Screenshots document rendered states; pixel-perfect geometry is not asserted.
Every feat and tactic has a required live case. This does not certify every
aftermath, save degree, character build or third-party module combination.
Add cases to `extended-cases.mjs` and guarded helpers to `extended-world.js`.
The older `tests/live-audit.mjs` remains a separate manual audit, not automated
coverage evidence.

Reports live in ignored `artifacts/live/<run-id>/report.json`, with screenshots;
`artifacts/live/report.json` holds the latest result. A pass requires assertions,
screenshots, and no captured runtime errors. Missing prerequisites are blocked;
unselected cases remain unrun. After a failed workflow the suite stops to avoid
carrying contaminated fixture state into later cases. Startup errors prevent
shipping certification, including errors originating in other modules.

Matrix checks require all implemented cases, successful cleanup, Foundry 14,
and a matching SHA-256 of module sources and live-test definitions. Changing
sources invalidates prior evidence. `test:shipping` checks evidence; it does not
publish or run the browser suite.

## Cleanup and interruption

A write-ahead recovery journal records run UUID, world/URL, original accounts,
scene/level, selections, targets, pause state and world time before mutation. No credentials,
cookies or storage dumps are recorded. Fixture documents and production-created
banner actors/chat messages carry the run UUID. Cleanup deletes only owned
documents and messages referring to owned fixtures, restores sessions, pause and world time,
and verifies no leftovers. Failed cleanup retains the journal for retry.

Dailies cases run last. The runner temporarily enables the installed
`pf2e-dailies` module in the disposable world, reloads both isolated sessions,
then tests against its real API. Its original module-configuration entry is
journaled before activation and restored/verified during cleanup, including
interrupted-run recovery. Missing Dailies installation is blocked, not passed.
No account role, campaign actor, or global dice setting is changed.

An atomic PID lock prevents overlapping runners in this checkout. Ctrl+C closes
the isolated browser to stop in-flight operations and retains recovery state.
Run `npm run test:live:cleanup` with the original world and accounts before the
next run. Never manually delete the recovery journal to bypass unfinished cleanup.
