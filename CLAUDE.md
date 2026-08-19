# CLAUDE.md

Native UI is a static Astro 7 site cataloguing modern HTML and CSS interactive
elements: the things that used to need a JavaScript library and now ship in the
browser. Read `README.md` for the project's own explanation of the build.

## Writing

**Never use em dashes (—) in prose.** Not in page copy, headings, MDX content,
commit messages, PR bodies, code comments, or replies in chat. Restructure the
sentence instead: use a full stop, a colon, brackets, or a comma. If two clauses
need separating, they usually want to be two sentences.

The same goes for en dashes (–) used as punctuation. A hyphen in a compound word
is fine, and so is an en dash in a genuine numeric range.

Other rules for anything a reader sees:

- British spelling: behaviour, colour, catalogue, normalise.
- No rationale from the conversation that produced the copy. The page explains
  the feature, not the decisions behind writing the page.
- No hedging or hype. Say what the feature does and what it costs. Skip
  "powerful", "simply", "just", "seamlessly", "delve".
- Short sentences over long ones. Cut a clause before adding punctuation to
  hold it.
- Never claim browser support in prose. Support facts are computed at build
  time. If a sentence depends on a browser lacking support, it belongs in a
  `<Gotcha>` with a `staleWhen` assertion.
- Wrap `.mdx` prose at roughly 80 columns, matching the existing files.

## Commands

```bash
npm run dev              # dev server on 4321, or $PORT
npm run build            # static build to dist/ plus .baseline/report.json
npm run baseline:check   # diff computed support data against the snapshot
npm run baseline:update  # record current support data as the new snapshot
```

Node 22.12 or newer, per `.nvmrc` and `engines`.

Prefer the preview tooling over running a server in a shell.

## Architecture

- `src/content/elements/*.mdx` is one file per documented element. The frontmatter
  schema lives in `src/content.config.ts` and is enforced by zod.
- `src/demos/<element>/<demo>/` holds `markup.html` and `styles.css` for each
  demo, imported into the MDX with `?raw`.
- `src/lib/` reads the support data: `baseline.ts` (web-features), `bcd.ts`,
  `caniuse.ts`, `gotchas.ts` (staleness assertions), `report.ts` (build report).
- `src/integrations/baseline-report.ts` writes `.baseline/report.json` at build.

Adding a new element page is a new `.mdx` file plus a folder under `src/demos`.
It should need no changes anywhere else. If it does, that is a bug in the
abstraction and worth saying so rather than special-casing the page.

## Support data

Support badges are never hand-typed. They are computed from `web-features`,
`@mdn/browser-compat-data`, and `caniuse-db` at build time, so they cannot say
something the data does not. Do not add a hardcoded version number, a "supported
in Chrome 120" line, or a hand-maintained compat table.

Every `<Gotcha>` resting on a browser *lacking* support must carry `staleWhen`,
so the block stops rendering once the premise expires. Timeless claims about
accessibility or spec behaviour take `evergreen` instead. A block with neither
is reported as unguarded at build time and will fail review.

## CSS

- One stylesheet, `src/styles/global.css`, in declared layers:
  `reset, tokens, base, layout, components, demo, utilities`. Put new rules in
  the right layer rather than raising specificity.
- Colours are `oklch()` wrapped in `light-dark()`. Greys are chroma 0, so they
  read as actual grey rather than the faintly blue cool grey a hue-tinted ramp
  gives you.
- There is exactly one `color-scheme: light dark` declaration driving the whole
  site. Do not add a `prefers-color-scheme` media query, a theme toggle, or a
  theming script. That includes code blocks, which resolve Shiki's dual-theme
  custom properties through `light-dark()`.
- Use the existing tokens for space, type steps, radius, and shadow. Add a token
  before adding a magic number.
- No `!important`, no CSS framework, no preprocessor.

## JavaScript

The only client-side JavaScript on the site is the code-block tab switcher and
copy button, about 2.8 KB inline. Every demo must work with JavaScript disabled.

If a demo appears to need script, that is the signal it does not belong here
yet. Say so rather than shipping the script.

## Demos

- `markup.html` and `styles.css` are the source of truth. The same string is
  both injected into the page and fed to Shiki, so the demo and its snippet
  cannot drift apart.
- Demo CSS is authored wrapped in `@scope`, which is what keeps one demo's
  styles off another without an iframe. Keep that wrapper.
- The `name` prop is unique per page and doubles as the class the demo's CSS
  targets.

## Working here

- Run `npm run build` after content or data changes. It is the only thing that
  surfaces unguarded gotchas and support drift.
- `npm run baseline:update` is a deliberate act, not cleanup. It records new
  support data as the accepted snapshot, so run it only when the change is
  understood.
- The weekly workflow in `.github/workflows/baseline.yml` opens the data-refresh
  PR. Do not hand-edit `src/data/baseline-snapshot.json`.
