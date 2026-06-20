import { copyFile, mkdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import {
  ItemType as ItemTypeEnum,
  KycStatus,
  PayoutStatus as PayoutStatusEnum,
  Prisma,
  type PrismaClient,
  RaffleEventType as RaffleEventTypeEnum,
  RaffleStatus as RaffleStatusEnum,
  TransactionStatus as TransactionStatusEnum,
} from '@prisma/client';
import { hash as hashPassword } from 'bcryptjs';
import { load as loadYaml } from 'js-yaml';
import type { JobCommand } from './types';

const DEFAULT_FIXTURE_FILE = path.resolve(process.cwd(), 'fixtures/seed.yaml');
const RAFFLE_ITEMS_DIR = path.resolve(process.cwd(), 'fixtures/raffle-items');
const BCRYPT_ROUNDS = 10;
const RAFFLE_UPLOAD_URL_PATTERN = /^\/api\/uploads\/raffles\/([\w.-]+)$/;

async function ensureSeedRaffleImages(
  raffles: Prisma.RaffleCreateManyInput[],
): Promise<number> {
  const uploadsRoot =
    process.env.UPLOADS_DIRECTORY ?? path.resolve(process.cwd(), 'uploads');
  const uploadsDirectory = path.join(uploadsRoot, 'raffles');
  await mkdir(uploadsDirectory, { recursive: true });

  let copiedCount = 0;
  const copies: Array<Promise<void>> = [];

  for (const [raffleIndex, raffle] of raffles.entries()) {
    const imageUrls = Array.isArray(raffle.imageUrls)
      ? raffle.imageUrls
      : [];

    if (imageUrls.length === 0) {
      continue;
    }

    for (const [imageIndex, imageUrl] of imageUrls.entries()) {
      const match = RAFFLE_UPLOAD_URL_PATTERN.exec(imageUrl);

      if (!match) {
        throw new Error(
          `raffles[${String(raffleIndex)}].imageUrls[${String(imageIndex)}] must use /api/uploads/raffles/<file-name> path.`,
        );
      }

      const fileName = match[1];

      if (!fileName) {
        throw new Error(
          `raffles[${String(raffleIndex)}].imageUrls[${String(imageIndex)}] contains an invalid upload file name.`,
        );
      }

      if (!fileName.toLowerCase().endsWith('.jpg')) {
        throw new Error(
          `raffles[${String(raffleIndex)}].imageUrls[${String(imageIndex)}] must reference a .jpg file in raffle-items/`,
        );
      }

      const sourceFile = path.join(RAFFLE_ITEMS_DIR, fileName);
      const destFile = path.join(uploadsDirectory, fileName);
      try {
        await access(sourceFile);
        copies.push(copyFile(sourceFile, destFile));
        copiedCount += 1;
      } catch {
        console.log("⚠️  Source image file does not exist, skipping copy:", sourceFile);
      }
    }
  }

  await Promise.all(copies);
  return copiedCount;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value;
}

function asRecordArray(
  source: Record<string, unknown>,
  key: string,
  context: string,
): Record<string, unknown>[] {
  const value = source[key];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context}.${key} must be an array.`);
  }

  return value.map((item, index) =>
    asRecord(item, `${context}.${key}[${String(index)}]`),
  );
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
  context: string,
): string {
  const value = source[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string.`);
  }

  return value;
}

function readOptionalNullableString(
  source: Record<string, unknown>,
  key: string,
  context: string,
): string | null | undefined {
  const value = source[key];

  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`${context}.${key} must be a string, null, or omitted.`);
  }

  return value;
}

function readOptionalStringArray(
  source: Record<string, unknown>,
  key: string,
  context: string,
): string[] | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`${context}.${key} must be an array of strings or omitted.`);
  }

  if (!value.every((item) => typeof item === 'string')) {
    throw new Error(`${context}.${key} must contain only strings.`);
  }

  return value;
}

