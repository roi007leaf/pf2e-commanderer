// Imported by isolated QA browser sessions only; never loaded by module.json.
import { assertQaWorld } from './world-guard.mjs';

const SCOPE = 'pf2e-commanderer';
const TAG = 'liveTestRun';
const hooks = [];

export function validateRunId(runId) {
  if (typeof runId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) throw Error('Invalid live-test run ID');
}

export function guard({ world, runId }, gm = false) {
  assertQaWorld(game.world.id, world);
  validateRunId(runId);
  if (gm && !game.user.isGM) throw Error('QA GM required');
}

function tagged(document, runId) { return document?.getFlag(SCOPE, TAG) === runId; }

export function preflight({ world }) {
  assertQaWorld(game.world.id, world);
  if (game.system.id !== 'pf2e' || Number(game.version.split('.')[0]) !== 14) throw Error('Foundry 14 / PF2e required');
  if (!game.modules.get(SCOPE)?.api?.open) throw Error('Commanderer must be active and ready');
  return { world: game.world.id, user: game.user.id, isGM: game.user.isGM,
    scene: canvas.scene?.id ?? null, level: canvas.level?.id ?? null,
    controlled: canvas.tokens.controlled.map(t => t.id), targeted: [...game.user.targets].map(t => t.id),
    paused: game.paused, core: game.version, system: game.system.version,
    combat: game.combat?.id ?? null,
    worldTime: game.time.worldTime,
    module: game.modules.get(SCOPE).version,
    modules: [...game.modules.values()].filter(m => m.active).map(m => ({ id: m.id, version: m.version })) };
}

export function installTaggers(context) {
  guard(context);
  removeTaggers();
  for (const name of ['preCreateChatMessage', 'preCreateActor']) {
    const id = Hooks.on(name, document => {
      if (!tagged(canvas.scene, context.runId)) return;
      // Production-created banner actors belong to this fixture only.
      if (name === 'preCreateActor' && !document.getFlag(SCOPE, 'bannerObject')) return;
      document.updateSource({ [`flags.${SCOPE}.${TAG}`]: context.runId });
    });
    hooks.push([name, id]);
  }
}

export function removeTaggers() {
  for (const [name, id] of hooks.splice(0)) Hooks.off(name, id);
}

export async function prerequisites({ world }) {
  assertQaWorld(game.world.id, world);
  const requests = [
    ['pf2e.classfeatures', 'commanders-banner'], ['pf2e.feats-srd', 'plant-banner'],
    ['pf2e.actionspf2e', 'mountaineering-training'],
  ];
  const items = [];
  for (const [packId, slug] of requests) {
    const pack = game.packs.get(packId);
    const index = await pack?.getIndex({ fields: ['system.slug'] });
    const row = index?.find(i => i.system.slug === slug);
    if (!row) return { blocked: `Missing native compendium item: ${slug}` };
    items.push(`${packId}.${row._id}`);
  }
  return { items };
}

export async function setup(context) {
  guard(context, true);
  const { runId, player, items } = context;
  const flags = { [SCOPE]: { [TAG]: runId } };
  const actors = [];
  const iconic = await fromUuid('Compendium.pf2e.iconics.Actor.gPQFd6gJEMxtgi8x');
  if (!iconic) throw Error('Native Ulka iconic fixture unavailable');
  for (const name of ['Commander', 'Ally', 'Enemy']) {
    const source = iconic.toObject(); delete source._id;
    source.name = `QA ${name} ${runId.slice(0, 8)}`;
    source.ownership = { default: 0, ...(name === 'Enemy' ? {} : { [player]: 3 }) };
    source.flags = flags;
    source.system.details.alliance = name === 'Enemy' ? 'opposition' : 'party';
    actors.push(await Actor.create(source, { renderSheet: false }));
  }
  for (const id of items) {
    const source = (await fromUuid(`Compendium.${id}`)).toObject();
    if (actors[0].items.some(i => i.slug === source.system.slug)) continue;
    delete source._id;
    // This fixture tests item consumers, not character-building choice prompts.
    source.system.rules = source.system.rules.filter(r => !['ChoiceSet', 'GrantItem'].includes(r.key));
    await actors[0].createEmbeddedDocuments('Item', [source]);
  }
  const scene = await globalThis.Scene.create({ name: `Commander QA ${runId.slice(0, 8)}`,
    width: 1800, height: 1400, padding: 0, grid: { type: 1, size: 100, distance: 5 },
    tokenVision: false, navigation: true, ownership: { default: 0, [player]: 3 }, flags,
  });
  const tokens = [];
  for (let i = 0; i < actors.length; i++) {
    const token = await actors[i].getTokenDocument({ name: actors[i].name, x: 500 + i * 100, y: 500, actorLink: true, flags });
    tokens.push((await scene.createEmbeddedDocuments('Token', [token.toObject()]))[0]);
  }
  const { setBannerActive } = await import('../../scripts/foundry/runtime.js');
  await setBannerActive(actors[0], true);
  return { scene: scene.id, commander: actors[0].id, ally: actors[1].id, enemy: actors[2].id,
    tokens: tokens.map(t => t.id), tactic: actors[0].items.find(i => i.slug === 'mountaineering-training').id };
}

export function fixtureActor(context) {
  guard(context);
  const actor = game.actors.get(context.fixture.commander);
  if (!tagged(actor, context.runId) || !tagged(game.scenes.get(context.fixture.scene), context.runId)) throw Error('Document outside test fixture');
  return actor;
}

