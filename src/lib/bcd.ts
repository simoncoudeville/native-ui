import { createRequire } from 'node:module';

// BCD's package entry resolves straight to a 19MB data.json, which ESM can only
// load with an import attribute and which Vite would otherwise try to inline
// into the bundle. createRequire keeps it a plain build-time Node read.
const require = createRequire(import.meta.url);
const bcd = require('@mdn/browser-compat-data');

import { browsers } from 'web-features';

export interface DerivedNote {
  /** Browser ids the note applies to. */
  browsers: string[];
  /** Human-readable browser names, for display. */
  browserNames: string[];
  /** Sanitised HTML — BCD notes contain <code> and <a> markup. */
  html: string;
  kind: 'note' | 'partial' | 'flag';
}

const TRACKED = [
  'chrome',
  'edge',
  'firefox',
  'safari',
  'chrome_android',
  'firefox_android',
  'safari_ios',
];

/**
 * BCD note text is CC0 data from MDN rather than user input, but it still goes
 * through `set:html`, so keep it to a known-good subset of inline markup.
 */
export function sanitiseNote(html: string): string {
  return html
    .replace(/<(?!\/?(?:code|a|strong|em)\b)[^>]*>/gi, '')
    .replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
      const href = /href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '';
      if (!/^https?:\/\//i.test(href)) return '<a>';
      const safe = href.replace(/"/g, '&quot;');
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">`;
    });
}

function lookup(path: string): any {
  let node: any = bcd;
  for (const segment of path.split('.')) {
    if (!node || typeof node !== 'object' || !(segment in node)) return null;
    node = node[segment];
  }
  return node?.__compat ?? null;
}

function browserName(id: string): string {
  return (browsers as any)[id]?.name ?? id;
}

/**
 * Collects per-browser caveats for a feature straight from MDN's compat data.
 *
 * Raw output is unusable for wide features — `anchor-positioning` spans 325
 * compat keys carrying 443 notes, most of them the same sentence repeated
 * across every key and every browser. So notes are deduplicated by text, with
 * the browsers they apply to merged into one entry.
 */
export function getDerivedNotes(
  compatFeatures: string[],
  options: { limit?: number } = {},
): { notes: DerivedNote[]; truncated: number } {
  const byText = new Map<string, DerivedNote>();

  const add = (text: string, browserId: string, kind: DerivedNote['kind']) => {
    const html = sanitiseNote(text).trim();
    if (!html) return;
    const key = `${kind}::${html}`;
    const existing = byText.get(key);
    if (existing) {
      if (!existing.browsers.includes(browserId)) {
        existing.browsers.push(browserId);
        existing.browserNames.push(browserName(browserId));
      }
      return;
    }
    byText.set(key, {
      browsers: [browserId],
      browserNames: [browserName(browserId)],
      html,
      kind,
    });
  };

  for (const path of compatFeatures) {
    const compat = lookup(path);
    if (!compat?.support) continue;

    for (const browserId of TRACKED) {
      const raw = compat.support[browserId];
      if (!raw) continue;
      const entries = Array.isArray(raw) ? raw : [raw];

      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        // Historical entries describe versions that have since been superseded.
        if (entry.version_removed) continue;

        for (const note of [entry.notes ?? []].flat()) {
          if (typeof note === 'string') add(note, browserId, 'note');
        }
        if (entry.partial_implementation && !entry.notes) {
          add('Partial implementation.', browserId, 'partial');
        }
        if (Array.isArray(entry.flags) && entry.flags.length > 0) {
          const names = entry.flags.map((f: any) => f.name).filter(Boolean).join(', ');
          add(
            `Requires enabling a flag${names ? `: <code>${names}</code>` : ''}.`,
            browserId,
            'flag',
          );
        }
      }
    }
  }

  const all = [...byText.values()].sort(
    (a, b) => b.browsers.length - a.browsers.length || a.html.localeCompare(b.html),
  );
  const limit = options.limit ?? 8;
  return { notes: all.slice(0, limit), truncated: Math.max(0, all.length - limit) };
}
