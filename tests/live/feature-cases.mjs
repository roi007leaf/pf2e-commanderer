import { TACTICS } from '../../scripts/domain/tactics.js';
import { featSlugs, tacticSlugs, featureMatrix, passiveFeats } from './feature-catalog.mjs';

// These drivers operate real dialogs, rolls and token gestures. No production
// function, dice implementation or Foundry document class is replaced.
export async function executeFeature(name, ctx, h) {
  const { gm, player, fixture: f, rpc, check, eventually, screenshot } = ctx;
  const { issue, startFeat, state: allState, agree, chat, invocation, panel } = h;
  const feature = featureMatrix.find(f => f.scenario === name);
  if (!feature) throw Error(`Unknown feature case ${name}`);
  const { slug, type } = feature;
  await rpc(gm, 'closeFeatureSheets'); await rpc(player, 'closeFeatureSheets');
  await rpc(gm, 'resetFeature');
  const earlierMessages = new Set((await allState()).messages.map(m => m.id));
  const state = async (page = gm) => {
    const s = await allState(page);
    return { ...s, messages: s.messages.filter(m => !earlierMessages.has(m.id)) };
  };
  const fs = (p = gm) => rpc(p, 'featureState');
  const equip = (itemSlug, role = 'commander', worn = false) => rpc(gm, 'equipFeature', { slug: itemSlug, role, worn,
    load: itemSlug === 'bolts' && ['executioners-volley', 'guiding-shot'].includes(slug) });
  const target = roles => rpc(player, 'targetFixture', { roles });
  const nativeItem = await rpc(gm, 'addNative', { slug, preserveGrants: slug === 'officers-medical-training' });
  const native = (await fs()).actors.commander.inventory.find(i => i.id === nativeItem);
  check('Native feature exists with exact slug', native?.slug === slug);
  check('Installed Commander feat catalog matches coverage inventory', JSON.stringify((await fs()).nativeFeats) === JSON.stringify(featSlugs));
  check('Installed tactic catalog matches coverage inventory', JSON.stringify((await fs()).nativeTactics) === JSON.stringify(tacticSlugs));

  // Explicit, bounded dialog driver; prompt history is assertion evidence.
  const prompts = [];
  let movements = 0;
  async function drive(done, { responder = 'ally', selection = {}, number = {}, no = [] } = {}) {
    for (const page of [gm, player]) await panel(page).evaluate(el => foundry.applications.instances.get(el.id).minimize());
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await done()) return;
      for (const page of [player, gm]) {
        const nativeChoice = page.locator('.application:visible button.select-button:visible, .window-app:visible button.select-button:visible').first();
        if (await nativeChoice.count()) {
          prompts.push(`Native rule choice: ${await nativeChoice.innerText()}`);
          await nativeChoice.click();
          continue;
        }
        const rolling = page.locator('.application:visible, .window-app:visible').filter({ has: page.getByRole('button', { name: /^Roll/ }) }).last();
        if (await rolling.count()) {
          const element = await rolling.elementHandle();
          await rolling.evaluate(el => {
            const app = foundry.applications.instances.get(el.id) ?? ui.windows[el.dataset.appid];
            if (app?.bringToFront) app.bringToFront(); else app?.bringToTop();
          });
          await rolling.getByRole('button', { name: /^Roll/ }).last().click();
          await element.waitForElementState('hidden');
          prompts.push('Native roll');
          continue;
        }
        const d = page.locator('.application.dialog:visible, .window-app.dialog:visible').last();
        if (!await d.count()) continue;
        if (!await d.locator('button').count()) continue;
        const dialogElement = await d.elementHandle();
        // Guided workflows also open actor sheets. Focus the native dialog as a
        // user would before continuing, without forcing clicks through a sheet.
        await d.evaluate(el => foundry.applications.instances.get(el.id)?.bringToFront());
        const text = await d.innerText();
        if (slug === 'targeting-strike' && text.includes("Resolve this attack's damage now")) {
          check('Native next-attack effect grants target-scoped precision damage', (await state()).actors.ally.effects.some(e => e.rules.some(r => r.damageCategory === 'precision' && r.predicate?.some(p => p.startsWith('target:signature:')))));
        }
        prompts.push(text.replace(/\s+/g, ' ').slice(0, 300));
        const selects = d.locator('select');
        if (await selects.count()) {
          const select = selects.first();
          const options = await select.locator('option').evaluateAll(os => os.map(o => ({ value: o.value, label: o.textContent })));
          const override = Object.entries(selection).find(([label]) => text.includes(label))?.[1];
          const desired = override ?? (text.includes('Strike') ? options.find(o => /longsword|crossbow|fist/i.test(o.label))?.value : undefined);
          if (desired !== undefined) await select.selectOption(String(desired));
        }
        const amount = d.locator('input[name="amount"]');
        if (await amount.count()) {
          const override = Object.entries(number).find(([label]) => text.includes(label))?.[1];
          if (override !== undefined) await amount.fill(String(override));
        }
        const yes = d.getByRole('button', { name: 'Yes', exact: true });
        if (await yes.count()) await d.getByRole('button', { name: no.some(s => text.includes(s)) ? 'No' : 'Yes', exact: true }).click();
        else {
          const next = d.getByRole('button', { name: /^(Continue|Swap positions|Plot Movement|Assign roles)$/ });
          if (!await next.count()) {
            if (text.trim().split('\n').length < 3) continue;
            throw Error(`Unhandled native dialog: ${text}`);
          }
          await next.first().click();
        }
        await dialogElement.waitForElementState('hidden');
      }
      const moving = await player.evaluate(() => canvas.tokens._movementPlanningContext?.object?.id ?? null);
      if (moving) {
        const role = moving === f.tokens[0] ? 'commander' : 'ally';
        check('Movement planner owns expected responder', role === responder);
        await player.bringToFront();
        await panel(player).evaluate(el => foundry.applications.instances.get(el.id).minimize());
        await new Promise(r => setTimeout(r, 600));
        const current = (await state()).tokens[role === 'commander' ? 0 : 1];
        const start = await rpc(player, 'tokenPoint', { role });
        const retreat = slug === 'defensive-retreat';
        const direct = TACTICS[slug]?.response.steps?.some(s => s.kind === 'movement' && s.target);
        const x = retreat ? current.x - 100 : direct ? current.x + 100 : current.x;
        const y = retreat || direct ? current.y : current.y === 500 ? 600 : 500;
        const end = await rpc(player, 'tokenPoint', { role, x: x + 20, y: y + 20 });
        await player.mouse.move(start.x, start.y); await player.mouse.down();
        await player.mouse.move(end.x, end.y, { steps: 12 });
        await new Promise(r => setTimeout(r, 250)); await player.mouse.up();
        await eventually('Native granted movement commits exact destination', async () => {
          const t = (await state()).tokens[role === 'commander' ? 0 : 1]; return t.x === x && t.y === y;
        });
        movements++;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    throw Error(`Feature workflow did not settle: ${slug}; prompts: ${prompts.join(' | ')}`);
  }
  async function finishFeat(options) {
    await drive(async () => {
      const task = await rpc(player, 'taskStatus');
      if (task?.status === 'rejected') throw Error(task.error);
      return task?.status === 'complete';
    }, options);
    check('Production feat completed successfully', (await rpc(player, 'taskStatus')).value === true);
  }

  if (type === 'tactic') {
    const def = TACTICS[slug];
    const responder = ['alley-oop', 'protective-screen', 'take-the-high-ground'].includes(slug) ? 'commander' : 'ally';
    if (def.response.steps?.some(s => s.kind === 'movement' && s.target)) {
      await rpc(gm, 'positionFixture', { role: responder === 'commander' ? 'ally' : 'enemy', x: responder === 'commander' ? 700 : 800 });
    }
    await equip('longsword', responder);
    if (['reload', 'ready-aim-fire', 'executioners-volley', 'corpse-crenellation'].includes(slug)) {
      await equip('crossbow', responder); await equip('bolts', responder, true);
    }
    if (['shields-up', 'mirrored-wall'].includes(slug)) await equip('steel-shield', responder);
    if (slug === 'alley-oop') await equip('healing-potion-minor', responder, true);
    if (slug === 'for-talmandor-for-freedom') await rpc(gm, 'featureCondition', { role: responder, slug: 'frightened', value: 1 });
    if (slug === 'valkyries-charge') await rpc(gm, 'damageFixture', { role: responder, damage: 35 });
    await rpc(gm, 'targetFixture', { roles: ['enemy'] });
    await target([['passage-of-lines'].includes(slug) ? 'commander' : ['protective-screen', 'take-the-high-ground'].includes(slug) ? 'ally' : 'enemy']);
    const id = await issue(slug, gm, { participant: responder === 'commander' ? 0 : 1, both: def.selection === 'two' });
    const order = invocation(await state(), id);
    const index = order.participants.findIndex(p => p.actorUuid === `Actor.${f[responder]}`);
    check('Invocation preserves exact native tactic and response kind', order.tacticSlug === slug && order.response.kind === def.response.kind && index >= 0);
    if (def.designatedTarget) check('Designated target persisted', order.response.targetUuid === `Scene.${f.scene}.Token.${f.tokens[2]}`);
    // Two-role tactics require Trip before the other participant's spell handoff.
    const selectedIndex = slug === 'slip-and-sizzle' ? order.participants.findIndex(p => p.role === 'trip') : index;
    const before = await fs();
    const source = before.actors[responder].inventory.find(i => i.slug === 'frightened');
    await chat(player, id, 'respond', selectedIndex).click();
    await drive(async () => invocation(await state(), id)?.participants[selectedIndex].status === 'responded', {
      responder,
      selection: { 'Reaction after Seek': 'finish', 'Granted attack': 'normal', 'Spellcasting result': 'spent',
        'effect to counteract': source?.id ?? 'skip', 'Following the Expert': '2',
        'Held/worn consumable': before.actors[responder].inventory.find(i => i.slug === 'healing-potion-minor')?.id },
      no: ['spend reaction to catch', 'Did Seek make', 'initial Shove or Reposition'],
    });
    await agree('Native response result and allowance synchronize', s => invocation(s, id)?.participants[selectedIndex].status === 'responded' && !!invocation(s, id).participants[selectedIndex].result);
    const result = invocation(await state(), id).participants[selectedIndex].result;
    check('Response used production automation', !/Completed manually/i.test(result));
    if (def.response.kind === 'sequence') check('Sequence performed native movement or action', movements > 0 || prompts.length > 0);
    if (slug === 'defensive-retreat') check('All three granted Steps completed', movements === 3);
    if (slug === 'passage-of-lines') await agree('Passage swaps exact actor positions', s => s.tokens[0].x === 600 && s.tokens[1].x === 500);
    if (slug === 'valkyries-charge') check('Valkyrie native healing restores missing HP', (await fs()).actors.ally.hp - before.actors.ally.hp === 35);
    if (slug === 'reload') check('Native reload attaches ammunition', (await fs()).actors[responder].inventory.some(i => i.slug === 'crossbow' && i.subitems.some(s => s.quantity > 0)));
    if (slug === 'alley-oop') check('Native transfer creates dropped receiver stack', (await fs()).actors.ally.inventory.some(i => i.slug === 'healing-potion-minor' && i.carry === 'dropped' && i.quantity === 1));
    if (slug === 'piranha-assault') await agree('Resistance reminder scoped to exact target', s => s.actors.ally.effects.some(e => e.workflow?.piranhaTarget === order.response.targetUuid));
    if (slug === 'for-talmandor-for-freedom') {
      const degree = (await state()).messages.findLast(m => m.rolls.length)?.rolls[0].degree;
      check('Counteract effect removal matches native degree and ranks', Number.isInteger(degree) &&
        (await fs()).actors[responder].inventory.some(i => i.id === source.id) === (degree === 0));
    }
    await rpc(player, 'openPanel');
    await panel(player).evaluate(el => foundry.applications.instances.get(el.id).maximize());
  } else if (passiveFeats.includes(slug)) {
    // Passive upgrades have no independent execute action: exercise their actual
    // prepared actor or the base workflow they modify.
    const before = await fs();
    if (['drilled-reflexes', 'practiced-reflexes'].includes(slug)) check('Live actor reaction allowance upgraded', before.drilledLimit === (slug === 'practiced-reflexes' ? 4 : 2));
    else if (['unrivaled-analysis', 'perfected-evaluations'].includes(slug)) {
      check('Live actor assessment capacity upgraded', before.assessmentLimit === (slug === 'perfected-evaluations' ? 6 : 4));
      await target(['enemy']); await startFeat('rapid-assessment');
      await finishFeat({ number: { 'Number of checks': 1 } });
      check('Native upgraded assessment prompt displays limit', prompts.some(p => p.includes(`maximum ${before.assessmentLimit}`)));
    } else if (slug === 'efficient-preparation') check('Live actor prepared tactic capacity increases', before.preparationLimit === 4);
    else if (slug === 'claim-the-field') {
      await rpc(gm, 'plantClaimFixture');
      await agree('Thrown banner persists remote location and Claim protection', s => s.placement?.claimTheField === true && s.placement.x === 900 && s.placement.y === 500);
      await rpc(gm, 'positionFixture', { role: 'enemy', x: 800 });
      await rpc(gm, 'startClaimAttempt');
      await drive(async () => {
        const attempt = await rpc(gm, 'claimAttemptStatus');
        if (attempt?.status === 'rejected') throw Error(attempt.error);
        return attempt?.status === 'complete';
      });
      const degree = (await state()).messages.findLast(m => m.context?.type === 'saving-throw')?.rolls[0].degree;
      check('Claim protection produces native Will save', Number.isInteger(degree));
      await agree('Native Will degree governs attempted banner theft', s => degree >= 2 ? s.placement?.removalMode === 'carried' : !s.placement?.removed);
    }
    else if (slug === 'contact-with-the-enemy') { await h.adaptive({ outgoing: 'piranha-assault' }); }
    else if (['glorious-banner', 'battle-tested-companion', 'peerless-mascot-companion', 'battle-hardened-companion'].includes(slug)) {
      if (slug === 'glorious-banner') check('Live held banner radius increases to 60', before.radius === 60);
      else {
        await target(['ally']); await startFeat('commanders-companion');
        await finishFeat({ selection: { 'Companion action': 'done' } });
        const expected = slug === 'peerless-mascot-companion' ? 60 : slug === 'battle-tested-companion' ? 40 : 30;
        check('Companion upgrade changes live banner origin/radius', (await fs()).radius === expected);
        if (slug === 'battle-hardened-companion') check('Independent action offered by upgraded native dialog', prompts.some(p => p.includes('Independent Stride/Strike')));
      }
    } else if (['targeting-strike', 'fortunate-blow', 'observational-analysis'].includes(slug)) {
      await equip('longsword'); await rpc(gm, 'positionFixture', { role: 'enemy', x: 400 });
      await rpc(gm, 'featureCheckFixture', { role: 'enemy', selector: 'ac' });
      await target(['enemy']); await startFeat(slug === 'observational-analysis' ? 'combat-assessment' : 'set-up-strike');
      await finishFeat();
      check('Upgrade participates in native attack workflow', prompts.includes('Native roll'));
      if (slug === 'observational-analysis') check('Observation upgrade asks prior-target eligibility', prompts.some(p => p.includes('since the start of your last turn')));
      else {
        check('Damaging Strike records upgraded opening', (await fs()).opening?.damaged === true);
        await target(['ally']); await rpc(player, 'startWorkflow', { workflow: 'opening' });
        await finishFeat();
        check('Next native attack consumes upgraded opening', !(await fs()).opening);
        if (slug === 'fortunate-blow') check('Native fortune attack rolls twice and keeps higher', (await state()).messages.some(m => m.rolls.some(r => /2d20kh/.test(r.formula))));
      }
    } else if (slug === 'officers-medical-training') {
      await eventually('Native medical training grants Medicine proficiency, Intelligence modifier and Battle Medicine', async () => {
        const states = await Promise.all([gm, player].map(fs));
        return states.every(s => s.actors.commander.medicine.rank >= 1 && s.actors.commander.medicine.modifiers.some(m => m.ability === 'int' && m.enabled) && s.actors.commander.inventory.some(i => i.slug === 'battle-medicine'));
      });
    } else {
      const posted = await rpc(gm, 'postFeature', { slug });
      await eventually('Native feat rules card renders for owning player', () => player.locator(`[data-message-id="${posted.id}"]`).first().isVisible());
      check('Native feat rules handoff retains feature identity', (await state()).messages.find(m => m.id === posted.id)?.content.includes(posted.name));
      check('Passive feat retained on real actor without duplicate module grant', (await fs()).actors.commander.inventory.filter(i => i.slug === slug).length === 1);
    }
  } else {
    if (slug === 'armored-regiment-training') await equip('full-plate');
    const before = await fs();
    await target(['banners-inspiration', 'desperate-resuscitation'].includes(slug) ? ['ally'] : ['enemy']);
    if (slug === 'banners-inspiration') await rpc(gm, 'featureCondition', { role: 'ally', slug: 'frightened', value: 2 });
    if (['guiding-shot', 'set-up-strike', 'unsteadying-strike', 'combat-assessment', 'reactive-strike'].includes(slug)) {
      await equip(slug === 'guiding-shot' ? 'crossbow' : 'longsword');
      if (slug === 'guiding-shot') await equip('bolts', 'commander', true);
      await rpc(gm, 'positionFixture', { role: 'enemy', x: 400 });
      await rpc(gm, 'featureCheckFixture', { role: 'enemy', selector: 'ac' });
    }
    if (slug === 'desperate-resuscitation') {
      await rpc(gm, 'featureCheckFixture', { role: 'commander', selector: 'medicine' });
      await rpc(gm, 'damageFixture', { role: 'ally', damage: 999 });
    }
    let combatId;
    if (slug === 'mercenary-reversal') {
      combatId = await rpc(gm, 'combatFixture', { operation: 'create' });
      for (const p of [gm, player]) { await p.waitForFunction(id => game.combats.has(id), combatId); await rpc(p, 'viewCombat', { combatId }); }
      await rpc(gm, 'combatFixture', { operation: 'start', combatId });
    }
    await startFeat(slug);
    await finishFeat({ selection: { 'mental effect to retry': 'skip', 'Action using Warfare Lore': 'feint' }, number: { 'Number of checks': 1 } });
    const after = await fs();
    if (slug === 'banners-inspiration') check('Native frightened condition reduced exactly once', after.actors.ally.conditions.frightened === 1);
    if (slug === 'quickening-banner') check('Ally gains native quickened; enemy excluded', after.actors.ally.conditions.quickened && !after.actors.enemy.conditions.quickened);
    if (slug === 'pennant-of-victory') check('Native effect grants 40 temporary HP', after.actors.ally.temp === 40);
    if (slug === 'defiant-banner') await agree('Native resistance rules granted to allies', s => s.actors.ally.effects.some(e => e.rules.some(r => r.key === 'Resistance')) && !s.actors.enemy.effects.some(e => e.name.includes('Defiant Banner')));
    if (slug === 'desperate-resuscitation') check('Native revival restores 1 HP, wounded and recovery conditions with immunity', Number(after.actors.ally.resuscitation) > 0 && after.actors.ally.hp === 1 && after.actors.ally.conditions.wounded === 1 && ['clumsy', 'drained', 'enfeebled'].every(s => after.actors.ally.conditions[s] === 2));
    if (['rapid-assessment', 'combat-assessment', 'guiding-shot', 'set-up-strike', 'unsteadying-strike', 'reactive-strike', 'deceptive-tactics', 'demand-surrender', 'mercenary-reversal', 'standard-bearers-sacrifice'].includes(slug)) check('Feature performs native PF2e roll', prompts.includes('Native roll'));
    if (['rapid-assessment', 'combat-assessment'].includes(slug)) check('Recall Knowledge produces native secret roll', (await state()).messages.some(m => m.blind && m.rolls.length));
    if (slug === 'combat-assessment') check('Assessment records target immunity', !!(await state()).actors.enemy.immunities['combat-assessment']);
    if (['guiding-shot', 'set-up-strike'].includes(slug)) check('Hit records target-specific attack opening', after.opening?.slug === slug && after.opening?.targetUuid === `Scene.${f.scene}.Token.${f.tokens[2]}`);
    if (slug === 'unsteadying-strike') await agree('Hit applies native maneuver penalty rules', s => s.actors.enemy.effects.some(e => e.name.includes('Unsteadying Strike') && e.rules.length > 0));
    if (slug === 'reactive-strike') check('Reactive Strike bypasses MAP chooser', !prompts.some(p => p.includes('Multiple attack penalty')));
    if (['demand-surrender', 'mercenary-reversal'].includes(slug)) {
      const actual = await state();
      const degree = actual.messages.findLast(m => m.context?.type === 'saving-throw')?.rolls[0].degree;
      check('Native save has valid degree', Number.isInteger(degree));
      if (slug === 'demand-surrender') check('Surrender restriction matches save degree', actual.actors.enemy.effects.some(e => e.workflow?.surrender) === (degree < 3));
      else check('Mercenary consequence matches save degree', degree === 3 ? !!actual.actors.enemy.immunities[slug] : degree === 2 ? after.actors.enemy.conditions.stunned === 1 : actual.actors.enemy.effects.some(e => e.workflow?.mercenary));
    }
    if (slug === 'armored-regiment-training') {
      await eventually('Native heavy armor Bulk reduced by exactly one', async () => {
        const states = await Promise.all([gm, player].map(fs));
        return states.every(s => s.actors.commander.inventory.some(i => i.slug === 'full-plate' && i.bulk === i.sourceBulk - 1));
      });
      check('Exploration guidance preserves HP', after.actors.commander.hp === before.actors.commander.hp);
    }
    if (combatId) await rpc(gm, 'combatFixture', { operation: 'delete', combatId });
  }
  for (const page of [gm, player]) {
    await rpc(page, 'closeFeatureSheets');
    await panel(page).evaluate(el => foundry.applications.instances.get(el.id).maximize());
  }
  await screenshot('feature');
}
