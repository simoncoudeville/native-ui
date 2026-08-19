import { createRequire } from 'node:module';
import { getFeature } from './baseline.ts';

const require = createRequire(import.meta.url);

/**
 * Real-world usage share for a feature, or null when caniuse doesn't track it.
 *
 * Only ~28% of web-features entries carry a caniuse id, and the newest features
 * (the ones this site exists to document) are mostly among those that don't.
 * So this is strictly an enrichment: callers omit the line when it returns null
 * rather than showing an empty slot.
 *
 * The caniuse id is read off the web-features entry itself, so there is no
 * hand-maintained mapping table to fall out of date.
 */
export function getUsageShare(featureId: string): number | null {
  const ids = getFeature(featureId).caniuse;
  if (ids.length === 0) return null;

  for (const id of ids) {
    try {
      const data = require(`caniuse-db/features-json/${id}.json`);
      if (typeof data?.usage_perc_y === 'number') return data.usage_perc_y;
    } catch {
      // caniuse dropped or renamed the feature file; treat as untracked.
    }
  }
  return null;
}
