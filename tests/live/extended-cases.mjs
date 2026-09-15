import { featureCases } from './feature-catalog.mjs';
import { executeFeature } from './feature-cases.mjs';

export const extendedCases = [
  ['tactic-issue-cancel', 'Cancel native tactic selection without creating an invocation.'],
  ['tactic-effect-response', 'GM-issued tactic: player applies native climb effect; GM declines remaining response.'],
  ['tactic-manual-response', 'Cancel/retry manual response; reservation released and native effects skipped.'],
  ['tactic-response-permissions', 'Non-owner and duplicate responses rejected without mutation.'],
  ['tactic-resolution-save', 'Manual movement completion followed by native Will save and degree-dependent aftermath.'],
  ['tactic-strike-drilled', 'Cancel/refund Drilled Reaction, retry native Strike and record allowance once.'],
  ['tactic-resolution-manual', 'Manual resolution records explicit handoff without native rolls/effects.'],
  ['combat-card-expiration', 'Native encounter round transition expires old response cards.'],
  ['combat-effect-expiration', 'Native round transition expires Banner Twirl protection.'],
  ['feat-twirl-cancel-use', 'Player-origin feat crosses GM socket, cancels, retries and creates scoped protection.'],
  ['feat-rallying-roll-cooldown', 'Native healing dice match actual HP delta; immediate reuse rejected.'],
  ['feat-confusing-commands-save', 'Native Will save determines confusion or immunity; allies excluded.'],
  ['feat-adaptive-stratagem', 'Native chooser replaces a prepared tactic with folio choice.'],
  ['tactic-naval-training', 'Native swim Speed response synchronizes without affecting enemies.'],
  ['feat-defensive-swap', 'Cancel willing-ally confirmation, retry and exchange real token positions.'],
  ['feat-reactive-interference', 'Equal-level adjacent enemy reaction disrupted without an attack roll.'],
  ['feat-companion-cancel', 'Cancel companion identification without linking or changing squad.'],
  ['feat-companion-setup', 'Link fixture ally as companion and attach banner through native dialogs.'],
  ['feat-shield-warden', 'Native held shield hardness reduces damage to ally and shield.'],
  ['feat-shielded-recovery', 'Cancel/retry Battle Medicine handoff; protection ends when adjacency ends.'],
  ['movement-gather-cancel', 'Escape cancels real movement planner and permits retry.'],
  ['movement-gather-commit', 'Native token drag commits Gather movement and response.'],
  ['movement-gather-invalid', 'Invalid native drag rejected; legal retry commits and records response.'],
  ['banner-damage-repair-replace', 'Broken/destroyed banner states, native GM repair and replacement controls.'],
  ['banner-theft-drop-pickup', 'Enemy takes, drops and picks up banner through production socket handlers.'],
  ['banner-recovery-cancel-manual', 'Player recovery request: GM cancels, then manually rules recovery.'],
  ['banner-recovery-native-check', 'GM assigns native player check; outcome governs recovery.'],
  ['banner-permission-range-rejection', 'Player force retrieval/theft and remote retrieval rejected.'],
  ['dailies-preparation', 'Real Dailies module: Commander preparation syncs with native API.'],
  ['dailies-adaptive-stratagem', 'Adaptive Stratagem changes real Dailies preparation without stale local flags.'],
].map(([name, description]) => ({ name, description, extended: true, dailies: name.startsWith('dailies-') }));
extendedCases.splice(extendedCases.findIndex(c => c.dailies), 0, ...featureCases);

