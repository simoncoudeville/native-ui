#!/usr/bin/env node
/** Promotes the last build's report to the committed snapshot. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const REPORT = '.baseline/report.json';
const SNAPSHOT = 'src/data/baseline-snapshot.json';

let report;
try {
  report = JSON.parse(await readFile(REPORT, 'utf8'));
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Missing ${REPORT}. Run \`npm run build\` first.`);
    process.exit(2);
  }
  throw error;
}

// Only the feature statuses are durable state. Retired and unguarded lists
// describe a single build, so committing them would create noise on every run.
const snapshot = {
  updatedAt: new Date().toISOString(),
  features: report.features,
};

await mkdir(dirname(SNAPSHOT), { recursive: true });
await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Updated ${SNAPSHOT} with ${Object.keys(snapshot.features).length} features.`);
