import { extendedCases, executeExtended } from './extended-cases.mjs';
import { assertFeatureCatalog } from './feature-catalog.mjs';
// Assertions use persisted Foundry state plus real panel controls in both sessions.
export const fullCases = [
  { name: 'panel-roles', smoke: true, description: 'Owner panel renders; GM-only squad override stays absent for player.' },
  { name: 'banner-toggle', smoke: true, description: 'Player stows/displays native banner; GM panel follows.' },
  { name: 'squad-roster', smoke: true, description: 'Player adds/removes ally through native squad planner.' },
  { name: 'tactic-preparation', smoke: true, description: 'Player prepares/unprepares native tactic; persisted selection and GM UI agree.' },
  { name: 'squad-range-refresh', description: 'Open panels refresh when squadmate leaves and re-enters aura.' },
  { name: 'banner-rules-chat', description: 'Plant rules button posts native rules without PF2e item-use origin.' },
  { name: 'player-plant-retrieve', description: 'Player plants through GM socket authority, sees physical banner, retrieves.' },
  { name: 'gm-plant-retrieve', description: 'GM plants/retrieves; player panel excludes GM override controls.' },
  ...extendedCases,
];
assertFeatureCatalog(fullCases);

export async function executeWorkflow(name, ctx) {
  if (extendedCases.some(c => c.name === name)) return executeExtended(name, ctx);
  const { gm, player, fixture: f, rpc, check, eventually, screenshot } = ctx;
  const panel = page => page.locator(`#pf2e-commanderer-panel-${f.commander}`);
  const action = (page, name) => panel(page).locator(`[data-action="${name}"]`);
  const state = page => rpc(page, 'snapshot');
  const allyButton = page => action(page, 'toggleSquadMember').and(page.locator(`[data-actor-uuid="Actor.${f.ally}"]`));
  const assertState = (label, predicate) => eventually(label, async () => predicate(await state(gm), await state(player)));
  async function planner() {
    if (await action(player, 'toggleSquadPlanner').getAttribute('aria-expanded') !== 'true') await action(player, 'toggleSquadPlanner').click();
    await allyButton(player).waitFor({ state: 'visible' });
  }
  async function roster(enabled) {
    await planner();
    if ((await state(player)).squad.includes(`Actor.${f.ally}`) !== enabled) await allyButton(player).click();
    await assertState(`Squad ${enabled ? 'includes' : 'excludes'} ally in both clients`, (a, b) =>
      [a, b].every(s => s.squad.includes(`Actor.${f.ally}`) === enabled));
  }
  async function banner(active) {
    if ((await state(player)).active !== active) await action(player, 'toggleBanner').click();
    await assertState(`Banner ${active ? 'displayed' : 'stowed'} in both clients`, (a, b) => a.active === active && b.active === active);
    await eventually('Both panels show banner state', async () => (await Promise.all([gm, player].map(p =>
      panel(p).locator(`.commanderer-banner.${active ? 'active' : 'inactive'}`).count()))).every(n => n === 1));
  }
  async function placement(page) {
    if (await action(page, 'toggleBannerPlacement').getAttribute('aria-expanded') !== 'true') await action(page, 'toggleBannerPlacement').click();
    await action(page, 'plantBannerAtCorner').first().waitFor({ state: 'visible' });
  }

  if (name === 'panel-roles') {
    for (const page of [gm, player]) {
      await panel(page).waitFor({ state: 'visible' });
      check('Commander portrait and native tactic rendered', await panel(page).locator('.commanderer-portrait').isVisible() &&
        (await panel(page).innerText()).includes('Mountaineering Training'));
    }
    check('GM override shown', await action(gm, 'configureSquadLimit').isVisible());
    check('Player override absent', await action(player, 'configureSquadLimit').count() === 0);
    const permissions = await rpc(player, 'checkPlayerPermissions');
    check('Production squad override rejects real player without mutation', permissions.overrideRejected);
    check('Production panel API rejects non-owned actor', permissions.nonOwnerRejected);
  } else if (name === 'banner-toggle') {
    await banner(false); await screenshot('stowed'); await banner(true);
  } else if (name === 'squad-roster') {
    await roster(true); await screenshot('added'); await roster(false);
  } else if (name === 'tactic-preparation') {
    if (!(await action(player, 'prepare').count())) return { blocked: 'Standalone preparation requires PF2e Dailies inactive; Dailies UI not covered by this case' };
    const button = action(player, 'prepare').and(player.locator(`[data-item-id="${f.tactic}"]`));
    for (const enabled of [true, false]) {
      if ((await state(player)).prepared.includes(f.tactic) !== enabled) await button.click();
      await assertState(`Tactic ${enabled ? 'prepared' : 'unprepared'} in both clients`, (a, b) => [a, b].every(s => s.prepared.includes(f.tactic) === enabled));
      await eventually('GM tactic button reflects preparation', async () =>
        (await action(gm, 'prepare').and(gm.locator(`[data-item-id="${f.tactic}"]`)).getAttribute('data-tooltip')).startsWith(enabled ? 'Unprepare' : 'Prepare'));
    }
  } else if (name === 'squad-range-refresh') {
    await banner(true); await roster(true);
    for (const [x, label] of [[1500, 'Outside aura'], [600, 'In banner aura']]) {
      await rpc(gm, 'moveAlly', { x });
      await eventually(`Both open panels show ${label}`, async () => (await Promise.all([gm, player].map(p =>
        panel(p).locator('.commanderer-member-info').innerText()))).every(text => text.includes(label)));
      await screenshot(x === 1500 ? 'outside' : 'inside');
    }
    await roster(false);
  } else if (name === 'banner-rules-chat') {
    await placement(player);
    const before = new Set((await state(gm)).messages.map(m => m.id));
    await action(player, 'bannerToChat').click();
    await assertState('Rules message replicated without native item-use origin', (a, b) => [a, b].every(s =>
      s.messages.some(m => !before.has(m.id) && m.bannerRules && !m.origin)));
    const message = (await state(player)).messages.find(m => !before.has(m.id) && m.bannerRules);
    await player.locator(`[data-message-id="${message.id}"]`).first().waitFor({ state: 'visible' });
    check('Rules chat card visible', true);
    await action(player, 'toggleBannerPlacement').click();
  } else if (name.endsWith('plant-retrieve')) {
    const page = name.startsWith('player-') ? player : gm;
    await banner(true); await placement(page);
    await action(page, 'plantBannerAtCorner').and(page.locator('[data-corner="nw"]')).click();
    await assertState('Planted banner and physical actor replicated', (a, b) => [a, b].every(s => s.planted && s.bannerActors.length === 1));
    await action(gm, 'forceRetrieveBanner').waitFor({ state: 'visible' });
    check('Player cannot see force retrieve', await action(player, 'forceRetrieveBanner').count() === 0);
    await screenshot('planted');
    await action(page, 'retrieveBanner').click();
    await assertState('Both clients restore carried active banner', (a, b) => [a, b].every(s => !s.planted && s.active));
    await action(player, 'toggleBanner').waitFor({ state: 'visible' });
  } else throw Error(`Unknown workflow: ${name}`);
  await screenshot('finished');
}
