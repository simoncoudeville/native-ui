import { features, browsers } from 'web-features';

/** How we label web-features' three Baseline states in the UI. */
export type BaselineLevel = 'widely' | 'newly' | 'limited';

/** Whether a browser supports all of a feature, some of it, or none. */
export type SupportState = 'full' | 'partial' | 'none';

export interface BrowserSupport {
  id: string;
  name: string;
  state: SupportState;
  /** Version the support landed in, or null when unsupported. */
  version: string | null;
  /** For partial support: how many of the feature's compat keys are covered. */
  covered?: { supported: number; total: number };
}

export interface FeatureInfo {
  id: string;
  name: string;
  description: string;
  level: BaselineLevel;
  lowDate?: string;
  highDate?: string;
  spec: string[];
  caniuse: string[];
  compatFeatures: string[];
  desktop: BrowserSupport[];
  mobile: BrowserSupport[];
}

const DESKTOP = ['chrome', 'edge', 'firefox', 'safari'] as const;
const MOBILE = ['chrome_android', 'firefox_android', 'safari_ios'] as const;

const LEVEL_RANK: Record<BaselineLevel, number> = {
  limited: 0,
  newly: 1,
  widely: 2,
};

export const LEVEL_LABEL: Record<BaselineLevel, string> = {
  widely: 'Widely available',
  newly: 'Newly available',
  limited: 'Limited availability',
};

function toArray(value: unknown): string[] {
  if (!value) return [];
  return Array.isArray(value) ? (value as string[]) : [value as string];
}

/** BCD versions look like "135", "26.2", "17.4", and occasionally "≤37". */
function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v.replace(/[^0-9.]/g, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Aggregates support for one browser.
 *
 * web-features only fills the top-level `status.support` map when *every* compat
 * key is supported. For features like `scroll-buttons`, where Chrome implements
 * 10 of 12 keys, that map is empty, and reading it alone would render the
 * flatly false claim that no browser supports the feature at all. So when the
 * aggregate is silent we fall back to `by_compat_key` and report partial support.
 */
function resolveSupport(
  browserId: string,
  status: any,
): Omit<BrowserSupport, 'id' | 'name'> {
  const aggregate = status.support?.[browserId];
  if (aggregate) return { state: 'full', version: aggregate };

  const byKey = status.by_compat_key ?? {};
  const keys = Object.keys(byKey);
  const versions: string[] = [];
  for (const key of keys) {
    const version = byKey[key]?.support?.[browserId];
    if (version) versions.push(version);
  }

  if (versions.length === 0) return { state: 'none', version: null };

  // The earliest version is when the feature first became usable at all.
  const earliest = versions.sort(compareVersions)[0];
  return {
    state: 'partial',
    version: earliest,
    covered: { supported: versions.length, total: keys.length },
  };
}

function supportList(ids: readonly string[], status: any): BrowserSupport[] {
  return ids.map((id) => ({
    id,
    name: (browsers as any)[id]?.name ?? id,
    ...resolveSupport(id, status),
  }));
}

/**
 * Reads a feature from web-features.
 *
 * Entries can be `moved` or `split` redirects rather than real features, and
 * those carry no `status`. Failing loudly at build time is deliberate: a silent
 * fallback would render a badge that quietly lies.
 */
export function getFeature(id: string): FeatureInfo {
  const entry = (features as any)[id];

  if (!entry) {
    throw new Error(
      `[baseline] Unknown web-features id "${id}". ` +
        `It may have been renamed or removed in a newer release of web-features.`,
    );
  }

  if (entry.kind && entry.kind !== 'feature') {
    const target = entry.redirect_target ?? entry.redirect_targets?.join(', ');
    throw new Error(
      `[baseline] web-features id "${id}" is a "${entry.kind}" entry, not a feature` +
        (target ? `. It now points at: ${target}.` : '.') +
        ` Update the webFeatures list in the relevant .mdx file.`,
    );
  }

  const status = entry.status ?? {};
  const baseline = status.baseline;
  const level: BaselineLevel =
    baseline === 'high' ? 'widely' : baseline === 'low' ? 'newly' : 'limited';

  return {
    id,
    name: entry.name ?? id,
    description: entry.description ?? '',
    level,
    lowDate: status.baseline_low_date,
    highDate: status.baseline_high_date,
    spec: toArray(entry.spec),
    caniuse: toArray(entry.caniuse),
    compatFeatures: entry.compat_features ?? [],
    desktop: supportList(DESKTOP, status),
    mobile: supportList(MOBILE, status),
  };
}

/**
 * The badge shown on a landing-page card must reflect the weakest feature on
 * the page: a carousel page whose scroll-snap is Widely available but whose
 * ::scroll-button is Chrome-only should read "Limited availability".
 */
export function worstLevel(ids: string[]): BaselineLevel {
  return ids
    .map((id) => getFeature(id).level)
    .reduce<BaselineLevel>(
      (worst, level) => (LEVEL_RANK[level] < LEVEL_RANK[worst] ? level : worst),
      'widely',
    );
}

/** Browsers with no support at all, the headline caveat on a limited feature. */
export function unsupportedIn(info: FeatureInfo): BrowserSupport[] {
  return [...info.desktop, ...info.mobile].filter((b) => b.state === 'none');
}

/** Browsers that implement only part of a feature. */
export function partiallySupportedIn(info: FeatureInfo): BrowserSupport[] {
  return [...info.desktop, ...info.mobile].filter((b) => b.state === 'partial');
}

export function formatDate(date?: string): string | undefined {
  if (!date) return undefined;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
