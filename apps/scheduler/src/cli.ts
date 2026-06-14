import 'dotenv/config';
import 'reflect-metadata';
import { CommandFactory } from 'nest-commander';
import { CliModule } from './runtime/cli.module';

void CommandFactory.run(CliModule, ['error', 'warn', 'log']);
