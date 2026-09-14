// Explicitly imported from a GM browser for disposable-world integration testing.
// Never loaded by the module. Native documents/rolls are retained; dialog answers
// and dice are controlled to exercise branches reproducibly.
export async function resumeAudit() {
  const scope = 'pf2e-commanderer';
  const actors = JSON.parse(sessionStorage.getItem('fullQAActors')).map(id => game.actors.get(id));
  const scene = game.scenes.get(sessionStorage.getItem('fullQAScene'));
  await scene.view();
  const tokens = actors.map(a => scene.tokens.find(t => t.actorId === a.id));
  const q = { actors, tokens, scene, scope, results: JSON.parse(sessionStorage.getItem('fullQAResults')), prompts: [], item: slug => actors[0].items.find(i => i.slug === slug) };
  const qa = q; // eslint-disable-line no-unused-vars -- restored functions close over this name
  for (const [key, code] of Object.entries(JSON.parse(sessionStorage.getItem('fullQAFns')))) q[key] = eval(`(${code})`);
  const runCase = q.case;
  q.case = async (...args) => { const result = await runCase(...args); sessionStorage.setItem('fullQAResults', JSON.stringify(q.results)); return result; };
  const check = game.pf2e.Check;
  q.originalCheckRoll = check.roll;
  check.roll = function(statistic, context, ...rest) { return q.originalCheckRoll.call(this, statistic, { ...context, skipDialog: true }, ...rest); };
  globalThis.commanderAudit = q;
  return { ready: true, cases: q.results.length, actors: actors.map(a => a.name) };
}

