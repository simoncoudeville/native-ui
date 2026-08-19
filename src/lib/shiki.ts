/**
 * Shared by astro.config.mjs (for fenced code blocks in MDX) and the <Code />
 * component in Demo.astro. The <Code /> component does not inherit
 * markdown.shikiConfig. It silently falls back to its own github-dark default,
 * so both call sites have to be given the same themes explicitly.
 */
export const SHIKI_THEMES = {
  light: 'min-light',
  dark: 'min-dark',
} as const;
