# Native UI

A documentation site cataloguing modern HTML and CSS interactive elements —
the features that used to require a JavaScript library and now ship in the
browser.

The site's own construction is the argument: no framework runtime, no CSS
framework, and no iframes. Every demo is plain HTML/CSS/vanilla JS rendered
inline, sharing the site's own stylesheet.

## Why no iframes

`<dialog>` and popovers are promoted to the browser's **top layer**, which sits
above the entire document. Boxing a demo in an iframe would silently break the
exact behaviour it exists to show — a full-screen dialog's `100dvh` would mean
the height of the iframe, not the viewport.

Demos are isolated from each other with `@scope` instead. Each demo's CSS is
authored wrapped in `@scope (.demo-<name>)`, so four demos can each style a bare
`dialog` selector without colliding.

## Demos are single-source

Each demo lives as plain files on disk:

```
src/demos/<page>/<demo>/
  markup.html    # rendered into the page AND shown in the snippet
  styles.css     # authored wrapped in @scope
  behavior.js    # optional — currently unused, which is the point
```

`Demo.astro` imports them with `?raw` and uses the same strings twice: once via
`set:html` to render the live demo, once fed to Shiki for the code block. The
snippet cannot drift from the demo because they are the same bytes.

## Stack

- **Astro 7** (static output), MDX content collections
- **Plain modern CSS** — `@layer`, nesting, container queries, `light-dark()`
- **Shiki** for highlighting, dual-themed through `light-dark()`
- **web-features / BCD / caniuse** for support data, read at build time

Light and dark follow the OS preference via `light-dark()`. There is no theme
toggle, no script, and no `prefers-color-scheme` media query anywhere — one
`color-scheme: light dark` declaration drives the whole site, including the
code blocks.

The only client-side JavaScript on the entire site is the code-block tab
switcher and copy button (~2.8 KB inline). Every demo works with JS disabled.

## Commands

```bash
npm install
npm run dev              # dev server
npm run build            # static build to dist/ + emits .baseline/report.json
npm run preview          # serve the build
npm run baseline:check   # diff computed support data against the snapshot
npm run baseline:update  # record current support data as the new snapshot
```

## How support data stays current

Support badges are **never hand-typed**. They are computed at build time from
the `web-features` Baseline dataset, so they cannot say something the data
doesn't.

Three data sources, each used only for what it is good at:

| Source | Provides | Used for |
|---|---|---|
| `web-features` | Baseline status | Support badges |
| `@mdn/browser-compat-data` | Per-browser notes, partial-implementation flags | Auto-generated gotchas |
| `caniuse-db` | Real-world usage share | One optional line |

caniuse covers only 3 of this site's 8 tracked features, so it is enrichment
only. Its `notes` are deliberately unused — most are historical (it still
describes `<dialog>` as needing a `chrome://flags` toggle). BCD notes attached
to `version_removed` entries are filtered out for the same reason: they
describe bugs that have since been fixed.

### The weekly job

`.github/workflows/baseline.yml` runs weekly: it refreshes the three data
packages, rebuilds, and diffs the result against
`src/data/baseline-snapshot.json`. If anything moved, it opens a pull request
whose body is written as a briefing — what changed on the web platform, in
plain language — rather than a diff to rubber-stamp.

If that PR sits untouched for `AUTO_MERGE_AFTER_DAYS` (default 7), a second
workflow merges it, so a busy fortnight can't quietly park the site on stale
data. Set the repository variable to `0` to require a manual merge always.
Both paths are gated on a green build.

### Gotchas that retire themselves

Support facts are generated. Prose about a browser quirk is written by hand,
but every claim that depends on a browser *lacking* support must declare why it
is currently true:

```mdx
<Gotcha staleWhen={{ feature: 'dialog-closedby', browser: 'safari', supported: true }}>
  Safari doesn't support `closedby` yet…
</Gotcha>
```

When Safari ships it, the block stops rendering and is listed in the PR body.
The failure mode is *losing a caveat*, never publishing one that has become
false. Timeless advice (accessibility, spec behaviour) is marked `evergreen`
instead; a block with neither is reported as unguarded at build time, because
nothing could ever detect it going stale.

## Deploying

Static output, no adapter required.

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |

Cloudflare Pages builds on push to `main`, so merging a data PR redeploys with
corrected badges.

## Adding an element page

1. Create `src/content/elements/<slug>.mdx` with `webFeatures` listing its
   web-features ids, **primary first** (the landing-page badge shows the
   primary; weaker features are disclosed beneath it).
2. Add demo folders under `src/demos/<slug>/`.
3. Run `npm run build` — an unknown or renamed feature id fails the build
   loudly rather than rendering a badge that quietly lies.
