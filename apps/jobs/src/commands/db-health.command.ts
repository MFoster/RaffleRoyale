import type { JobCommand } from './types';

export const dbHealthCommand: JobCommand = {
  name: 'db:health',
  description: 'Verify the database is reachable via SELECT 1.',
  async run({ prisma }) {
    const rows = await prisma.$queryRaw<{ health: number }[]>`SELECT 1 AS health`;
    const health = rows[0]?.health;

    if (health !== 1) {
      throw new Error('Database health query did not return expected value.');
    }

    console.log('Database is healthy (SELECT 1 returned 1).');
  },
};
