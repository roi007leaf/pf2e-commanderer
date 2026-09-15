import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { finishCleanup, writeJournal, readJournal, validateCredentials } from './lifecycle.mjs';
import { coverageFor, casePassed, selectCases } from './coverage.mjs';
import { assessMatrix } from './evidence.mjs';
import { fullCases } from './cases.mjs';
import { assertFeatureCatalog, featureCoverage, featureMatrix, featSlugs, tacticSlugs } from './feature-catalog.mjs';
import { guard, cleanup, fixtureActor, validateRunId } from './world.js';
import { configureDailies, damageFixture } from './extended-world.js';

const runId = 'd6804ea8-ac62-42b8-9f39-1f03249a5a21';
const passed = name => ({ name, status: 'pass', assertions: [{ passed: true }], screenshots: ['evidence.png'], errors: [] });

test('Dailies activation/recovery preserves unrelated module settings and exact original entry', async () => {
  const original = globalThis.game;
  try {
    for (const initial of [{ other: true }, { other: true, 'pf2e-dailies': false }, { other: true, 'pf2e-dailies': true }]) {
      let config = structuredClone(initial);
      globalThis.game = { world: { id: 'qa' }, user: { isGM: true }, modules: new Map([['pf2e-dailies', {}]]),
        settings: { get: () => structuredClone(config), set: async (scope, key, value) => {
          assert.equal(scope, 'core'); assert.equal(key, 'moduleConfiguration'); config = value;
        } } };
      const saved = { exists: Object.hasOwn(initial, 'pf2e-dailies'), value: initial['pf2e-dailies'] ?? null };
      await configureDailies({ world: 'qa', runId });
      assert.deepEqual(config, { other: true, 'pf2e-dailies': true });
      await configureDailies({ world: 'qa', runId, restore: true, saved });
      assert.deepEqual(config, initial);
      game.user.isGM = false;
      await assert.rejects(configureDailies({ world: 'qa', runId }), /GM required/);
      assert.deepEqual(config, initial);
    }
  } finally { globalThis.game = original; }
});

test('banner damage helper refuses untagged actor even when it references fixture commander', async () => {
  const original = globalThis.game;
  const commander = { uuid: 'Actor.commander', getFlag: () => runId };
  const banner = { getFlag: (_scope, key) => key === 'bannerObject' ? { commanderUuid: commander.uuid } : null,
    update: async () => assert.fail('Foreign actor mutated') };
  try {
    globalThis.game = { world: { id: 'qa' }, user: { isGM: true },
      actors: { get: () => commander, find: predicate => predicate(banner) ? banner : null },
      scenes: new Map([['scene', { getFlag: () => runId }]]) };
    await assert.rejects(damageFixture({ world: 'qa', runId, fixture: { commander: 'commander', scene: 'scene' }, role: 'banner', damage: 10 }), /outside fixture/);
  } finally { globalThis.game = original; }
});

test('catalog filters reject typos; smoke and full stay distinct', () => {
  assert.equal(selectCases(fullCases).length, 4);
  assert.equal(selectCases(fullCases, { full: true }).length, 103);
  assert.equal(selectCases(fullCases, { filter: 'player-plant-retrieve' })[0].name, 'player-plant-retrieve');
  assert.throws(() => selectCases(fullCases, { filter: 'typo' }), /Unknown/);
  assert.throws(() => selectCases([{ name: '../escape' }]));
});

test('every Commander feat and tactic has an executable live scenario', () => {
  assert.equal(featSlugs.length, 43);
  assert.equal(tacticSlugs.length, 37);
  assert.deepEqual(assertFeatureCatalog(fullCases), { feats: 43, tactics: 37 });
  for (const feature of featureMatrix) {
    assert.throws(() => assertFeatureCatalog(fullCases.filter(c => c.name !== feature.scenario)), /Missing live feature/);
  }
});

test('feature report requires passing assertions and screenshots for each mapped item', () => {
  const row = featureMatrix[0];
  assert.equal(featureCoverage([]).find(f => f.slug === row.slug).status, 'unrun');
  assert.equal(featureCoverage([{ name: row.scenario, status: 'pass' }]).find(f => f.slug === row.slug).status, 'failed');
  assert.equal(featureCoverage([passed(row.scenario)]).find(f => f.slug === row.slug).status, 'pass');
  assert.equal(featureCoverage([{ ...passed(row.scenario), status: 'blocked' }]).find(f => f.slug === row.slug).status, 'blocked');
});

