import { dbHealthCommand } from './db-health.command';
import { dbStatsCommand } from './db-stats.command';
import { migrateCommand } from './migrate.command';
import { seedCommand } from './seed.command';
import { sweepCommand } from './sweep.command';
import type { JobCommand } from './types';

export const commands: JobCommand[] = [
	migrateCommand,
	dbHealthCommand,
	dbStatsCommand,
	seedCommand,
	sweepCommand,
];

export const commandMap = new Map(commands.map((command) => [command.name, command]));