function readRequiredInt(
  source: Record<string, unknown>,
  key: string,
  context: string,
): number {
  const value = source[key];

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${context}.${key} must be an integer.`);
  }

  return value;
}

function readOptionalNullableInt(
  source: Record<string, unknown>,
  key: string,
  context: string,
): number | null | undefined {
  const value = source[key];

  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${context}.${key} must be an integer, null, or omitted.`);
  }

  return value;
}

function readOptionalDate(
  source: Record<string, unknown>,
  key: string,
  context: string,
): Date | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${context}.${key} must be an ISO date string or omitted.`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${context}.${key} must be a valid ISO date string.`);
  }

  return parsed;
}

function parseEnumValue<T extends Record<string, string>>(
  value: unknown,
  enumType: T,
  context: string,
): T[keyof T] {
  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string enum value.`);
  }

  const validValues = Object.values(enumType);

  if (!validValues.includes(value)) {
    throw new Error(
      `${context} must be one of: ${validValues.join(', ')}.`,
    );
  }

  return value as T[keyof T];
}

function parseOptionalEnumValue<T extends Record<string, string>>(
  source: Record<string, unknown>,
  key: string,
  enumType: T,
  fallback: T[keyof T],
  context: string,
): T[keyof T] {
  const value = source[key];

  if (value === undefined) {
    return fallback;
  }

  return parseEnumValue(value, enumType, `${context}.${key}`);
}

function isJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;

  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.values(value).every((entry) => isJsonValue(entry));
  }

  return false;
}

function readOptionalMetadata(
  source: Record<string, unknown>,
  key: string,
  context: string,
): Prisma.InputJsonValue | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (!isJsonValue(value)) {
    throw new Error(`${context}.${key} must be valid JSON-compatible data.`);
  }

  return value;
}

function assertUniqueIds(
  rows: Array<{ id?: string }>,
  label: string,
): void {
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row.id) {
      throw new Error(`${label} id is required.`);
    }

    if (seen.has(row.id)) {
      throw new Error(`Duplicate ${label} id found: ${row.id}`);
    }

    seen.add(row.id);
  }
}

function assertFixtureIntegrity(
  users: Array<{ id?: string }>,
  raffles: Prisma.RaffleCreateManyInput[],
  transactions: Prisma.TransactionCreateManyInput[],
  tickets: Prisma.TicketCreateManyInput[],
  payouts: Prisma.PayoutCreateManyInput[],
  events: Prisma.RaffleEventCreateManyInput[],
): void {
  assertUniqueIds(users, 'user');
  assertUniqueIds(raffles, 'raffle');
  assertUniqueIds(transactions, 'transaction');
  assertUniqueIds(tickets, 'ticket');
  assertUniqueIds(payouts, 'payout');
  assertUniqueIds(events, 'raffleEvent');

  const userIds = new Set(users.map((row) => row.id));
  const raffleIds = new Set(raffles.map((row) => row.id));
  const transactionById = new Map(transactions.map((row) => [row.id, row]));
  const raffleById = new Map(raffles.map((row) => [row.id, row]));
  const raffleTicketNumbers = new Set<string>();

  for (const raffle of raffles) {
    if (!userIds.has(raffle.rafflerId)) {
      throw new Error(
        `Raffle ${raffle.id} references unknown rafflerId ${raffle.rafflerId}.`,
      );
    }
  }

  for (const transaction of transactions) {
    if (!userIds.has(transaction.userId)) {
      throw new Error(
        `Transaction ${transaction.id} references unknown userId ${transaction.userId}.`,
      );
    }

    if (!raffleIds.has(transaction.raffleId)) {
      throw new Error(
        `Transaction ${transaction.id} references unknown raffleId ${transaction.raffleId}.`,
      );
    }
  }

  for (const ticket of tickets) {
    if (!userIds.has(ticket.buyerId)) {
      throw new Error(
        `Ticket ${ticket.id} references unknown buyerId ${ticket.buyerId}.`,
      );
    }

    if (!raffleIds.has(ticket.raffleId)) {
      throw new Error(
        `Ticket ${ticket.id} references unknown raffleId ${ticket.raffleId}.`,
      );
    }

    const transaction = transactionById.get(ticket.transactionId);

    if (!transaction) {
      throw new Error(
        `Ticket ${ticket.id} references unknown transactionId ${ticket.transactionId}.`,
      );
    }

    if (transaction.userId !== ticket.buyerId) {
      throw new Error(
        `Ticket ${ticket.id} buyerId ${ticket.buyerId} does not match transaction userId ${transaction.userId}.`,
      );
    }

    if (transaction.raffleId !== ticket.raffleId) {
      throw new Error(
        `Ticket ${ticket.id} raffleId ${ticket.raffleId} does not match transaction raffleId ${transaction.raffleId}.`,
      );
    }

    const ticketNumberKey = `${ticket.raffleId}:${String(ticket.ticketNumber)}`;

    if (raffleTicketNumbers.has(ticketNumberKey)) {
      throw new Error(
        `Duplicate ticketNumber ${ticket.ticketNumber} found for raffle ${ticket.raffleId}.`,
      );
    }

    raffleTicketNumbers.add(ticketNumberKey);
  }

  for (const payout of payouts) {
    if (!userIds.has(payout.rafflerId)) {
      throw new Error(
        `Payout ${payout.id} references unknown rafflerId ${payout.rafflerId}.`,
      );
    }

    const raffle = raffleById.get(payout.raffleId);

    if (!raffle) {
      throw new Error(
        `Payout ${payout.id} references unknown raffleId ${payout.raffleId}.`,
      );
    }

    if (raffle.rafflerId !== payout.rafflerId) {
      throw new Error(
        `Payout ${payout.id} rafflerId ${payout.rafflerId} does not match raffle rafflerId ${raffle.rafflerId}.`,
      );
    }
  }

  for (const event of events) {
    if (!raffleIds.has(event.raffleId)) {
      throw new Error(
        `RaffleEvent ${event.id} references unknown raffleId ${event.raffleId}.`,
      );
    }
  }
}

type SeedPayload = {
  users: SeedUserFixture[];
  raffles: Prisma.RaffleCreateManyInput[];
  transactions: Prisma.TransactionCreateManyInput[];
  tickets: Prisma.TicketCreateManyInput[];
  payouts: Prisma.PayoutCreateManyInput[];
  raffleEvents: Prisma.RaffleEventCreateManyInput[];
};

type SeedUserFixture = Omit<Prisma.UserCreateManyInput, 'passwordHash'> & {
  password: string;
};

function parseUsers(rows: Record<string, unknown>[]): SeedUserFixture[] {
  return rows.map((row, index) => {
    const context = `users[${String(index)}]`;
    const phone = readOptionalNullableString(row, 'phone', context);
    const createdAt = readOptionalDate(row, 'createdAt', context);
    const updatedAt = readOptionalDate(row, 'updatedAt', context);
    const kycStatus = parseOptionalEnumValue(
      row,
      'kycStatus',
      KycStatus,
      KycStatus.PENDING,
      context,
    );

    return {
      id: readRequiredString(row, 'id', context),
      email: readRequiredString(row, 'email', context),
      password: readRequiredString(row, 'password', context),
      kycStatus,
      ...(phone !== undefined ? { phone } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
  });
}

function parseRaffles(rows: Record<string, unknown>[]): Prisma.RaffleCreateManyInput[] {
  return rows.map((row, index) => {
    const context = `raffles[${String(index)}]`;
    const description = readOptionalNullableString(row, 'description', context);
    const imageUrls = readOptionalStringArray(row, 'imageUrls', context);
    const minSellThrough = readOptionalNullableInt(row, 'minSellThrough', context);
    const startTime = readOptionalDate(row, 'startTime', context);
    const endTime = readOptionalDate(row, 'endTime', context);
    const createdAt = readOptionalDate(row, 'createdAt', context);
    const updatedAt = readOptionalDate(row, 'updatedAt', context);

    if (!endTime) {
      throw new Error(`${context}.endTime is required.`);
    }

    if (imageUrls && imageUrls.length > 3) {
      throw new Error(`${context}.imageUrls supports up to 3 entries.`);
    }

    const itemType = parseOptionalEnumValue(
      row,
      'itemType',
      ItemTypeEnum,
      ItemTypeEnum.PHYSICAL,
      context,
    );

    const status = parseOptionalEnumValue(
      row,
      'status',
      RaffleStatusEnum,
      RaffleStatusEnum.DRAFT,
      context,
    );

    return {
      id: readRequiredString(row, 'id', context),
      rafflerId: readRequiredString(row, 'rafflerId', context),
      title: readRequiredString(row, 'title', context),
      totalTickets: readRequiredInt(row, 'totalTickets', context),
      ticketPrice: readRequiredInt(row, 'ticketPrice', context),
      ticketsSold: readOptionalNullableInt(row, 'ticketsSold', context) ?? 0,
      itemType,
      status,
      endTime,
      ...(description !== undefined ? { description } : {}),
      ...(imageUrls !== undefined ? { imageUrls } : {}),
      ...(minSellThrough !== undefined ? { minSellThrough } : {}),
      ...(startTime ? { startTime } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(updatedAt ? { updatedAt } : {}),
    };
  });
}

function parseTransactions(
  rows: Record<string, unknown>[],
): Prisma.TransactionCreateManyInput[] {
  return rows.map((row, index) => {
    const context = `transactions[${String(index)}]`;
    const createdAt = readOptionalDate(row, 'createdAt', context);
    const stripePaymentIntentId = readOptionalNullableString(
      row,
      'stripePaymentIntentId',
      context,
    );
    const status = parseOptionalEnumValue(
      row,
      'status',
      TransactionStatusEnum,
      TransactionStatusEnum.PENDING,
      context,
    );

    const currency =
      readOptionalNullableString(row, 'currency', context) ?? 'usd';

    return {
      id: readRequiredString(row, 'id', context),
      userId: readRequiredString(row, 'userId', context),
      raffleId: readRequiredString(row, 'raffleId', context),
      amount: readRequiredInt(row, 'amount', context),
      currency,
      status,
      ...(stripePaymentIntentId !== undefined
        ? { stripePaymentIntentId }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  });
}

function parseTickets(rows: Record<string, unknown>[]): Prisma.TicketCreateManyInput[] {
  return rows.map((row, index) => {
    const context = `tickets[${String(index)}]`;
    const createdAt = readOptionalDate(row, 'createdAt', context);

    return {
      id: readRequiredString(row, 'id', context),
      raffleId: readRequiredString(row, 'raffleId', context),
      buyerId: readRequiredString(row, 'buyerId', context),
      transactionId: readRequiredString(row, 'transactionId', context),
      ticketNumber: readRequiredInt(row, 'ticketNumber', context),
      ...(createdAt ? { createdAt } : {}),
    };
  });
}

function parsePayouts(rows: Record<string, unknown>[]): Prisma.PayoutCreateManyInput[] {
  return rows.map((row, index) => {
    const context = `payouts[${String(index)}]`;
    const createdAt = readOptionalDate(row, 'createdAt', context);
    const stripeTransferId = readOptionalNullableString(
      row,
      'stripeTransferId',
      context,
    );
    const status = parseOptionalEnumValue(
      row,
      'status',
      PayoutStatusEnum,
      PayoutStatusEnum.PENDING,
      context,
    );

    return {
      id: readRequiredString(row, 'id', context),
      raffleId: readRequiredString(row, 'raffleId', context),
      rafflerId: readRequiredString(row, 'rafflerId', context),
      amount: readRequiredInt(row, 'amount', context),
      status,
      ...(stripeTransferId !== undefined ? { stripeTransferId } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  });
}

function parseRaffleEvents(
  rows: Record<string, unknown>[],
): Prisma.RaffleEventCreateManyInput[] {
  return rows.map((row, index) => {
    const context = `raffleEvents[${String(index)}]`;
    const createdAt = readOptionalDate(row, 'createdAt', context);
    const metadata = readOptionalMetadata(row, 'metadata', context);
    const eventType = parseEnumValue(
      row.eventType,
      RaffleEventTypeEnum,
      `${context}.eventType`,
    );

    return {
      id: readRequiredString(row, 'id', context),
      raffleId: readRequiredString(row, 'raffleId', context),
      eventType,
      ...(metadata !== undefined ? { metadata } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
  });
}

async function parseSeedFixture(filePath: string): Promise<SeedPayload> {
  const fixtureContent = await readFile(filePath, 'utf-8');
  const parsedFixture = loadYaml(fixtureContent);

  if (parsedFixture === undefined) {
    throw new Error(`Fixture file is empty: ${filePath}`);
  }

  const root = asRecord(parsedFixture, 'seed fixtures');

  const users = parseUsers(asRecordArray(root, 'users', 'seed fixtures'));
  const raffles = parseRaffles(asRecordArray(root, 'raffles', 'seed fixtures'));
  const transactions = parseTransactions(
    asRecordArray(root, 'transactions', 'seed fixtures'),
  );
  const tickets = parseTickets(asRecordArray(root, 'tickets', 'seed fixtures'));
  const payouts = parsePayouts(asRecordArray(root, 'payouts', 'seed fixtures'));
  const raffleEvents = parseRaffleEvents(
    asRecordArray(root, 'raffleEvents', 'seed fixtures'),
  );

  assertFixtureIntegrity(
    users,
    raffles,
    transactions,
    tickets,
    payouts,
    raffleEvents,
  );

  return {
    users,
    raffles,
    transactions,
    tickets,
    payouts,
    raffleEvents,
  };
}

async function clearTables(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.raffleEvent.deleteMany(),
    prisma.pendingRaffleImageUpload.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.raffle.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedTables(
  prisma: PrismaClient,
  payload: SeedPayload,
): Promise<void> {
  const { users, raffles, transactions, tickets, payouts, raffleEvents } =
    payload;
  const usersWithHashedPasswords: Prisma.UserCreateManyInput[] =
    await Promise.all(
      users.map(async ({ password, ...user }) => ({
        ...user,
        passwordHash: await hashPassword(password, BCRYPT_ROUNDS),
      })),
    );

  await prisma.$transaction(async (tx) => {
    if (usersWithHashedPasswords.length > 0) {
      await tx.user.createMany({ data: usersWithHashedPasswords });
    }

    if (raffles.length > 0) {
      await tx.raffle.createMany({ data: raffles });
    }

    if (transactions.length > 0) {
      await tx.transaction.createMany({ data: transactions });
    }

    if (tickets.length > 0) {
      await tx.ticket.createMany({ data: tickets });
    }

    if (payouts.length > 0) {
      await tx.payout.createMany({ data: payouts });
    }

    if (raffleEvents.length > 0) {
      await tx.raffleEvent.createMany({ data: raffleEvents });
    }
  });
}

export const seedCommand: JobCommand = {
  name: 'seed',
  description:
    'Hydrate database from YAML fixtures (default: apps/jobs/fixtures/seed.yaml).',
  async run({ prisma, args }) {
    const fixturePath = args[0]
      ? path.resolve(process.cwd(), args[0])
      : DEFAULT_FIXTURE_FILE;

    const payload = await parseSeedFixture(fixturePath);
    const copiedImageCount = await ensureSeedRaffleImages(payload.raffles);

    await clearTables(prisma);
    await seedTables(prisma, payload);

    console.log('Seed completed from fixture file:');
    console.log(`  ${fixturePath}`);
    console.log(
      `Rows inserted: users=${payload.users.length}, raffles=${payload.raffles.length}, transactions=${payload.transactions.length}, tickets=${payload.tickets.length}, payouts=${payload.payouts.length}, raffleEvents=${payload.raffleEvents.length}`,
    );
    console.log(`Copied raffle product images: ${copiedImageCount}`);
  },
};
