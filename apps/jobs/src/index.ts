import process from 'node:process';
import { commandMap, commands } from './commands';
import { loadEnv } from './config/load-env';
import { createPrismaClient } from './prisma/client';

function printHelp(): void {
  console.log('Raffle Royale Jobs Runner');
  console.log('');
  console.log('Usage:');
  console.log('  npm run dev -w jobs -- <command> [args]');
  console.log('  npm run start -w jobs -- <command> [args]');
  console.log('');
  console.log('Available commands:');

  for (const command of commands) {
    console.log(`  ${command.name.padEnd(14)} ${command.description}`);
  }
}

async function main(): Promise<void> {
  loadEnv();

  const sqsQueueUrl = process.env.JOBS_SQS_QUEUE_URL;

  if (sqsQueueUrl) {
    console.log(`Worker mode: polling SQS queue ${sqsQueueUrl}`);
    const workerModule = (await import('./sqs/worker.js')) as typeof import('./sqs/worker.js');
    await workerModule.startWorker(sqsQueueUrl);
    return;
  }

  const [commandName, ...args] = process.argv.slice(2);

  if (!commandName || commandName === '--help' || commandName === '-h' || commandName === 'help') {
    printHelp();
    return;
  }

  const command = commandMap.get(commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error('');
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`${command.name}: ${command.description}`);
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Configure apps/jobs/.env or apps/api/.env before running DB commands.',
    );
  }

  const prisma = createPrismaClient();

  try {
    await command.run({ args, prisma });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown command runner error.');
  }

  process.exit(1);
});
