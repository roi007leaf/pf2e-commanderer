import { readFile } from 'node:fs/promises';
import { featureCoverage } from './feature-catalog.mjs';
import { sourceFingerprint } from './evidence.mjs';
const report = JSON.parse(await readFile(process.argv[2] ?? 'artifacts/live/report.json', 'utf8'));
if (report.sourceFingerprint !== await sourceFingerprint() || report.sourceChangedDuringRun || report.cleanup !== 'complete' || report.error || report.startupErrors?.length) throw Error('Feature evidence is stale, incomplete or contains startup errors; rerun the live suite.');
const features = featureCoverage(report.cases);
for (const type of ['feat', 'tactic']) {
  const rows = features.filter(f => f.type === type);
  console.log(`${type}: ${rows.filter(f => f.status === 'pass').length}/${rows.length} pass`);
  for (const row of rows) console.log(`  ${row.status.padEnd(8)} ${row.slug} (${row.scenario})`);
}
if (features.some(f => f.status !== 'pass') || report.cleanup !== 'complete' || report.sourceChangedDuringRun) process.exitCode = 1;
