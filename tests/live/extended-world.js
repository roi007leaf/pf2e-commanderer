import { fixtureActor, guard } from './world.js';

const SCOPE = 'pf2e-commanderer';
let task = null;
function actorFor(ctx, role = 'commander') {
  fixtureActor(ctx);
  const actor = game.actors.get(ctx.fixture[role]);
  if (actor?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Actor outside fixture');
  return actor;
}
function messageFor(ctx) {
  fixtureActor(ctx);
  const message = game.messages.get(ctx.messageId);
  if (message?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Message outside fixture');
  return message;
}

export async function addNative(ctx) {
  guard(ctx, true);
  const actor = actorFor(ctx, ctx.role);
  const existing = actor.items.find(i => i.slug === ctx.slug);
  if (existing) return existing.id;
  for (const id of ['pf2e.actionspf2e', 'pf2e.feats-srd', 'pf2e.classfeatures', 'pf2e.equipment-srd']) {
    const pack = game.packs.get(id);
    const index = await pack.getIndex({ fields: ['system.slug'] });
    const row = index.find(i => i.system.slug === ctx.slug);
    if (!row) continue;
    const source = (await pack.getDocument(row._id)).toObject(); delete source._id;
    source.system.rules = source.system.rules.filter(r => r.key !== 'ChoiceSet' && (r.key !== 'GrantItem' || ctx.preserveGrants) && !JSON.stringify(r).includes('{item|flags.system.rulesSelections.'));
    return (await actor.createEmbeddedDocuments('Item', [source]))[0].id;
  }
  throw Error(`Prerequisite: Missing native item: ${ctx.slug}`);
}

export async function resetExtended(ctx) {
  guard(ctx, true);
  const commander = actorFor(ctx);
  const { requestRetrieveBanner } = await import('../../scripts/foundry/banner.js');
  const { replaceDestroyedBanner } = await import('../../scripts/foundry/banner-object.js');
  const scene = game.scenes.get(ctx.fixture.scene);
  const placement = scene.getFlag(SCOPE, 'plantedBanners')?.[commander.id];
  if (placement?.removalMode === 'destroyed') await replaceDestroyedBanner(commander, scene);
  else if (placement) await requestRetrieveBanner(commander, scene, { force: true });
  for (const role of ['commander', 'ally', 'enemy']) {
    const actor = actorFor(ctx, role);
    const ids = actor.items.filter(i => ['effect', 'condition'].includes(i.type)).map(i => i.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
    await actor.update({ 'system.attributes.hp.value': actor.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
    for (const key of ['lastResponseRound', 'drilledReactions', 'featCooldowns', 'featImmunities', 'featFlourishTurn', 'opening', 'companion', 'companionAction']) {
      if (actor.getFlag(SCOPE, key) !== undefined) await actor.unsetFlag(SCOPE, key);
    }
  }
  await scene.updateEmbeddedDocuments('Token', ctx.fixture.tokens.map((id, i) => ({ _id: id, x: 500 + i * 100, y: 500 })), { animate: false });
  await commander.setFlag(SCOPE, 'squad', [{ actorUuid: actorFor(ctx, 'ally').uuid,
    tokenUuid: scene.tokens.get(ctx.fixture.tokens[1]).uuid, name: actorFor(ctx, 'ally').name, img: actorFor(ctx, 'ally').img }]);
  const { setBannerActive } = await import('../../scripts/foundry/runtime.js');
  await setBannerActive(commander, true);
}

export async function prepareTactic(ctx) {
  guard(ctx, true);
  const actor = actorFor(ctx);
  const itemId = await addNative(ctx);
  const { getDailiesApi } = await import('../../scripts/foundry/runtime.js');
  await actor.setFlag(getDailiesApi() ? 'pf2e-dailies' : SCOPE,
    getDailiesApi() ? 'extra.dailies.commander-tactics.tactics' : 'preparedTactics', [itemId]);
  return itemId;
}

export async function extendedSnapshot(ctx) {
  fixtureActor(ctx);
  const { bannerOrigin } = await import('../../scripts/foundry/banner.js');
  return {
    bannerOriginToken: bannerOrigin(actorFor(ctx))?.token?.id ?? null,
    actors: Object.fromEntries(['commander', 'ally', 'enemy'].map(role => {
      const a = actorFor(ctx, role);
      return [role, { id: a.id, hp: a.system.attributes.hp.value, maxHP: a.system.attributes.hp.max,
        effects: a.items.filter(i => ['effect', 'condition'].includes(i.type)).map(i => ({ id: i.id, name: i.name,
          slug: i.slug, expired: i.system.expired, workflow: i.getFlag(SCOPE, 'workflow'), rules: i.system.rules, origin: i.system.context?.origin })),
        lastResponse: a.getFlag(SCOPE, 'lastResponseRound') ?? null, cooldowns: a.getFlag(SCOPE, 'featCooldowns') ?? {},
        drilled: a.getFlag(SCOPE, 'drilledReactions')?.actors ?? [],
        conditions: { stupefied: a.getCondition('stupefied')?.value ?? 0, confused: a.hasCondition('confused'), frightened: a.getCondition('frightened')?.value ?? 0 },
        immunities: a.getFlag(SCOPE, 'featImmunities') ?? {},
        climb: a.system.movement.speeds.climb?.value ?? 0,
        swim: a.system.movement.speeds.swim?.value ?? 0,
        companion: a.getFlag(SCOPE, 'companion') ?? null,
        shield: a.heldShield ? { hp: a.heldShield.hitPoints.value, hardness: a.heldShield.hardness } : null,
        dailies: game.modules.get('pf2e-dailies')?.active ? (game.dailies?.api ?? game.modules.get('pf2e-dailies').api).getCommanderTactics(a) : null }];
    })),
    tokens: ctx.fixture.tokens.map(id => { const t = canvas.scene.tokens.get(id); return { x: t.x, y: t.y, planning: canvas.tokens._movementPlanningContext?.object?.id === id }; }),
    placement: canvas.scene.getFlag(SCOPE, 'plantedBanners')?.[ctx.fixture.commander] ?? null,
    banners: game.actors.filter(a => a.getFlag(SCOPE, 'bannerObject')?.commanderUuid === actorFor(ctx).uuid).map(a => ({ id: a.id, hp: a.system.attributes.hp.value, max: a.system.attributes.hp.max })),
    messages: game.messages.filter(m => m.getFlag(SCOPE, 'liveTestRun') === ctx.runId).map(m => ({ id: m.id, blind: m.blind,
      invocation: m.getFlag(SCOPE, 'invocation'), content: m.content,
      rolls: m.rolls.map(r => ({ total: r.total, formula: r.formula, degree: r.degreeOfSuccess })),
      context: m.flags.pf2e?.context })),
    combat: game.combat ? { id: game.combat.id, round: game.combat.round, turn: game.combat.turn } : null,
  };
}

export async function targetFixture(ctx) {
  fixtureActor(ctx);
  for (const t of [...game.user.targets]) t.setTarget(false);
  for (const role of ctx.roles ?? []) {
    const actor = actorFor(ctx, role);
    const token = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
    token.setTarget(true, { releaseOthers: false });
  }
}

export async function equipShield(ctx) {
  guard(ctx, true);
  const actor = actorFor(ctx);
  const id = await addNative({ ...ctx, slug: 'steel-shield' });
  const shield = actor.items.get(id);
  await shield.update({ 'system.equipped.carryType': 'held', 'system.equipped.handsHeld': 1,
    'system.hp.value': shield.hitPoints.max });
  return id;
}

export async function setAllyOwnership(ctx) {
  guard(ctx, true);
  const actor = actorFor(ctx, 'ally');
  const commander = actorFor(ctx);
  const userId = Object.entries(commander.ownership).find(([id, level]) => id !== 'default' && level === 3 && !game.users.get(id)?.isGM)?.[0];
  if (!userId) throw Error('Fixture player owner missing');
  await actor.update({ [`ownership.${userId}`]: ctx.owned ? 3 : 0 });
}
export function allyNotOwned(ctx) { return !actorFor(ctx, 'ally').isOwner; }

export async function startFeat(ctx) {
  const actor = actorFor(ctx);
  if (task?.status === 'running') throw Error('Previous QA workflow still running');
  const item = actor.items.find(i => i.slug === ctx.slug);
  if (!item) throw Error('Fixture feat missing');
  task = { status: 'running' };
  // Keep production asynchronous UI workflow alive while Playwright answers it.
  void game.modules.get(SCOPE).api.execute(item, actor).then(value => {
    task = { status: 'complete', value };
  }, error => { task = { status: 'rejected', error: error.message }; });
  return true;
}
export function taskStatus(ctx) { fixtureActor(ctx); return task; }
export async function startWorkflow(ctx) {
  const actor = fixtureActor(ctx);
  if (task?.status === 'running') throw Error('Previous QA workflow still running');
  const { requestCommanderWorkflow } = await import('../../scripts/foundry/feats.js');
  task = { status: 'running' };
  void requestCommanderWorkflow(actor, ctx.workflow).then(value => {
    task = { status: 'complete', value };
  }, error => { task = { status: 'rejected', error: error.message }; });
}

export async function responseRejection(ctx) {
  const message = messageFor(ctx);
  const { CommanderEngine } = await import('../../scripts/engine.js');
  try {
    await CommanderEngine.prototype.answer.call({}, message.id, ctx.index, { declined: ctx.declined === true });
    return { rejected: false };
  } catch (error) { return { rejected: true, error: error.message }; }
}

export async function bannerOperation(ctx) {
  fixtureActor(ctx);
  const api = await import('../../scripts/foundry/banner.js');
  const commander = actorFor(ctx);
  const enemy = canvas.tokens.get(ctx.fixture.tokens[2]);
  if (ctx.operation === 'take') return api.requestEnemyBannerRemoval(enemy, commander.id, 'carried');
  if (ctx.operation === 'pull') return api.requestEnemyBannerRemoval(enemy, commander.id, 'dropped');
  if (ctx.operation === 'drop') return api.requestCarriedBannerDrop(enemy, commander.id);
  if (ctx.operation === 'pickup') return api.requestDroppedBannerPickup(enemy, commander.id);
  if (ctx.operation === 'force') return api.requestRetrieveBanner(commander, canvas.scene, { force: true });
  if (ctx.operation === 'retrieve') return api.requestRetrieveBanner(commander, canvas.scene);
  if (ctx.operation === 'plant') return api.requestPlantBanner(commander, 'nw');
  throw Error('Unknown banner operation');
}
export async function bannerRejection(ctx) {
  try { await bannerOperation(ctx); return { rejected: false }; }
  catch (error) { return { rejected: true, error: error.message }; }
}
export async function positionFixture(ctx) {
  guard(ctx, true);
  const actor = actorFor(ctx, ctx.role);
  const token = canvas.scene.tokens.find(t => t.actorId === actor.id);
  await token.update({ x: ctx.x, y: ctx.y ?? 500 }, { animate: false });
}
export async function damageFixture(ctx) {
  guard(ctx, true);
  const actor = ctx.role === 'banner' ? game.actors.find(a => a.getFlag(SCOPE, 'bannerObject')?.commanderUuid === actorFor(ctx).uuid) : actorFor(ctx, ctx.role);
  if (actor?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Damage target outside fixture');
  await actor.update({ 'system.attributes.hp.value': Math.max(0, actor.system.attributes.hp.max - ctx.damage) });
}

export async function combatFixture(ctx) {
  guard(ctx, true); fixtureActor(ctx);
  if (ctx.operation === 'create') {
    const combat = await globalThis.Combat.create({ scene: ctx.fixture.scene, active: false,
      flags: { [SCOPE]: { liveTestRun: ctx.runId } },
      combatants: ctx.fixture.tokens.slice(0, 2).map((id, i) => ({ tokenId: id, actorId: ctx.fixture[i ? 'ally' : 'commander'], initiative: 20 - i * 5 })) });
    return combat.id;
  }
  const combat = game.combats.get(ctx.combatId);
  if (combat?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Combat outside fixture');
  if (ctx.operation === 'start') await combat.startCombat();
  else if (ctx.operation === 'next') await combat.nextRound();
  else if (ctx.operation === 'delete') await combat.delete();
  else throw Error('Unknown combat operation');
}
export async function viewCombat(ctx) {
  fixtureActor(ctx);
  const combat = game.combats.get(ctx.combatId);
  if (combat?.getFlag(SCOPE, 'liveTestRun') !== ctx.runId) throw Error('Combat outside fixture');
  await ui.combat.render({ force: true, combat });
}

export async function tokenPoint(ctx) {
  actorFor(ctx, ctx.role);
  const token = canvas.tokens.placeables.find(t => t.actor?.id === ctx.fixture[ctx.role]);
  // Put movement area beside the panel without changing any render functions.
  await canvas.animatePan({ x: token.center.x, y: token.center.y, scale: 0.7, duration: 0 });
  const point = canvas.stage.toGlobal(new PIXI.Point(ctx.x ?? token.center.x, ctx.y ?? token.center.y));
  return { x: point.x, y: point.y };
}

export function moduleConfiguration(ctx) {
  guard(ctx, true);
  return game.settings.get('core', 'moduleConfiguration');
}
export async function configureDailies(ctx) {
  guard(ctx, true);
  if (!game.modules.has('pf2e-dailies')) throw Error('Prerequisite: PF2e Dailies is not installed');
  const current = game.settings.get('core', 'moduleConfiguration');
  // Only this optional integration entry may change; restore its exact existence/value.
  if (ctx.restore) {
    if (ctx.saved.exists) current['pf2e-dailies'] = ctx.saved.value;
    else delete current['pf2e-dailies'];
  } else current['pf2e-dailies'] = true;
  await game.settings.set('core', 'moduleConfiguration', current);
}

export async function restoreWorldTime(ctx) {
  guard(ctx, true);
  if (!Number.isFinite(ctx.value)) throw Error('Invalid saved world time');
  await game.time.advance(ctx.value - game.time.worldTime);
}