export async function view(context) {
  fixtureActor(context);
  await game.scenes.get(context.fixture.scene).view();
  if (canvas.scene?.id !== context.fixture.scene) throw Error('Fixture scene not viewed');
}

export async function openPanel(context) {
  const actor = fixtureActor(context);
  if (!actor.isOwner) throw Error('Fixture owner required');
  canvas.tokens.get(context.fixture.tokens[0])?.control({ releaseOthers: true });
  await game.modules.get(SCOPE).api.open(actor);
}

export async function snapshot(context) {
  const actor = fixtureActor(context);
  const { bannerActive, preparedTacticIds } = await import('../../scripts/foundry/runtime.js');
  const placement = game.scenes.get(context.fixture.scene).getFlag(SCOPE, 'plantedBanners')?.[actor.id];
  return { active: bannerActive(actor), prepared: [...preparedTacticIds(actor)],
    squad: (actor.getFlag(SCOPE, 'squad') ?? []).map(a => a.actorUuid),
    planted: !!placement, radius: placement?.radius ?? null,
    bannerActors: game.actors.filter(a => a.getFlag(SCOPE, 'bannerObject')?.commanderUuid === actor.uuid).map(a => a.id),
    messages: game.messages.filter(m => tagged(m, context.runId)).map(m => ({ id: m.id,
      bannerRules: !!m.getFlag(SCOPE, 'bannerRules'), origin: !!m.flags.pf2e?.origin })),
  };
}

export * from './extended-world.js';
export * from './feature-world.js';

export async function moveAlly(context) {
  fixtureActor(context); guard(context, true);
  const scene = game.scenes.get(context.fixture.scene);
  const token = scene.tokens.get(context.fixture.tokens[1]);
  if (!tagged(token, context.runId)) throw Error('Token outside test fixture');
  await token.update({ x: context.x }, { animate: false });
}

export async function checkPlayerPermissions(context) {
  const actor = fixtureActor(context);
  if (game.user.isGM) throw Error('Real player session required');
  const enemy = game.actors.get(context.fixture.enemy);
  if (!tagged(enemy, context.runId)) throw Error('Enemy outside test fixture');
  const before = actor.getFlag(SCOPE, 'squadLimit');
  const { setSquadLimit } = await import('../../scripts/foundry/squad.js');
  let rejected = false;
  try { await setSquadLimit(actor, 99); } catch (error) { rejected = error.message === 'Only a GM can change squad limits.'; }
  return { overrideRejected: rejected && actor.getFlag(SCOPE, 'squadLimit') === before,
    nonOwnerRejected: !enemy.isOwner && game.modules.get(SCOPE).api.open(enemy) === null };
}

export function leftovers(context) {
  guard(context, true);
  const actors = game.actors.filter(d => tagged(d, context.runId));
  const scenes = game.scenes.filter(d => tagged(d, context.runId));
  const actorIds = new Set(actors.map(d => d.id));
  const sceneIds = new Set(scenes.map(d => d.id));
  return {
    messages: game.messages.filter(d => tagged(d, context.runId) || actorIds.has(d.speaker?.actor) || sceneIds.has(d.speaker?.scene)).map(d => d.id),
    combats: game.combats.filter(d => tagged(d, context.runId) || sceneIds.has(d.scene?.id)).map(d => d.id),
    scenes: [...sceneIds], actors: [...actorIds],
  };
}

export async function cleanup(context) {
  const ids = leftovers(context);
  // Retain reference actors/scenes if message deletion fails, for recovery.
  if (ids.messages.length) await ChatMessage.deleteDocuments(ids.messages);
  const failures = [];
  for (const [type, key] of [['Combat', 'combats'], ['Scene', 'scenes'], ['Actor', 'actors']]) {
    try { if (ids[key].length) await globalThis[type].deleteDocuments(ids[key]); } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, 'Fixture cleanup failed');
}

export async function restore(context) {
  guard(context);
  const saved = context.saved;
  if (game.user.id !== saved.user) throw Error('Restoration requires original account');
  for (const app of [...foundry.applications.instances.values()]) {
    if (app.id.startsWith('pf2e-commanderer-panel-') && tagged(app.actor, context.runId)) await app.close();
  }
  if (saved.scene) {
    if (!game.scenes.has(saved.scene)) throw Error('Original scene missing');
    await game.scenes.get(saved.scene).view(saved.level ? { level: saved.level } : {});
    if (canvas.scene?.id !== saved.scene || (saved.level && canvas.level?.id !== saved.level)) throw Error('Original scene or level not restored');
  } else await canvas.draw(null);
  canvas.tokens.releaseAll();
  for (const id of saved.controlled) canvas.tokens.get(id)?.control({ releaseOthers: false });
  for (const token of [...game.user.targets]) token.setTarget(false);
  for (const id of saved.targeted) canvas.tokens.get(id)?.setTarget(true, { releaseOthers: false });
  if (canvas.tokens.controlled.map(t => t.id).sort().join(',') !== [...saved.controlled].sort().join(',') ||
    [...game.user.targets].map(t => t.id).sort().join(',') !== [...saved.targeted].sort().join(',')) throw Error('Original token selection/targets not restored');
  removeTaggers();
  if (saved.combat && game.combats.has(saved.combat)) await ui.combat.render({ force: true, combat: game.combats.get(saved.combat) });
}

export async function setPause(context) {
  guard(context, true);
  await game.togglePause(context.paused, { broadcast: true });
}
