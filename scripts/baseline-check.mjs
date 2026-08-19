#!/usr/bin/env node
/**
 * Diffs the statuses computed by the last build against the committed
 * snapshot, and writes a human-readable briefing for the PR body.
 *
 * Exits non-zero when anything moved, which is what makes the weekly workflow
 * open a pull request.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const REPORT = '.baseline/report.json';
const SNAPSHOT = 'src/data/baseline-snapshot.json';
const SUMMARY = '.baseline/summary.md';

const LEVEL_LABEL = {
  widely: 'Widely available',
  newly: 'Newly available',
  limited: 'Limited availability',
};

async function readJson(path, hint) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Missing ${path}.${hint ? ` ${hint}` : ''}`);
      process.exit(2);
    }
    throw error;
  }
}

const report = await readJson(REPORT, 'Run `npm run build` first — it emits the report.');
const snapshot = await readJson(
  SNAPSHOT,
  'Run `npm run baseline:update` once to record the current state.',
);

const changes = [];
const featureIds = [
  ...new Set([...Object.keys(report.features), ...Object.keys(snapshot.features ?? {})]),
].sort();

for (const id of featureIds) {
  const now = report.features[id];
  const before = snapshot.features?.[id];

  if (!before) {
    changes.push({ id, kind: 'added', detail: `now tracked (${LEVEL_LABEL[now.level]})` });
    continue;
  }
  if (!now) {
    changes.push({ id, kind: 'removed', detail: 'no longer used by any page' });
    continue;
  }

  if (now.level !== before.level) {
    changes.push({
      id,
      kind: 'level',
      detail: `${LEVEL_LABEL[before.level]} → **${LEVEL_LABEL[now.level]}**`,
      browsers: [],
    });
  }

  const browserChanges = [];
  for (const browser of new Set([...Object.keys(now.support), ...Object.keys(before.support)])) {
    const a = before.support[browser];
    const b = now.support[browser];
    if (!a || !b) continue;
    if (a.state !== b.state || a.version !== b.version) {
      const describe = (s) =>
        s.state === 'none' ? 'no support' : `${s.version}${s.state === 'partial' ? ' (partial)' : ''}`;
      browserChanges.push(`${browser}: ${describe(a)} → **${describe(b)}**`);
    }
  }

  if (browserChanges.length > 0) {
    const existing = changes.find((c) => c.id === id && c.kind === 'level');
    if (existing) existing.browsers = browserChanges;
    else changes.push({ id, kind: 'support', detail: 'browser support changed', browsers: browserChanges });
  }
}

const lines = [];

if (changes.length === 0) {
  lines.push('No Baseline changes since the last snapshot.');
} else {
  lines.push('## What changed on the platform', '');
  for (const change of changes) {
    lines.push(`### \`${change.id}\``);
    lines.push('');
    lines.push(change.detail);
    if (change.browsers?.length) {
      lines.push('');
      for (const browser of change.browsers) lines.push(`- ${browser}`);
    }
    lines.push('');
  }
}

if (report.retired.length > 0) {
  lines.push(`## Auto-retired prose (${report.retired.length})`, '');
  lines.push('These blocks stopped rendering because their premise expired.');
  lines.push('The text is still in the source — ask Claude to rewrite it if a page now reads thin.', '');
  for (const entry of report.retired) {
    lines.push(`- **${entry.summary}** — ${entry.reason} (${entry.page})`);
  }
  lines.push('');
}

if (report.unguarded.length > 0) {
  lines.push(`## Unguarded claims (${report.unguarded.length})`, '');
  lines.push('These have no `staleWhen`, so nothing can ever detect them going stale:', '');
  for (const entry of report.unguarded) {
    lines.push(`- ${entry.summary} (${entry.page})`);
  }
  lines.push('');
}

lines.push(
  `<sub>${Object.keys(report.features).length} features tracked · ` +
    `${report.retired.length} retired · generated ${report.generatedAt}</sub>`,
);

const summary = lines.join('\n');
await mkdir('.baseline', { recursive: true });
await writeFile(SUMMARY, `${summary}\n`, 'utf8');
console.log(summary);

if (changes.length > 0) {
  console.error(`\n${changes.length} change(s) detected — snapshot is out of date.`);
  process.exit(1);
}
