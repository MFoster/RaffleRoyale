import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sqlite3 from 'sqlite3';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerConfigService } from '../config/scheduler-config.service';
import type { Schedule, ScheduleState } from '../types/schedule.types';

interface RunResult {
  changes: number;
}

@Injectable()
export class ScheduleRepository implements OnModuleInit, OnModuleDestroy {
  private db: sqlite3.Database | null = null;

  constructor(@Inject(SchedulerConfigService) private readonly config: SchedulerConfigService) {}

  async onModuleInit(): Promise<void> {
    const path = this.config.dbPath;
    mkdirSync(dirname(path), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      this.db = new sqlite3.Database(path, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    await this.exec(schemaSql);
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.db) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      this.db?.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    this.db = null;
  }

  async create(schedule: Schedule): Promise<void> {
    await this.run(
      `INSERT INTO schedules (id, name, runAt, payload, targetQueueUrl, state, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.name,
        schedule.runAt,
        JSON.stringify(schedule.payload),
        schedule.targetQueueUrl,
        schedule.state,
        schedule.createdAt,
        schedule.updatedAt,
      ],
    );
  }

  async list(): Promise<Schedule[]> {
    const rows = await this.all<Record<string, unknown>>(
      'SELECT * FROM schedules ORDER BY createdAt DESC',
    );
    return rows.map((row) => this.toSchedule(row));
  }

  async findByName(name: string): Promise<Schedule | null> {
    const row = await this.get<Record<string, unknown>>('SELECT * FROM schedules WHERE name = ?', [name]);
    return row ? this.toSchedule(row) : null;
  }

  async findDue(nowIso: string): Promise<Schedule[]> {
    const rows = await this.all<Record<string, unknown>>(
      `SELECT * FROM schedules
       WHERE state = ? AND runAt <= ?
       ORDER BY runAt ASC`,
      ['scheduled', nowIso],
    );
    return rows.map((row) => this.toSchedule(row));
  }

  async updateState(name: string, state: ScheduleState): Promise<void> {
    await this.run('UPDATE schedules SET state = ?, updatedAt = ? WHERE name = ?', [
      state,
      new Date().toISOString(),
      name,
    ]);
  }

  async updateStateIfCurrent(name: string, expected: ScheduleState, next: ScheduleState): Promise<boolean> {
    const result = await this.run(
      'UPDATE schedules SET state = ?, updatedAt = ? WHERE name = ? AND state = ?',
      [next, new Date().toISOString(), name, expected],
    );
    return result.changes > 0;
  }

  private async exec(sql: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.requireDb().exec(sql, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async run(sql: string, params: unknown[] = []): Promise<RunResult> {
    return await new Promise<RunResult>((resolve, reject) => {
      this.requireDb().run(sql, params, function handleRun(error) {
        if (error) {
          reject(error);
          return;
        }
        resolve({ changes: this.changes ?? 0 });
      });
    });
  }

  private async get<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    return await new Promise<T | null>((resolve, reject) => {
      this.requireDb().get(sql, params, (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((row as T | undefined) ?? null);
      });
    });
  }

  private async all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await new Promise<T[]>((resolve, reject) => {
      this.requireDb().all(sql, params, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve((rows as T[] | undefined) ?? []);
      });
    });
  }

  private requireDb(): sqlite3.Database {
    if (!this.db) {
      throw new Error('SQLite client not initialized');
    }
    return this.db;
  }

  private toSchedule(row: Record<string, unknown>): Schedule {
    return {
      id: String(row.id),
      name: String(row.name),
      runAt: String(row.runAt),
      payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
      targetQueueUrl: String(row.targetQueueUrl),
      state: row.state as ScheduleState,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
}
