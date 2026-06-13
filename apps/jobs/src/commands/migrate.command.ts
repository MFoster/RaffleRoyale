import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { JobCommand } from './types';

export const migrateCommand: JobCommand = {
  name: 'migrate',
  description: 'Apply pending Prisma database migrations (prisma migrate deploy).',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(_ctx) {
    // compiled to apps/jobs/dist/commands/migrate.command.js
    // resolve up: commands → dist → jobs → apps → monorepo root
    const monoRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const schemaPath = path.join(monoRoot, 'packages', 'db', 'prisma', 'schema.prisma');
    const prismaBin = path.join(monoRoot, 'node_modules', '.bin', 'prisma');

    console.log('Applying pending database migrations...');
    execFileSync(prismaBin, ['migrate', 'deploy', '--schema', schemaPath], {
      stdio: 'inherit',
    });
    console.log('Migrations applied successfully.');
    return Promise.resolve();
  },
};
