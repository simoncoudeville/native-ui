import { getFeature } from './baseline.ts';

export interface FeatureSnapshot {
  level: string;
  lowDate?: string;
  highDate?: string;
  support: Record<string, { state: string; version: string | null }>;
}

export interface BuildReport {
  generatedAt: string;
  features: Record<string, FeatureSnapshot>;
  retired: { page: string; summary: string; reason: string }[];
  unguarded: { page: string; summary: string }[];
}

/**
 * Astro integrations and rendered page modules run in separate module
 * registries, so a plain module-level array would come back empty when the
 * integration reads it. globalThis is the one store both halves share.
 */
const KEY = Symbol.for('native-ui.build-report');

function store(): BuildReport {
  const g = globalThis as any;
  g[KEY] ??= {
    generatedAt: new Date().toISOString(),
    features: {},
    retired: [],
    unguarded: [],
  } satisfies BuildReport;
  return g[KEY];
}

/** Snapshots a feature's computed status as pages render. */
export function recordFeature(id: string): void {
  const report = store();
  if (report.features[id]) return;

  const info = getFeature(id);
  const support: FeatureSnapshot['support'] = {};
  for (const browser of [...info.desktop, ...info.mobile]) {
    support[browser.id] = { state: browser.state, version: browser.version };
  }

  report.features[id] = {
    level: info.level,
    lowDate: info.lowDate,
    highDate: info.highDate,
    support,
  };
}

export function recordRetired(entry: { page: string; summary: string; reason: string }): void {
  store().retired.push(entry);
}

export function recordUnguarded(entry: { page: string; summary: string }): void {
  store().unguarded.push(entry);
}

export function getReport(): BuildReport {
  const report = store();
  return {
    ...report,
    features: Object.fromEntries(Object.entries(report.features).sort(([a], [b]) => a.localeCompare(b))),
    retired: [...report.retired].sort((a, b) => a.summary.localeCompare(b.summary)),
    unguarded: [...report.unguarded],
  };
}
