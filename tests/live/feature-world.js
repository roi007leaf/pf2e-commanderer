import { fixtureActor, guard } from './world.js';
import { addNative } from './extended-world.js';
import { featSlugs } from './feature-catalog.mjs';
const SCOPE = 'pf2e-commanderer';
let claimAttempt = null;
function actor(ctx, role = 'commander') {
  fixtureActor(ctx);
  const a = game.actors.get(ctx.fixture[role]);
  if (a?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Actor outside fixture');
  return a;
}
export async function resetFeature(ctx) {
  guard(ctx, true);
  const a = actor(ctx);
  if (a.getFlag(SCOPE, 'bannerConfiguration')) await a.unsetFlag(SCOPE, 'bannerConfiguration');
  // Isolate upgrades: one feature must not accidentally satisfy a later case.
  const ids = a.items.filter(i => featSlugs.includes(i.slug) && i.slug !== 'plant-banner').map(i => i.id);
  if (ids.length) await a.deleteEmbeddedDocuments('Item', ids);
  for (const role of ['commander', 'ally', 'enemy']) {
    const a = actor(ctx, role);
    const gear = a.items.filter(i => i.getFlag(SCOPE, 'featureEquipment')).map(i => i.id);
    if (gear.length) await a.deleteEmbeddedDocuments('Item', gear);
    for (const key of ['resuscitation-immunity', 'cry-havoc-immunity']) if (a.getFlag(SCOPE, key) !== undefined) await a.unsetFlag(SCOPE, key);
  }
}
export async function equipFeature(ctx) {
  guard(ctx, true);
  const a = actor(ctx, ctx.role);
  const id = await addNative(ctx);
  const item = a.items.get(id);
  const worn = ctx.worn || item.type === 'armor';
  const update = { [`flags.${SCOPE}.featureEquipment`]: true,
    'system.equipped.carryType': worn ? 'worn' : 'held',
    'system.equipped.handsHeld': worn ? 0 : item.system.usage?.value?.includes('two-hands') ? 2 : 1 };
  if (item.type === 'armor') update['system.equipped.inSlot'] = true;
  if (['ammo', 'consumable'].includes(item.type)) update['system.quantity'] = 5;
  await item.update(update);
  if (ctx.load) {
    const weapon = a.items.find(i => i.slug === 'crossbow');
    if (!weapon || !item.isAmmoFor?.(weapon)) throw Error('Fixture ammunition is incompatible');
    await weapon.attach(item, { quantity: 1, stack: true });
  }
  return id;
}
export async function featureCondition(ctx) {
  guard(ctx, true);
  await actor(ctx, ctx.role).increaseCondition(ctx.slug, { value: ctx.value ?? 1 });
}
export async function featureCheckFixture(ctx) {
  guard(ctx, true);
  const a = actor(ctx, ctx.role);
  if (!['ac', 'medicine'].includes(ctx.selector)) throw Error('Unknown fixture statistic');
  await a.createEmbeddedDocuments('Item', [{ name: 'QA native check fixture', type: 'effect', img: 'icons/svg/d20.svg',
    system: { rules: [{ key: 'FlatModifier', selector: ctx.selector, type: 'untyped', value: ctx.selector === 'ac' ? -40 : 50 }],
      duration: { value: -1, unit: 'unlimited', expiry: null, sustained: false } } }]);
}
export async function postFeature(ctx) {
  guard(ctx, true);
  const a = actor(ctx);
  const id = await addNative(ctx);
  const message = await a.items.get(id).toMessage();
  return { id: message.id, name: a.items.get(id).name };
}
export async function plantClaimFixture(ctx) {
  guard(ctx, true);
  const a = actor(ctx);
  const id = await equipFeature({ ...ctx, slug: 'javelin' });
  await a.setFlag(SCOPE, 'bannerConfiguration', { itemId: id });
  const { requestPlantBanner } = await import('../../scripts/foundry/banner.js');
  await requestPlantBanner(a, { x: 900, y: 500 });
}
export async function startClaimAttempt(ctx) {
  guard(ctx, true);
  const { requestEnemyBannerRemoval } = await import('../../scripts/foundry/banner.js');
  const token = canvas.tokens.get(ctx.fixture.tokens[2]);
  actor(ctx, 'enemy');
  claimAttempt = { status: 'running' };
  void requestEnemyBannerRemoval(token, actor(ctx).id, 'carried').then(value => {
    claimAttempt = { status: 'complete', value };
  }, error => { claimAttempt = { status: 'rejected', error: error.message }; });
}
export function claimAttemptStatus(ctx) { fixtureActor(ctx); return claimAttempt; }
export async function closeFeatureSheets(ctx) {
  for (const role of ['commander', 'ally', 'enemy']) {
    const a = actor(ctx, role);
    if (a.sheet.rendered) await a.sheet.close();
  }
}
export async function featureState(ctx) {
  const a = actor(ctx);
  const rules = await import('../../scripts/domain/feat-rules.js');
  const { preparationLimit } = await import('../../scripts/foundry/runtime.js');
  const { bannerOrigin } = await import('../../scripts/foundry/banner.js');
  const pack = game.packs.get('pf2e.feats-srd');
  const index = await pack.getIndex({ fields: ['system.slug', 'system.traits.value'] });
  const actions = await game.packs.get('pf2e.actionspf2e').getIndex({ fields: ['system.slug', 'system.traits.value'] });
  return {
    nativeFeats: index.filter(i => i.system.traits.value.includes('commander')).map(i => i.system.slug).sort(),
    nativeTactics: actions.filter(i => i.system.traits.value.includes('tactic')).map(i => i.system.slug).sort(),
    drilledLimit: rules.drilledReactionLimit(a), assessmentLimit: rules.assessmentLimit(a),
    preparationLimit: preparationLimit(a), radius: bannerOrigin(a)?.radius,
    opening: a.getFlag(SCOPE, 'opening'),
    actors: Object.fromEntries(['commander', 'ally', 'enemy'].map(role => {
      const target = actor(ctx, role);
      return [role, { hp: target.system.attributes.hp.value, temp: target.system.attributes.hp.temp,
        medicine: { rank: target.getStatistic('medicine')?.rank, modifiers: target.getStatistic('medicine')?.modifiers?.map(m => ({ type: m.type, ability: m.ability, enabled: m.enabled })) },
        resuscitation: target.getFlag(SCOPE, 'resuscitation-immunity'),
        companionAction: target.getFlag(SCOPE, 'companionAction'),
        conditions: Object.fromEntries(['quickened', 'frightened', 'prone', 'fleeing', 'stunned', 'wounded', 'clumsy', 'drained', 'enfeebled', 'slowed'].map(s => [s, target.getCondition(s)?.value ?? target.hasCondition(s)])),
        inventory: target.items.map(i => ({ id: i.id, slug: i.slug, type: i.type, quantity: i.quantity, carry: i.system.equipped?.carryType,
          rules: i.system.rules, sourceRules: i._source.system.rules, bulk: i.system.bulk?.value, sourceBulk: i._source.system.bulk?.value,
          subitems: i.subitems?.map(s => ({ slug: s.slug, quantity: s.quantity })) ?? [] })),
      }];
    })),
  };
}