export async function setupAudit() {
  const scope = 'pf2e-commanderer';
  const source = (await fromUuid('Compendium.pf2e.iconics.Actor.gPQFd6gJEMxtgi8x')).toObject();
  delete source._id;
  const actors = [];
  for (const [name, alliance] of [['Commander Audit', 'party'], ['Ally Audit', 'party'], ['Second Ally Audit', 'party'], ['Enemy Audit', 'opposition']]) {
    const data = foundry.utils.deepClone(source);
    data.name = name; data.flags = { [scope]: { fullAudit: true } };
    data.system.details.alliance = alliance;
    actors.push(await Actor.create(data));
  }
  const scene = await globalThis.Scene.create({ name: 'Commander Full Audit', width: 2000, height: 1600, padding: 0, grid: { type: 1, size: 100, distance: 5 }, flags: { [scope]: { fullAudit: true } } });
  await scene.view();
  const tokens = [];
  for (let i = 0; i < actors.length; i++) {
    const token = await actors[i].getTokenDocument({ name: actors[i].name, x: 500 + i % 2 * 100, y: 500 + Math.floor(i / 2) * 100, actorLink: true });
    tokens.push((await scene.createEmbeddedDocuments('Token', [token.toObject()]))[0]);
  }
  const feats = await import('../scripts/domain/feat-rules.js');
  const { TACTICS } = await import('../scripts/domain/tactics.js');
  const slugs = new Set([...feats.ACTIVE_FEATS, ...Object.keys(TACTICS), 'contact-with-the-enemy', 'observational-analysis', 'targeting-strike', 'fortunate-blow', 'unrivaled-analysis', 'perfected-evaluations', 'glorious-banner', 'drilled-reflexes', 'practiced-reflexes', 'battle-hardened-companion', 'battle-tested-companion', 'peerless-mascot-companion', 'efficient-preparation', 'tactical-expansion', 'officers-education', 'officers-medical-training', 'plant-banner', 'claim-the-field']);
  const pack = game.packs.get('pf2e.feats-srd');
  const index = await pack.getIndex({ fields: ['system.slug'] });
  const actionPack = game.packs.get('pf2e.actionspf2e');
  const actionIndex = await actionPack.getIndex({ fields: ['system.slug', 'system.traits.value'] });
  const missing = [];
  for (const slug of slugs) {
    if (actors[0].items.some(i => i.slug === slug)) continue;
    const tactic = Object.hasOwn(TACTICS, slug);
    const row = tactic ? actionIndex.find(i => i.system.slug === slug && i.system.traits.value.includes('tactic'))
      : index.find(i => i.system.slug === slug);
    if (!row) { missing.push(slug); continue; }
    const data = (await (tactic ? actionPack : pack).getDocument(row._id)).toObject(); delete data._id;
    // GrantItem prompts belong to character building, not workflow execution.
    // Also remove rules depending on those deliberately omitted choices.
    data.system.rules = data.system.rules.filter(r => !['ChoiceSet', 'GrantItem'].includes(r.key)
      && !JSON.stringify(r).includes('{item|flags.system.rulesSelections.'));
    await actors[0].createEmbeddedDocuments('Item', [data]);
  }
  const tactics = actors[0].items.filter(i => i.system.traits?.value?.includes('tactic'));
  await actors[0].setFlag(scope, 'preparedTactics', tactics.map(i => i.id));
  await actors[0].setFlag(scope, 'squad', [1, 2].map(i => ({ actorUuid: actors[i].uuid, tokenUuid: tokens[i].uuid, name: actors[i].name, img: actors[i].img })));
  const qa = { actors, tokens, scene, results: [], prompts: [], scope, missing, tactics: Object.keys(TACTICS) };
  qa.item = slug => actors[0].items.find(i => i.slug === slug);
  qa.assert = (value, message) => { if (!value) throw new Error(message); };
  qa.case = async (name, fn) => {
    qa.prompts = [];
    try { const detail = await fn(); qa.results.push({ name, status: 'pass', detail, prompts: [...qa.prompts] }); }
    catch (e) { qa.results.push({ name, status: 'fail', error: e.stack, prompts: [...qa.prompts] }); }
    return qa.results.at(-1);
  };
  qa.withAnswers = async (fn, answer = () => undefined, die = 0.99) => {
    const D = foundry.applications.api.DialogV2;
    const dice = (new Roll('1d20')).terms[0].constructor.prototype;
    const old = { wait: D.wait, confirm: D.confirm, roll: dice.roll };
    D.confirm = async options => { const text = options.content; qa.prompts.push(text); return answer(text, 'confirm') ?? true; };
    D.wait = async options => {
      const doc = new DOMParser().parseFromString(options.content, 'text/html');
      const text = doc.body.textContent;
      qa.prompts.push(text);
      const response = answer(text, 'input', doc);
      if (response === null) return null;
      const field = doc.querySelector('select,input');
      if (field?.name === 'selection') return { value: String(response ?? field.value) };
      if (field?.name === 'amount') return { value: Number(response ?? field.value) };
      if (field?.name === 'choice') return String(response ?? field.value);
      return old.wait.call(D, options);
    };
    dice.roll = function(options = {}) { return old.roll.call(this, { ...options, maximize: die > 0.5, minimize: die <= 0.5 }); };
    const pump = setInterval(() => {
      document.querySelector('button.select-button')?.click();
      for (const button of document.querySelectorAll('button,input[type="submit"]')) {
        if (/^Roll\s*\(/.test((button.value || button.textContent).trim().replace(/\s+/g, ' ')) && button.getClientRects().length) button.click();
      }
    }, 100);
    try { return await fn(); } finally { clearInterval(pump); D.wait = old.wait; D.confirm = old.confirm; dice.roll = old.roll; }
  };
  qa.clean = async () => {
    for (const a of actors) {
      const ids = a.items.filter(i => ['effect', 'condition'].includes(i.type) && !i.getFlag(scope, 'passive')).map(i => i.id);
      if (ids.length) await a.deleteEmbeddedDocuments('Item', ids);
      await a.update({ 'system.attributes.hp.value': a.system.attributes.hp.max, 'system.attributes.hp.temp': 0 });
      for (const flag of ['featCooldowns', 'featImmunities', 'opening', 'featFlourishTurn', 'resuscitation-immunity', 'cry-havoc-immunity']) if (a.getFlag(scope, flag) !== undefined) await a.unsetFlag(scope, flag);
    }
  };
  globalThis.commanderAudit = qa;
  sessionStorage.setItem('fullQAActors', JSON.stringify(actors.map(a=>a.id)));
  sessionStorage.setItem('fullQAScene', scene.id);
  sessionStorage.setItem('fullQAResults', JSON.stringify(qa.results));
  sessionStorage.setItem('fullQAFns', JSON.stringify(Object.fromEntries(['assert', 'case', 'withAnswers', 'clean'].map(key => [key, qa[key].toString()]))));
  return { actors: actors.map(a=>a.id), scene: scene.id, missing, knownTactics: tactics.map(i=>i.slug) };
}