test('blocked, unrun and missing evidence cannot certify shipping', () => {
  assert.equal(casePassed({ status: 'pass' }), false);
  const report = { sourceFingerprint: 'hash', cleanup: 'complete', startupErrors: [],
    environment: { core: '14.1' }, cases: fullCases.map(c => passed(c.name)) };
  assert.equal(assessMatrix(fullCases, [report], 'hash').complete, true);
  for (const change of [{ cleanup: 'incomplete' }, { sourceChangedDuringRun: true }, { startupErrors: ['error'] }, { sourceFingerprint: 'old' }]) {
    assert.equal(assessMatrix(fullCases, [{ ...report, ...change }], 'hash').complete, false);
  }
  report.cases[0].status = 'blocked';
  assert.equal(assessMatrix(fullCases, [report], 'hash').complete, false);
  assert.equal(coverageFor(fullCases, [passed(fullCases[0].name)]).unrun.length, fullCases.length - 1);
});

test('credentials enforce separate real accounts and explicit blank player choice', () => {
  const gm = { username: 'GM', password: 'secret' };
  assert.throws(() => validateCredentials(gm, gm));
  assert.throws(() => validateCredentials(gm, { username: 'Player', password: '' }));
  assert.doesNotThrow(() => validateCredentials(gm, { username: 'Player', password: '', allowBlankPassword: true }));
});

for (const failAt of [null, 'cleanup', 'restore', 'verify']) test(`recovery retains journal on ${failAt ?? 'no failure'}`, async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'commanderer-live-'));
  const journal = path.join(dir, 'recovery.json');
  try {
    await writeJournal(journal, { runId });
    const calls = [];
    const steps = Object.fromEntries(['cleanup', 'restore', 'verify'].map(stage => [stage, async () => {
      calls.push(stage); if (stage === failAt) throw Error(stage);
    }]));
    const result = finishCleanup({ ...steps, journal });
    if (failAt) { await assert.rejects(result); assert.equal((await readJournal(journal)).runId, runId); }
    else { await result; assert.equal(await readJournal(journal), null); }
    assert.deepEqual(calls, ['cleanup', 'restore', 'verify']);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.join(path.resolve(tmpdir()), 'commanderer-live-')));
    await rm(dir, { recursive: true, force: true });
  }
});

test('world, role, run ID and fixture boundaries reject before mutations', () => {
  const previous = globalThis.game;
  try {
    globalThis.game = { world: { id: 'campaign' }, user: { isGM: false } };
    assert.throws(() => guard({ world: 'qa', runId }), /Wrong Foundry/);
    game.world.id = 'qa';
    assert.throws(() => guard({ world: 'qa', runId }, true), /GM required/);
    for (const id of [undefined, null, '', '*', 'other']) assert.throws(() => validateRunId(id));
    game.actors = new Map([['actor', { getFlag: () => null }]]);
    game.scenes = new Map();
    assert.throws(() => fixtureActor({ world: 'qa', runId, fixture: { commander: 'actor', scene: 'scene' } }), /outside test fixture/);
  } finally { globalThis.game = previous; }
});

test('cleanup isolates owned documents and retains references after message failure', async () => {
  const saved = Object.fromEntries(['game', 'ChatMessage', 'Combat', 'Scene', 'Actor'].map(k => [k, globalThis[k]]));
  const doc = (id, tag, speaker) => ({ id, speaker, getFlag: () => tag });
  const calls = [];
  let fail = true;
  try {
    globalThis.game = { world: { id: 'qa' }, user: { isGM: true },
      actors: [doc('qa-actor', runId), doc('real-actor', null)], scenes: [doc('qa-scene', runId)],
      combats: [], messages: [doc('qa-message', null, { actor: 'qa-actor' }), doc('real-message', null)] };
    for (const type of ['ChatMessage', 'Combat', 'Scene', 'Actor']) globalThis[type] = {
      deleteDocuments: async ids => { calls.push([type, ids]); if (type === 'ChatMessage' && fail) throw Error('locked'); },
    };
    await assert.rejects(cleanup({ world: 'qa', runId }), /locked/);
    assert.deepEqual(calls, [['ChatMessage', ['qa-message']]]);
    fail = false; calls.length = 0;
    await cleanup({ world: 'qa', runId });
    assert.deepEqual(calls, [['ChatMessage', ['qa-message']], ['Scene', ['qa-scene']], ['Actor', ['qa-actor']]]);
  } finally { Object.assign(globalThis, saved); }
});