export async function executeExtended(name, ctx) {
  const { gm, player, fixture: f, rpc, check, eventually, screenshot } = ctx;
  const panel = page => page.locator(`#pf2e-commanderer-panel-${f.commander}`);
  const action = (page, a) => panel(page).locator(`[data-action="${a}"]`);
  const dialog = (page, title) => page.locator('.application, .window-app').filter({ has: page.locator('.window-title', { hasText: title }) }).last();
  const button = (page, title, label) => dialog(page, title).getByRole('button', { name: label, exact: true });
  const state = (page = gm) => rpc(page, 'extendedSnapshot');
  const agree = async (label, predicate) => eventually(label, async () => predicate(await state(gm)) && predicate(await state(player)));
  const prepare = slug => rpc(gm, 'prepareTactic', { slug });
  const add = slug => rpc(gm, 'addNative', { slug });
  const chat = (page, id, a, index) => page.locator(`[data-message-id="${id}"] [data-commanderer-action="${a}"]${index === undefined ? '' : `[data-participant-index="${index}"]`}`).first();
  const invocation = (s, id) => s.messages.find(m => m.id === id)?.invocation;
  async function issue(slug, page = gm, { cancel = false, participant = 1, both = false } = {}) {
    const id = await prepare(slug);
    const before = new Set((await state()).messages.map(m => m.id));
    await eventually('Prepared tactic Issue button enabled', () => action(page, 'issue').and(page.locator(`[data-item-id="${id}"]`)).isEnabled());
    await action(page, 'issue').and(page.locator(`[data-item-id="${id}"]`)).click();
    const d = page.locator('.application, .window-app').filter({ has: page.locator('.commanderer-choices') }).last();
    await d.waitFor({ state: 'visible' });
    if (cancel) {
      await d.getByRole('button', { name: 'Cancel', exact: true }).click();
      check('Cancelled selection creates no order', !(await state()).messages.some(m => !before.has(m.id) && m.invocation));
      return null;
    }
    const choices = d.locator('input[name="participant"]');
    if (await choices.count()) {
      if (both) for (const choice of await choices.all()) await choice.check();
      else await choices.nth(Math.min(participant, await choices.count() - 1)).check();
    }
    await d.getByRole('button', { name: 'Issue Tactic', exact: true }).click();
    if (slug === 'slip-and-sizzle') {
      const roles = page.locator('.application').filter({ has: page.locator('[name="tripper"]') });
      await roles.getByRole('button', { name: 'Assign roles', exact: true }).click();
    }
    let messageId;
    await eventually('Native tactic order created', async () => {
      messageId = (await state()).messages.find(m => !before.has(m.id) && m.invocation?.tacticSlug === slug)?.id;
      return !!messageId;
    });
    await player.locator(`[data-message-id="${messageId}"]`).first().waitFor({ state: 'visible' });
    return messageId;
  }
  async function allyIndex(id) { return invocation(await state(), id).participants.findIndex(p => p.actorUuid === `Actor.${f.ally}`); }
  async function startFeat(slug, page = player) {
    await add(slug); await rpc(page, 'startFeat', { slug });
  }
  async function featDone(page = player, expected = true) {
    let result;
    await eventually('Feat workflow settled', async () => { result = await rpc(page, 'taskStatus'); return result?.status !== 'running'; });
    check(`Feat result ${expected}`, result.status === 'complete' && result.value === expected);
  }
  async function rollNative(page) {
    const roll = page.locator('.application, .window-app').filter({ has: page.getByRole('button', { name: /^Roll/ }) }).last();
    await roll.getByRole('button', { name: /^Roll/ }).last().click();
  }
  async function plant() {
    await action(player, 'toggleBannerPlacement').click();
    await action(player, 'plantBannerAtCorner').and(player.locator('[data-corner="nw"]')).click();
    await agree('Banner planted in both sessions', s => !!s.placement);
  }
  async function take() {
    await plant();
    await rpc(gm, 'positionFixture', { role: 'enemy', x: 400, y: 500 });
    await rpc(gm, 'bannerOperation', { operation: 'take' });
    await agree('Enemy carries inactive banner', s => s.placement?.removalMode === 'carried');
  }
  async function adaptive({ outgoing = 'mountaineering-training', incoming = 'naval-training' } = {}) {
    const old = await prepare(outgoing);
    const next = await add(incoming);
    await startFeat('adaptive-stratagem');
    await button(gm, 'Adaptive Stratagem', 'Yes').click();
    await dialog(gm, 'Adaptive Stratagem').locator('select[name="selection"]').selectOption(old);
    await button(gm, 'Adaptive Stratagem', 'Continue').click();
    await dialog(gm, 'Adaptive Stratagem').locator('select[name="selection"]').selectOption(next);
    await button(gm, 'Adaptive Stratagem', 'Continue').click();
    await featDone();
    await eventually('Replacement prepared on both clients', async () => {
      const states = await Promise.all([gm, player].map(p => rpc(p, 'snapshot')));
      return states.every(s => s.prepared.includes(next) && !s.prepared.includes(old));
    });
    if (name.startsWith('dailies')) await agree('Real Dailies API sees replacement', s => s.actors.commander.dailies?.includes(next) && !s.actors.commander.dailies.includes(old));
  }

  await rpc(gm, 'resetExtended');
  await rpc(player, 'targetFixture', { roles: [] });
  await rpc(gm, 'targetFixture', { roles: [] });
  if (name.startsWith('catalog-')) {
    await executeFeature(name, ctx, { issue, startFeat, featDone, rollNative, state, agree, chat, invocation, panel, button, dialog, adaptive, prepare, add });
    await screenshot('finished');
    return;
  }
  if (name === 'tactic-issue-cancel') {
    await issue('mountaineering-training', player, { cancel: true });
  } else if (name === 'tactic-effect-response' || name === 'tactic-response-permissions') {
    const id = await issue('mountaineering-training');
    const index = await allyIndex(id);
    if (name === 'tactic-response-permissions') {
      // Temporarily revoke ownership only on this disposable ally; production checks use the real player.
      await rpc(gm, 'setAllyOwnership', { owned: false });
      await eventually('Ownership revocation reaches player', () => rpc(player, 'allyNotOwned'));
      const rejected = await rpc(player, 'responseRejection', { messageId: id, index });
      check('Non-owner rejected', rejected.rejected && rejected.error.includes('do not own'));
      await rpc(gm, 'setAllyOwnership', { owned: true });
      await eventually('Ownership restored', async () => !(await rpc(player, 'allyNotOwned')));
    }
    await chat(player, id, 'respond', index).click();
    await agree('Response and native climb Speed applied', s => invocation(s, id)?.participants[index].status === 'responded' && s.actors.ally.climb >= 20);
    const duplicate = await rpc(player, 'responseRejection', { messageId: id, index });
    check('Duplicate response rejected', duplicate.rejected && duplicate.error.includes('already answered'));
    const commanderIndex = invocation(await state(), id).participants.findIndex(p => p.commander);
    await chat(gm, id, 'decline', commanderIndex).click();
    await agree('Decline synchronized without commander climb effect', s => invocation(s, id)?.participants[commanderIndex].status === 'declined' && s.actors.commander.climb < 20);
  } else if (name === 'tactic-manual-response') {
    const id = await issue('mountaineering-training'); const index = await allyIndex(id);
    await chat(player, id, 'manual-response', index).click();
    await button(player, 'Complete Mountaineering Training manually', 'Cancel').click();
    await agree('Cancellation keeps response pending and allowance unused', s => invocation(s, id)?.participants[index].status === 'pending' && !s.actors.ally.lastResponse);
    await chat(player, id, 'manual-response', index).click();
    await button(player, 'Complete Mountaineering Training manually', 'Mark completed').click();
    await agree('Retry records manual response without native effect', s => invocation(s, id)?.participants[index].status === 'responded' && s.actors.ally.climb < 20);
  } else if (name === 'tactic-resolution-save') {
    const id = await issue('stupefying-raid'); const index = await allyIndex(id);
    await chat(player, id, 'manual-response', index).click();
    await button(player, 'Complete Stupefying Raid manually', 'Mark completed').click();
    await agree('Movement completion recorded', s => invocation(s, id)?.participants[index].status === 'responded');
    await rpc(gm, 'targetFixture', { roles: ['enemy'] });
    await chat(gm, id, 'resolve').click();
    await rollNative(gm);
    await agree('Native save produced resolution results', s => invocation(s, id)?.resolutionResults?.length === 1);
    const s = await state(); const result = invocation(s, id).resolutionResults[0];
    check('Resolution records native degree', Number.isInteger(result.degree));
    const expected = result.degree <= 1 ? `stupefied ${result.degree === 0 ? 2 : 1}` : null;
    await agree('Aftermath matches native save degree', actual => expected
      ? invocation(actual, id).resolutionResults[0].applied === expected && actual.actors.enemy.conditions.stupefied === (result.degree === 0 ? 2 : 1)
      : actual.actors.enemy.conditions.stupefied === 0);
  } else if (name === 'tactic-strike-drilled') {
    const id = await issue('strike-hard'); const index = await allyIndex(id);
    await rpc(player, 'targetFixture', { roles: ['enemy'] });
    await chat(player, id, 'respond-drilled', index).click();
    const choice = player.locator('.application, .window-app').filter({ has: player.locator('select[name="choice"]') }).last();
    await choice.getByRole('button', { name: 'Cancel', exact: true }).click();
    await agree('Cancelled Strike refunds Drilled Reaction', s => !s.actors.commander.drilled.length && !s.actors.ally.lastResponse);
    await chat(player, id, 'respond-drilled', index).click();
    const options = await choice.locator('option').evaluateAll(options => options.map(o => ({ value: o.value, label: o.textContent })));
    await choice.locator('select[name="choice"]').selectOption((options.find(o => /fist/i.test(o.label)) ?? options[0]).value);
    await choice.getByRole('button', { name: 'Continue', exact: true }).click();
    await rollNative(player);
    await agree('Native Strike recorded with one Drilled Reaction spent', s => invocation(s, id)?.participants[index].status === 'responded' && s.actors.commander.drilled.length === 1 && s.actors.commander.drilled[0] === `Actor.${f.ally}`);
    check('Native attack roll captured', (await state()).messages.some(m => m.context?.type === 'attack-roll' && m.rolls.length));
  } else if (name === 'tactic-resolution-manual') {
    const id = await issue('stupefying-raid'); const index = await allyIndex(id);
    await chat(player, id, 'decline', index).click();
    await agree('Selected responder declined', s => invocation(s, id)?.participants[index].status === 'declined');
    const before = await state();
    await chat(player, id, 'manual-resolve').click();
    await button(player, 'Handle Stupefying Raid manually', 'Handle manually').click();
    await agree('Manual handoff recorded in both clients', s => invocation(s, id)?.resolutionOverride?.mode === 'manual' && invocation(s, id)?.resolutionResults.length === 1);
    const after = await state();
    check('Manual handoff creates no rolls or enemy effects', after.messages.reduce((n,m) => n + m.rolls.length, 0) === before.messages.reduce((n,m) => n + m.rolls.length, 0) && after.actors.enemy.effects.length === before.actors.enemy.effects.length);
  } else if (name === 'combat-card-expiration' || name === 'combat-effect-expiration') {
    const combatId = await rpc(gm, 'combatFixture', { operation: 'create' });
    for (const p of [gm, player]) {
      await p.waitForFunction(id => game.combats.has(id), combatId);
      await rpc(p, 'viewCombat', { combatId });
    }
    await rpc(gm, 'combatFixture', { operation: 'start', combatId });
    let id, index;
    if (name === 'combat-effect-expiration') {
      await startFeat('banner-twirl'); await button(gm, 'Banner Twirl', 'Yes').click(); await featDone();
      await agree('Protection active before next commander turn', s => s.actors.ally.effects.some(e => e.workflow?.rangedConcealment && !e.expired));
    } else { id = await issue('mountaineering-training'); index = await allyIndex(id); }
    await rpc(gm, 'combatFixture', { operation: 'next', combatId });
    await agree('Both clients advanced native combat round', s => s.combat?.round === 2);
    if (name === 'combat-effect-expiration') {
      await agree('Native effect expires at commander next turn', s => !s.actors.ally.effects.some(e => e.workflow?.rangedConcealment && !e.expired));
    } else {
      const result = await rpc(player, 'responseRejection', { messageId: id, index });
      check('Old card rejected after round transition', result.rejected && result.error.includes('expired'));
      await agree('Expired response has no effect or response record', s => invocation(s, id)?.participants[index].status === 'pending' && !s.actors.ally.lastResponse);
    }
    await rpc(gm, 'combatFixture', { operation: 'delete', combatId });
  } else if (name === 'feat-twirl-cancel-use') {
    await startFeat('banner-twirl');
    await button(gm, 'Banner Twirl', 'No').click(); await featDone(player, false);
    check('Cancelled feat created no protection', !(await state()).actors.ally.effects.some(e => e.workflow?.rangedConcealment));
    await startFeat('banner-twirl');
    await button(gm, 'Banner Twirl', 'Yes').click(); await featDone();
    await agree('Scoped ranged protection affects allies, excludes enemy', s => ['commander', 'ally'].every(r => s.actors[r].effects.some(e => e.workflow?.rangedConcealment)) && !s.actors.enemy.effects.some(e => e.workflow?.rangedConcealment));
  } else if (name === 'feat-rallying-roll-cooldown') {
    await rpc(gm, 'damageFixture', { role: 'ally', damage: 35 });
    const before = await state();
    await startFeat('rallying-banner');
    await button(gm, 'Rallying Banner', 'Yes').click(); await featDone();
    const after = await state();
    const roll = after.messages.filter(m => !before.messages.some(b => b.id === m.id)).flatMap(m => m.rolls).find(r => r.formula.includes('d6'));
    check('Native healing dice match HP delta', !!roll && after.actors.ally.hp - before.actors.ally.hp === Math.min(35, Math.floor(roll.total / 2)));
    await ctx.expectConsoleError('module.pf2e-commanderer | commander-feat Error: Rallying Banner is not ready yet.', async () => {
      await startFeat('rallying-banner');
      await eventually('Cooldown rejects repeated use', async () => (await rpc(player, 'taskStatus'))?.status === 'rejected');
    });
    check('Cooldown rejection reason', (await rpc(player, 'taskStatus')).error.includes('not ready'));
  } else if (name === 'feat-confusing-commands-save') {
    await startFeat('confusing-commands');
    await button(gm, 'Confusing Commands', 'Yes').click();
    await rollNative(gm); await featDone();
    const s = await state();
    check('Native save generated', s.messages.some(m => m.rolls.some(r => r.formula.includes('d20'))));
    const saveMessage = s.messages.findLast(m => m.context?.type === 'saving-throw');
    const degree = saveMessage?.rolls[0]?.degree;
    check('Enemy consequence follows actual native Will-save degree', Number.isInteger(degree) && (degree >= 2
      ? !!s.actors.enemy.immunities['confusing-commands'] && !s.actors.enemy.conditions.confused
      : s.actors.enemy.conditions.confused && !s.actors.enemy.immunities['confusing-commands']));
    check('Allies excluded', !s.actors.ally.effects.some(e => e.name.includes('Confusing Commands')) && !s.actors.ally.immunities['confusing-commands']);
  } else if (name.endsWith('adaptive-stratagem')) {
    await adaptive();
  } else if (name === 'tactic-naval-training') {
    const id = await issue('naval-training'); const index = await allyIndex(id);
    await chat(player, id, 'respond', index).click();
    await agree('Native swim Speed and response synchronize; enemy unaffected', s => invocation(s, id)?.participants[index].status === 'responded' && s.actors.ally.swim >= 20 && s.actors.enemy.swim === 0);
  } else if (name === 'feat-defensive-swap') {
    await rpc(player, 'targetFixture', { roles: ['ally'] });
    await startFeat('defensive-swap');
    await button(gm, 'Defensive Swap', 'Yes').click();
    await button(gm, 'Defensive Swap', 'No').click(); await featDone(player, false);
    await agree('Cancelled exchange preserves both token positions', s => s.tokens[0].x === 500 && s.tokens[1].x === 600);
    await startFeat('defensive-swap');
    await button(gm, 'Defensive Swap', 'Yes').click();
    await button(gm, 'Defensive Swap', 'Yes').click(); await featDone();
    await agree('Both sessions see exact exchanged positions', s => s.tokens[0].x === 600 && s.tokens[1].x === 500 && s.tokens[0].y === 500 && s.tokens[1].y === 500);
  } else if (name === 'feat-reactive-interference') {
    await rpc(gm, 'positionFixture', { role: 'enemy', x: 400 });
    await rpc(player, 'targetFixture', { roles: ['enemy'] });
    const before = new Set((await state()).messages.map(m => m.id));
    await startFeat('reactive-interference');
    await button(gm, 'Reactive Interference', 'Yes').click(); await featDone();
    await agree('Equal-level reaction disruption posted without rolling', s => {
      const messages = s.messages.filter(m => !before.has(m.id));
      return messages.some(m => m.content.includes('Triggering reaction disrupted')) && messages.every(m => m.rolls.length === 0);
    });
  } else if (name.startsWith('feat-companion-')) {
    await rpc(player, 'targetFixture', { roles: ['ally'] });
    await startFeat('commanders-companion');
    const title = "Commander's Companion";
    await button(gm, title, name.endsWith('cancel') ? 'No' : 'Yes').click();
    if (name.endsWith('cancel')) {
      await featDone(player, false);
      await agree('Cancelled setup leaves companion unlinked', s => !s.actors.commander.companion);
    } else {
      await button(gm, title, 'Yes').click();
      await dialog(gm, title).locator('select[name="selection"]').selectOption('done');
      await button(gm, title, 'Continue').click(); await featDone();
      await agree('Companion link and banner attachment synchronize', s => s.actors.commander.companion?.actorUuid === `Actor.${f.ally}` && s.actors.commander.companion?.tokenUuid === `Scene.${f.scene}.Token.${f.tokens[1]}` && s.actors.commander.companion?.banner === true);
      await agree('Banner range uses companion token as origin', s => s.bannerOriginToken === f.tokens[1]);
    }
    const snapshot = await rpc(gm, 'snapshot');
    check('Companion setup does not duplicate squad member', snapshot.squad.length === 1);
  } else if (name === 'feat-shielded-recovery') {
    await rpc(gm, 'equipShield');
    await rpc(player, 'targetFixture', { roles: ['ally'] });
    await startFeat('shielded-recovery');
    await button(gm, 'Shielded Recovery', 'No').click(); await featDone(player, false);
    await agree('Cancelled medicine handoff grants no protection', s => !s.actors.ally.effects.some(e => e.workflow?.adjacentTo));
    await startFeat('shielded-recovery');
    await button(gm, 'Shielded Recovery', 'Yes').click(); await featDone();
    await agree('Protection contains native AC and Reflex bonus scoped to commander adjacency', s => s.actors.ally.effects.some(e => e.workflow?.adjacentTo === `Scene.${f.scene}.Token.${f.tokens[0]}` && e.rules.some(r => r.key === 'FlatModifier' && r.value === 1 && r.selector.includes('ac') && r.selector.includes('reflex'))));
    await rpc(gm, 'positionFixture', { role: 'ally', x: 1000 });
    await agree('Leaving adjacency removes protection on both clients', s => !s.actors.ally.effects.some(e => e.workflow?.adjacentTo));
  } else if (name === 'feat-shield-warden') {
    await rpc(gm, 'equipShield');
    await rpc(player, 'targetFixture', { roles: ['ally'] });
    const before = await state();
    check('Native shield is held and usable', before.actors.commander.shield?.hp > 0);
    await startFeat('shield-warden');
    await button(gm, 'Shield Warden', 'Yes').click();
    await button(gm, 'Shield Warden', 'Yes').click();
    await dialog(gm, 'Shield Warden').locator('input[type="number"]').fill('9');
    await button(gm, 'Shield Warden', 'Continue').click(); await featDone();
    const damage = Math.max(0, 9 - before.actors.commander.shield.hardness);
    await agree('Native hardness applied once to ally and shield HP', s => s.actors.ally.hp === before.actors.ally.hp - damage && s.actors.commander.shield.hp === before.actors.commander.shield.hp - damage && s.actors.commander.hp === before.actors.commander.hp);
  } else if (name.startsWith('movement-gather-')) {
    await player.bringToFront();
    await rpc(gm, 'positionFixture', { role: 'ally', x: 1300 });
    const id = await issue('gather-to-me'); const index = await allyIndex(id);
    await chat(player, id, 'respond', index).click();
    await player.waitForFunction(id => canvas.tokens._movementPlanningContext?.object?.id === id, f.tokens[1]);
    await panel(player).evaluate(el => foundry.applications.instances.get(el.id).minimize());
    const start = await rpc(player, 'tokenPoint', { role: 'ally' });
    await player.mouse.move(start.x, start.y);
    if (name.endsWith('cancel')) {
      await player.mouse.down(); await player.mouse.move(start.x - 80, start.y, { steps: 6 });
      await player.keyboard.press('Escape');
      await player.mouse.up();
      await player.waitForFunction(() => !canvas.tokens._movementPlanningContext);
      await agree('Escape leaves token and response unchanged', s => s.tokens[1].x === 1300 && invocation(s, id)?.participants[index].status === 'pending' && !s.actors.ally.lastResponse);
    } else {
      if (name.endsWith('invalid')) {
        await player.mouse.down(); await player.mouse.move(start.x + 70, start.y, { steps: 8 }); await player.mouse.up();
        await player.getByText('This movement must finish closer to the banner aura.', { exact: true }).waitFor({ state: 'visible' });
        await agree('Invalid path preserves token and pending response', s => s.tokens[1].x === 1300 && invocation(s, id)?.participants[index].status === 'pending' && !s.actors.ally.lastResponse);
        await player.waitForFunction(id => canvas.tokens._movementPlanningContext?.object?.id === id, f.tokens[1]);
        // Separate drag gestures beyond native double-click window; otherwise
        // the retry opens the actor sheet instead of beginning a second drag.
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      // Stay inside the destination snap cell, away from its half-grid tie.
      const end = await rpc(player, 'tokenPoint', { role: 'ally', x: 1020, y: 520 });
      await player.mouse.move(start.x, start.y); await player.mouse.down();
      await player.mouse.move(end.x, end.y, { steps: 12 });
      // Native movement throttles drag updates to rendered frames. Hold the
      // destination before release so the final path has reached that square.
      await new Promise(resolve => setTimeout(resolve, 250));
      await screenshot('held-drag');
      await player.mouse.up();
      await agree('Native movement enters aura and records response', s => s.tokens[1].x === 1000 && invocation(s, id)?.participants[index].status === 'responded');
    }
    await rpc(player, 'openPanel');
    await panel(player).evaluate(el => foundry.applications.instances.get(el.id).maximize());
  } else if (name === 'banner-damage-repair-replace') {
    await plant(); const b = (await state()).banners[0];
    await rpc(gm, 'damageFixture', { role: 'banner', damage: Math.ceil(b.max / 2) });
    await agree('Broken banner benefits disabled', s => s.placement?.broken === true);
    await action(gm, 'repairBanner').click();
    await dialog(gm, 'Repair banner').locator('input[name="hp"]').fill(String(b.max));
    await button(gm, 'Repair banner', 'Apply repair').click();
    await agree('Repair restores banner HP and benefits', s => s.banners[0].hp === b.max && !s.placement.broken);
    await rpc(gm, 'damageFixture', { role: 'banner', damage: b.max });
    await agree('Destroyed banner marked', s => s.placement?.removalMode === 'destroyed');
    check('Player replacement control absent', await action(player, 'replaceBanner').count() === 0);
    await action(gm, 'replaceBanner').click();
    await agree('Replacement clears destroyed placement and restores object HP', s => !s.placement && s.banners[0].hp === b.max);
  } else if (name === 'banner-theft-drop-pickup') {
    await take();
    await rpc(gm, 'bannerOperation', { operation: 'drop' });
    await agree('Dropped banner retains inactive placement', s => s.placement?.removalMode === 'dropped');
    await rpc(gm, 'bannerOperation', { operation: 'pickup' });
    await agree('Enemy can pick dropped banner back up', s => s.placement?.removalMode === 'carried');
    await rpc(gm, 'bannerOperation', { operation: 'force' });
    await agree('GM override cleans carried placement', s => !s.placement);
  } else if (name === 'banner-recovery-cancel-manual' || name === 'banner-recovery-native-check') {
    await take();
    await action(player, 'retrieveBanner').click();
    const ruling = gm.locator('.application, .window-app').filter({ has: gm.locator('[name="statistic"]') }).last();
    await ruling.waitFor({ state: 'visible' });
    if (name.endsWith('manual')) {
      await ruling.getByRole('button', { name: 'Cancel', exact: true }).click();
      await agree('Cancelled ruling preserves carrier', s => s.placement?.removalMode === 'carried');
      await action(player, 'retrieveBanner').click();
      await ruling.getByRole('button', { name: /manual/i }).click();
      await agree('Manual GM ruling restores banner', s => !s.placement);
    } else {
      const before = new Set((await state()).messages.map(m => m.id));
      await ruling.getByRole('button', { name: /roll|check/i }).first().click();
      await rollNative(player);
      let rolled;
      await eventually('Native recovery roll recorded', async () => {
        rolled = (await state()).messages.find(m => !before.has(m.id) && m.rolls.length);
        return !!rolled;
      });
      const degree = rolled.rolls[0].degree ?? ['criticalFailure', 'failure', 'success', 'criticalSuccess'].indexOf(rolled.context?.outcome);
      check('Recovery check has native degree of success', Number.isInteger(degree) && degree >= 0 && degree <= 3);
      await eventually('Player recovery request completed', async () => !(await action(player, 'retrieveBanner').count()) || await action(player, 'retrieveBanner').isEnabled());
      await agree('Native roll outcome governs banner recovery', s => degree >= 2 ? !s.placement : s.placement?.removalMode === 'carried');
    }
  } else if (name === 'banner-permission-range-rejection') {
    await plant();
    for (const operation of ['force', 'take']) {
      const rejected = operation === 'take'
        ? await ctx.expectConsoleError('module.pf2e-commanderer | remove-planted-banner Error: This token cannot remove that banner. It must be an adjacent enemy you own.', () => rpc(player, 'bannerRejection', { operation }))
        : await rpc(player, 'bannerRejection', { operation });
      check(`Player ${operation} rejected`, rejected.rejected);
    }
    await rpc(gm, 'positionFixture', { role: 'commander', x: 1400 });
    await eventually('Remote retrieval control disabled', () => action(player, 'retrieveBanner').isDisabled());
    const remote = await ctx.expectConsoleError('module.pf2e-commanderer | retrieve-banner Error: Move within unarmed reach of the planted banner before retrieving it.', () => rpc(player, 'bannerRejection', { operation: 'retrieve' }));
    check('Production retrieval also enforces reach', remote.rejected && remote.error.includes('within unarmed reach'));
    await agree('Rejected actions leave placement intact', s => !!s.placement && !s.placement.removed);
    await rpc(gm, 'bannerOperation', { operation: 'force' });
  } else if (name === 'dailies-preparation') {
    const id = await prepare('mountaineering-training');
    await agree('Real Dailies API consumes Commander preparation', s => s.actors.commander.dailies?.includes(id));
    await action(player, 'prepare').and(player.locator(`[data-item-id="${id}"]`)).click();
    await agree('Unprepare reflected by real Dailies API', s => !s.actors.commander.dailies.includes(id));
    await action(player, 'prepare').and(player.locator(`[data-item-id="${id}"]`)).click();
    await agree('Prepare restored through both module APIs', s => s.actors.commander.dailies.includes(id));
    check('Dailies preparation entry visible', await action(player, 'openDailies').isVisible());
  } else throw Error(`Unknown extended scenario: ${name}`);
  await screenshot('finished');
}
