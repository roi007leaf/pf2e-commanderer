import { TACTICS } from '../../scripts/domain/tactics.js';
import { ACTIVE_FEATS } from '../../scripts/domain/feat-rules.js';
import { casePassed } from './coverage.mjs';

export const passiveFeats = [
  'battle-hardened-companion', 'battle-tested-companion', 'claim-the-field',
  'contact-with-the-enemy', 'drilled-reflexes', 'efficient-preparation', 'fortunate-blow',
  'glorious-banner', 'observational-analysis', 'officers-education', 'officers-medical-training',
  'peerless-mascot-companion', 'perfected-evaluations', 'plant-banner', 'practiced-reflexes',
  'tactical-expansion', 'targeting-strike', 'unrivaled-analysis',
];
export const featSlugs = [...ACTIVE_FEATS, ...passiveFeats].sort();
export const tacticSlugs = Object.keys(TACTICS).sort();

// Explicit feature -> evidence mapping. Existing regressions remain required too.
const existingTactics = {
  'mountaineering-training': 'tactic-effect-response', 'naval-training': 'tactic-naval-training',
  'gather-to-me': 'movement-gather-commit', 'strike-hard': 'tactic-strike-drilled',
  'stupefying-raid': 'tactic-resolution-save',
};
const existingFeats = {
  'adaptive-stratagem': 'feat-adaptive-stratagem', 'banner-twirl': 'feat-twirl-cancel-use',
  'rallying-banner': 'feat-rallying-roll-cooldown', 'confusing-commands': 'feat-confusing-commands-save',
  'defensive-swap': 'feat-defensive-swap', 'reactive-interference': 'feat-reactive-interference',
  'commanders-companion': 'feat-companion-setup', 'shield-warden': 'feat-shield-warden',
  'shielded-recovery': 'feat-shielded-recovery', 'plant-banner': 'player-plant-retrieve',
};
export const featureMatrix = [
  ...tacticSlugs.map(slug => ({ type: 'tactic', slug, scenario: existingTactics[slug] ?? `catalog-tactic-${slug}` })),
  ...featSlugs.map(slug => ({ type: 'feat', slug, scenario: existingFeats[slug] ?? `catalog-feat-${slug}` })),
];
export const featureCases = featureMatrix.filter(f => f.scenario.startsWith('catalog-')).map(f => ({
  name: f.scenario, description: `Live ${f.type}: ${f.slug}`, extended: true, feature: f,
}));

export function assertFeatureCatalog(cases) {
  const names = new Set(cases.map(c => c.name));
  const missing = featureMatrix.filter(f => !names.has(f.scenario));
  if (missing.length) throw Error(`Missing live feature scenarios: ${missing.map(f => f.slug).join(', ')}`);
  return { feats: featSlugs.length, tactics: tacticSlugs.length };
}

export function featureCoverage(results) {
  const byName = new Map(results.map(r => [r.name, r]));
  return featureMatrix.map(feature => ({ ...feature,
    status: casePassed(byName.get(feature.scenario)) ? 'pass' : byName.get(feature.scenario)?.status === 'pass' ? 'failed' : byName.get(feature.scenario)?.status ?? 'unrun' }));
}
