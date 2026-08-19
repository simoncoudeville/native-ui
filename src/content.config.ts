import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * One entry per documented element. Adding a fourth page is a new .mdx file
 * plus a folder under src/demos — no code changes anywhere else.
 */
const elements = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/elements' }),
  schema: z.object({
    title: z.string(),
    /** Monospace display name, e.g. "<dialog>" or "::scroll-button()". */
    elementName: z.string(),
    /** One line, used on the landing-page card. */
    description: z.string(),
    /**
     * web-features ids driving the support badges, primary first. The card
     * badge shows the weakest of these.
     */
    webFeatures: z.array(z.string()).nonempty(),
    order: z.number().default(0),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string().url(),
          kind: z.enum(['spec', 'mdn']),
        }),
      )
      .default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { elements };
