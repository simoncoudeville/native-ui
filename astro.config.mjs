// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import baselineReport from './src/integrations/baseline-report.ts';
import { SHIKI_THEMES } from './src/lib/shiki.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://native-ui.pages.dev',
  output: 'static',
  // Astro v7 defaults this to 'jsx', which collapses the newline between a word
  // and a following inline <a> to nothing — silently welding prose together as
  // "from theweb-featuresBaseline dataset". `true` uses HTML whitespace rules,
  // which is what running text needs.
  compressHTML: true,
  server: {
    // Honour a PORT assigned by the environment; Astro otherwise picks its own
    // and silently drifts off whatever port the caller expects.
    port: Number(process.env.PORT) || 4321,
  },
  integrations: [mdx(), baselineReport()],
  markdown: {
    shikiConfig: {
      // Dual themes emit --shiki-light / --shiki-dark custom properties, which
      // the stylesheet resolves with light-dark(). That keeps code blocks on the
      // exact same theming mechanism as the rest of the site — no
      // prefers-color-scheme override, no !important.
      themes: SHIKI_THEMES,
      defaultColor: false,
      wrap: false,
    },
  },
});
