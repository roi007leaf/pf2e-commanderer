import { readFile } from 'node:fs/promises';
import { sourceFingerprint, assessMatrix } from './evidence.mjs';
import { fullCases } from './cases.mjs';

const files = process.argv.slice(2);
if (!files.length) throw Error('Provide one or more live report.json paths');
const reports = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))));
const result = assessMatrix(fullCases, reports, await sourceFingerprint());
console.log(JSON.stringify(result, null, 2));
if (!result.complete) process.exitCode = 1;
