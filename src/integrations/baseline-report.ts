import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AstroIntegration } from 'astro';

const OUTPUT = '.baseline/report.json';

/**
 * Writes the build's computed Baseline statuses and any retired gotchas to
 * disk, so `baseline:check` can diff them against the committed snapshot.
 *
 * The build is the only place that already knows both halves — feature statuses
 * and which prose blocks stopped rendering — so emitting the report here avoids
 * a second, drift-prone pass that re-parses MDX frontmatter.
 */
export default function baselineReport(): AstroIntegration {
  return {
    name: 'native-ui:baseline-report',
    hooks: {
      'astro:build:done': async ({ logger }) => {
        const { getReport } = await import('../lib/report.ts');
        const report = getReport();

        await mkdir(dirname(OUTPUT), { recursive: true });
        await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

        const counts = [
          `${Object.keys(report.features).length} features`,
          `${report.retired.length} retired`,
          `${report.unguarded.length} unguarded`,
        ].join(', ');
        logger.info(`wrote ${OUTPUT} (${counts})`);

        for (const entry of report.unguarded) {
          logger.warn(
            `Gotcha without staleWhen in ${entry.page}: "${entry.summary}" — ` +
              `this claim can never be checked and will silently rot.`,
          );
        }
      },
    },
  };
}
