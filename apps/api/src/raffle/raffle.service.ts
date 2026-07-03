import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ItemType,
  Prisma,
  Raffle,
  RaffleEvent,
  RaffleStatus,
  TransactionStatus,
} from '@prisma/client';
import { revealWinnerProof, type DrawProof } from '@raffleroyale/raffle-draw';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BeaconService } from './beacon.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';

export const MAX_RAFFLE_IMAGE_UPLOADS = 3;
export const MAX_RAFFLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const UPLOADS_ROOT_DIRECTORY =
  process.env.UPLOADS_DIRECTORY ?? join(process.cwd(), 'uploads');
const RAFFLE_UPLOADS_DIRECTORY = join(UPLOADS_ROOT_DIRECTORY, 'raffles');
const RAFFLE_UPLOAD_URL_PATTERN = /^\/api\/uploads\/raffles\/([\w.-]+)$/;
const RAFFLE_IMAGE_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
const SUPPORTED_IMAGE_SIGNATURES = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer: Buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer: Buffer) =>
      buffer.length >= 12 &&
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50,
  },
  {
    mimeType: 'image/gif',
    extension: '.gif',
    matches: (buffer: Buffer) =>
      buffer.length >= 6 &&
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61,
  },
] as const;

type UploadImageFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

type PurchaseTicketsResult = {
  raffleId: string;
  transactionId: string;
  quantity: number;
  ticketNumbers: number[];
  totalAmount: number;
  raffleStatus: RaffleStatus;
};

type ResolveWinnerResult =
  | {
      phase: 'committed';
      raffleId: string;
      raffleStatus: RaffleStatus;
      beaconRound: number;
      beaconChainHash: string;
      scheme: string;
      availableAt: string;
    }
  | {
      phase: 'pending';
      raffleId: string;
      raffleStatus: RaffleStatus;
      beaconRound: number;
      availableAt: string;
    }
  | {
      phase: 'revealed';
      raffleId: string;
      raffleStatus: RaffleStatus;
      winnerTicketId: string;
      winnerTicketNumber: number;
      ticketCount: number;
      winnerIndex: number;
      beaconRound: number;
      randomness: string;
    };

type DisbandRaffleResult = {
  raffleId: string;
  raffleStatus: RaffleStatus;
  refundedTransactions: number;
  sellThroughPercent: number;
};

type ProcessExpiredRafflesResult = {
  processed: number;
  disbanded: number;
  markedExpiredThresholdMet: number;
};

type CleanupExpiredPendingUploadsResult = {
  deletedRecords: number;
  deletedFiles: number;
};

const VALID_CREATE_STATUSES = new Set<RaffleStatus>([
  RaffleStatus.DRAFT,
  RaffleStatus.ACTIVE,
]);

const raffleDetailInclude = {
  raffler: {
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  },
  events: {
    orderBy: { createdAt: 'asc' },
    include: {
      winnerTicket: {
        select: {
          id: true,
          ticketNumber: true,
          buyer: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RaffleInclude;

type RaffleDetailBase = Prisma.RaffleGetPayload<{
  include: typeof raffleDetailInclude;
}>;

type RaffleDetailEvent = RaffleDetailBase['events'][number];
type RaffleDetailWinnerTicket = NonNullable<RaffleDetailEvent['winnerTicket']>;

export type RaffleDetail = Omit<
  RaffleDetailBase,
  'events' | 'drawBeaconRound'
> & {
  drawBeaconRound: number | null;
  events: Array<
    Omit<RaffleDetailEvent, 'winnerTicket'> & {
      winnerTicket:
        | (Omit<RaffleDetailWinnerTicket, 'buyer'> & {
            buyer: Omit<RaffleDetailWinnerTicket['buyer'], 'email'> & {
              email: string | null;
            };
          })
        | null;
    }
  >;
};

export type RaffleSummary = Omit<Raffle, 'drawBeaconRound'> & {
  drawBeaconRound: number | null;
};

function serializeRaffle(raffle: Raffle): RaffleSummary {
  return {
    ...raffle,
    drawBeaconRound:
      raffle.drawBeaconRound === null ? null : Number(raffle.drawBeaconRound),
  };
}

mkdirSync(RAFFLE_UPLOADS_DIRECTORY, { recursive: true });

@Injectable()
export class RaffleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly beacon: BeaconService,
  ) {}

  async uploadImages(
    files: UploadImageFile[] = [],
    ownerId: string,
  ): Promise<{ imageUrls: string[] }> {
    if (files.length === 0) {
      throw new BadRequestException('Upload at least one image file.');
    }

    const pendingUploads = files.map((file) => {
      const normalizedMimeType = file.mimetype.toLowerCase();
      const imageFormat = SUPPORTED_IMAGE_SIGNATURES.find(
        (signature) =>
          signature.mimeType === normalizedMimeType &&
          signature.matches(file.buffer),
      );

      if (!imageFormat) {
        throw new BadRequestException(
          'Only jpg, png, webp, and gif image files are allowed.',
        );
      }

      const fileName = `${Date.now().toString(36)}-${randomUUID()}${imageFormat.extension}`;
      const urlPath = `/api/uploads/raffles/${fileName}`;

      return {
        fileName,
        urlPath,
        mimeType: imageFormat.mimeType,
        buffer: file.buffer,
      };
    });

    const writtenFileNames: string[] = [];
    try {
      for (const upload of pendingUploads) {
        await writeFile(
          join(RAFFLE_UPLOADS_DIRECTORY, upload.fileName),
          upload.buffer,
        );
        writtenFileNames.push(upload.fileName);
      }
    } catch (error) {
      await this.removeFilesFromDisk(writtenFileNames);
      throw error;
    }

    const expiresAt = new Date(Date.now() + RAFFLE_IMAGE_UPLOAD_TTL_MS);

    try {
      await this.prisma.pendingRaffleImageUpload.createMany({
        data: pendingUploads.map((upload) => ({
          ownerId,
          fileName: upload.fileName,
          mimeType: upload.mimeType,
          urlPath: upload.urlPath,
          expiresAt,
        })),
      });
    } catch (error) {
      await this.removeFilesFromDisk(
        pendingUploads.map((upload) => upload.fileName),
      );
      throw error;
    }

    return {
      imageUrls: pendingUploads.map((upload) => upload.urlPath),
    };
  }

  async create(
    createRaffleDto: CreateRaffleDto,
    imageUploadOwnerId: string,
  ): Promise<RaffleSummary> {
    const endTime = new Date(createRaffleDto.endTime);
    if (endTime.getTime() <= Date.now()) {
      throw new BadRequestException('endTime must be in the future');
    }

    const raffler = await this.prisma.user.findUnique({
      where: { id: createRaffleDto.rafflerId },
      select: { id: true },
    });

    if (!raffler) {
      throw new BadRequestException('rafflerId does not exist');
    }

    const status = createRaffleDto.status ?? RaffleStatus.DRAFT;
    if (!VALID_CREATE_STATUSES.has(status)) {
      throw new BadRequestException(
        'Only DRAFT or ACTIVE raffles can be created',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        const pendingUploads = await this.getPendingUploadsForCreation(
          createRaffleDto.imageUrls ?? [],
          imageUploadOwnerId,
          tx,
        );

        const raffle = await tx.raffle.create({
          data: {
            rafflerId: createRaffleDto.rafflerId,
            title: createRaffleDto.title,
            description: createRaffleDto.description,
            imageUrls: pendingUploads.map((upload) => upload.urlPath),
            itemType: createRaffleDto.itemType ?? ItemType.PHYSICAL,
            totalTickets: createRaffleDto.totalTickets,
            ticketPrice: createRaffleDto.ticketPrice,
            minSellThrough: createRaffleDto.minSellThrough,
            status,
            endTime,
          },
        });

        if (pendingUploads.length > 0) {
          const claimResult = await tx.pendingRaffleImageUpload.updateMany({
            where: {
              id: { in: pendingUploads.map((upload) => upload.id) },
              ownerId: imageUploadOwnerId,
              consumedAt: null,
            },
            data: {
              raffleId: raffle.id,
              consumedAt: new Date(),
            },
          });

          if (claimResult.count !== pendingUploads.length) {
            throw new ConflictException(
              'One or more image uploads were already claimed.',
            );
          }
        }

        await tx.raffleEvent.create({
          data: {
            raffleId: raffle.id,
            eventType: 'CREATED',
            metadata: {
              status,
              totalTickets: raffle.totalTickets,
              ticketPrice: raffle.ticketPrice,
            },
          },
        });

        return serializeRaffle(raffle);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(): Promise<RaffleSummary[]> {
    const raffles = await this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return raffles.map(serializeRaffle);
  }

  async findOne(id: string, auth?: AuthContext): Promise<RaffleDetail> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id },
      include: raffleDetailInclude,
    });

    if (!raffle) {
      throw new NotFoundException(`Raffle ${id} not found`);
    }

    const isOwner = auth?.userId === raffle.rafflerId;
    const isAdmin = auth?.role === 'ADMIN';
    const canSeeWinnerEmail = isOwner || isAdmin;
    const serializedRaffle = serializeRaffle(raffle);

    return {
      ...serializedRaffle,
      raffler: raffle.raffler,
      events: raffle.events.map((event) => ({
        ...event,
        winnerTicket: event.winnerTicket
          ? {
              ...event.winnerTicket,
              buyer: {
                ...event.winnerTicket.buyer,
                email: canSeeWinnerEmail
                  ? event.winnerTicket.buyer.email
                  : null,
              },
            }
          : null,
      })),
    };
  }

  async purchaseTickets(
    raffleId: string,
    purchaseTicketsDto: PurchaseTicketsDto,
  ): Promise<PurchaseTicketsResult> {
    const purchaseResult = await this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );

        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (raffle.status !== RaffleStatus.ACTIVE) {
          throw new ConflictException('Only ACTIVE raffles can accept tickets');
        }

        if (raffle.endTime.getTime() <= Date.now()) {
          throw new ConflictException('Raffle has expired');
        }

        const buyer = await tx.user.findUnique({
          where: { id: purchaseTicketsDto.buyerId },
          select: { id: true },
        });
        if (!buyer) {
          throw new BadRequestException('buyerId does not exist');
        }

        const remainingTickets = raffle.totalTickets - raffle.ticketsSold;
        if (purchaseTicketsDto.quantity > remainingTickets) {
          throw new ConflictException('Not enough tickets remaining');
        }

        const totalAmount = purchaseTicketsDto.quantity * raffle.ticketPrice;
        const transaction = await tx.transaction.create({
          data: {
            userId: buyer.id,
            raffleId,
            amount: totalAmount,
            status: TransactionStatus.SUCCEEDED,
          },
        });

        const firstTicketNumber = raffle.ticketsSold + 1;
        const ticketNumbers = Array.from(
          { length: purchaseTicketsDto.quantity },
          (_, index) => firstTicketNumber + index,
        );

        await tx.ticket.createMany({
          data: ticketNumbers.map((ticketNumber) => ({
            raffleId,
            buyerId: buyer.id,
            transactionId: transaction.id,
            ticketNumber,
          })),
        });

        const nextTicketsSold =
          raffle.ticketsSold + purchaseTicketsDto.quantity;
        const nextStatus =
          nextTicketsSold === raffle.totalTickets
            ? RaffleStatus.SOLD_OUT
            : raffle.status;

        await tx.raffle.update({
          where: { id: raffleId },
          data: {
            ticketsSold: nextTicketsSold,
            status: nextStatus,
          },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'TICKET_PURCHASED',
            metadata: {
              buyerId: buyer.id,
              quantity: purchaseTicketsDto.quantity,
              ticketNumbers,
              transactionId: transaction.id,
              totalAmount,
            },
          },
        });

        if (nextStatus === RaffleStatus.SOLD_OUT) {
          await tx.raffleEvent.create({
            data: {
              raffleId,
              eventType: 'SOLD_OUT',
              metadata: {
                ticketsSold: nextTicketsSold,
                totalTickets: raffle.totalTickets,
              },
            },
          });
        }

        return {
          raffleId,
          transactionId: transaction.id,
          quantity: purchaseTicketsDto.quantity,
          ticketNumbers,
          totalAmount,
          raffleStatus: nextStatus,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return purchaseResult;
  }

  async findEvents(id: string): Promise<RaffleEvent[]> {
    await this.findOne(id);

    return this.prisma.raffleEvent.findMany({
      where: { raffleId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Determine whether an EXPIRED raffle met its minimum sell-through and is
   * therefore eligible to draw a winner.
   */
  private isExpiredEligible(raffle: {
    status: RaffleStatus;
    totalTickets: number;
    ticketsSold: number;
    minSellThrough: number | null;
  }): boolean {
    if (raffle.status !== RaffleStatus.EXPIRED) {
      return false;
    }
    const sellThroughPercent =
      raffle.totalTickets === 0
        ? 0
        : (raffle.ticketsSold / raffle.totalTickets) * 100;
    return (
      raffle.minSellThrough !== null &&
      sellThroughPercent >= raffle.minSellThrough
    );
  }

  /**
   * Advance a raffle's draw using the drand commit-reveal protocol.
   *
   * Phase 1 (commit): when a raffle first becomes resolvable (SOLD_OUT, or an
   * EXPIRED raffle that met its minimum sell-through) we pin a *future* drand
   * round whose randomness cannot yet exist, move the raffle to PENDING_DRAW,
   * and record a DRAW_COMMITTED audit event. This makes the outcome
   * unpredictable and impossible for anyone — including us — to grind.
   *
   * Phase 2 (reveal): once the committed round has been published, we fetch it,
   * verify its BLS signature, deterministically derive the winning ticket from
   * its randomness, and record a WINNER_SELECTED event with a fully
   * re-verifiable proof.
   */
  async resolveWinner(raffleId: string): Promise<ResolveWinnerResult> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
    });
    if (!raffle) {
      throw new NotFoundException(`Raffle ${raffleId} not found`);
    }

    const existingWinnerEvent = await this.prisma.raffleEvent.findFirst({
      where: { raffleId, eventType: 'WINNER_SELECTED' },
      select: { id: true },
    });
    if (existingWinnerEvent || raffle.status === RaffleStatus.COMPLETED) {
      throw new ConflictException('Winner has already been resolved');
    }

    if (raffle.status === RaffleStatus.PENDING_DRAW) {
      return this.revealDraw(raffleId);
    }

    const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
    if (!isSoldOut && !this.isExpiredEligible(raffle)) {
      if (raffle.status === RaffleStatus.EXPIRED) {
        throw new ConflictException(
          'Expired raffle did not meet minimum sell-through',
        );
      }
      throw new ConflictException(
        'Only SOLD_OUT or eligible EXPIRED raffles can resolve a winner',
      );
    }

    const ticketCount = await this.prisma.ticket.count({ where: { raffleId } });
    if (ticketCount <= 0) {
      throw new ConflictException('Cannot resolve winner with no tickets');
    }

    const committed = await this.commitDraw(raffleId);

    // If the committed round is already available (e.g. a low lead time in
    // tests, or a slow operator) reveal immediately; otherwise report the
    // pending commitment so the background sweep can finish the draw once the
    // beacon publishes the round.
    if (Date.parse(committed.availableAt) <= Date.now()) {
      return this.revealDraw(raffleId);
    }
    return committed;
  }

  /**
   * Phase 1 of the draw. Pins a future beacon round and moves the raffle to
   * PENDING_DRAW. Idempotent: re-committing an already-committed raffle returns
   * the existing commitment.
   */
  private async commitDraw(
    raffleId: string,
  ): Promise<Extract<ResolveWinnerResult, { phase: 'committed' }>> {
    const commitment = await this.beacon.buildCommitment(
      Math.floor(Date.now() / 1000),
    );

    return this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );
        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (
          raffle.status === RaffleStatus.PENDING_DRAW &&
          raffle.drawBeaconRound !== null
        ) {
          return {
            phase: 'committed' as const,
            raffleId,
            raffleStatus: raffle.status,
            beaconRound: Number(raffle.drawBeaconRound),
            beaconChainHash: raffle.drawBeaconChainHash ?? commitment.chainHash,
            scheme: raffle.drawScheme ?? commitment.scheme,
            availableAt: (
              raffle.drawAvailableAt ?? new Date(commitment.availableAt)
            ).toISOString(),
          };
        }

        const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
        if (!isSoldOut && !this.isExpiredEligible(raffle)) {
          throw new ConflictException(
            'Only SOLD_OUT or eligible EXPIRED raffles can resolve a winner',
          );
        }

        await tx.raffle.update({
          where: { id: raffleId },
          data: {
            status: RaffleStatus.PENDING_DRAW,
            drawBeaconRound: BigInt(commitment.round),
            drawBeaconChainHash: commitment.chainHash,
            drawScheme: commitment.scheme,
            drawCommittedAt: new Date(commitment.committedAt),
            drawAvailableAt: new Date(commitment.availableAt),
          },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'DRAW_COMMITTED',
            metadata: {
              algorithm: commitment.algorithm,
              chainHash: commitment.chainHash,
              scheme: commitment.scheme,
              beaconRound: commitment.round,
              committedAt: commitment.committedAt,
              availableAt: commitment.availableAt,
            },
          },
        });

        return {
          phase: 'committed' as const,
          raffleId,
          raffleStatus: RaffleStatus.PENDING_DRAW,
          beaconRound: commitment.round,
          beaconChainHash: commitment.chainHash,
          scheme: commitment.scheme,
          availableAt: commitment.availableAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  /**
   * Phase 2 of the draw. Fetches and verifies the committed beacon round, then
   * deterministically derives and records the winning ticket. Returns a
   * `pending` result if the committed round has not been published yet.
   */
  private async revealDraw(
    raffleId: string,
  ): Promise<Extract<ResolveWinnerResult, { phase: 'revealed' | 'pending' }>> {
    const raffle = await this.prisma.raffle.findUnique({
      where: { id: raffleId },
    });
    if (!raffle) {
      throw new NotFoundException(`Raffle ${raffleId} not found`);
    }
    if (
      raffle.status !== RaffleStatus.PENDING_DRAW ||
      raffle.drawBeaconRound === null
    ) {
      throw new ConflictException('Raffle has no pending draw commitment');
    }

    const beaconRound = Number(raffle.drawBeaconRound);
    const availableAt = raffle.drawAvailableAt ?? new Date(0);
    if (availableAt.getTime() > Date.now()) {
      return {
        phase: 'pending',
        raffleId,
        raffleStatus: RaffleStatus.PENDING_DRAW,
        beaconRound,
        availableAt: availableAt.toISOString(),
      };
    }

    const info = await this.beacon.getChainInfo();
    const round = await this.beacon.getRound(beaconRound);
    const ticketCount = await this.prisma.ticket.count({ where: { raffleId } });
    if (ticketCount <= 0) {
      throw new ConflictException('Cannot resolve winner with no tickets');
    }

    // Verifies the BLS signature + randomness and derives the winner index.
    const proof = revealWinnerProof({ raffleId, ticketCount, round, info });

    return this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );
        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const locked = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!locked) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const existingWinnerEvent = await tx.raffleEvent.findFirst({
          where: { raffleId, eventType: 'WINNER_SELECTED' },
          select: { id: true },
        });
        if (existingWinnerEvent || locked.status === RaffleStatus.COMPLETED) {
          throw new ConflictException('Winner has already been resolved');
        }
        if (locked.status !== RaffleStatus.PENDING_DRAW) {
          throw new ConflictException('Raffle has no pending draw commitment');
        }

        const lockedCount = await tx.ticket.count({ where: { raffleId } });
        if (lockedCount !== ticketCount) {
          throw new ConflictException('Ticket count changed during draw');
        }

        const winnerTicket = await tx.ticket.findFirst({
          where: { raffleId },
          orderBy: { ticketNumber: 'asc' },
          skip: proof.winnerIndex,
        });
        if (!winnerTicket) {
          throw new NotFoundException('Winner ticket could not be determined');
        }

        const fullProof: DrawProof = {
          ...proof,
          winnerTicketNumber: winnerTicket.ticketNumber,
        };

        await tx.raffle.update({
          where: { id: raffleId },
          data: { status: RaffleStatus.COMPLETED },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'WINNER_SELECTED',
            winnerTicketId: winnerTicket.id,
            metadata: {
              winnerTicketId: winnerTicket.id,
              winnerTicketNumber: winnerTicket.ticketNumber,
              ticketCount,
              winnerIndex: fullProof.winnerIndex,
              algorithm: fullProof.algorithm,
              beacon: {
                chainHash: fullProof.chainHash,
                scheme: fullProof.scheme,
                round: fullProof.round,
                randomness: fullProof.randomness,
                signature: fullProof.signature,
                publicKey: fullProof.publicKey,
              },
              derivation: {
                seed: fullProof.seed,
                digest: fullProof.digest,
              },
            },
          },
        });

        return {
          phase: 'revealed' as const,
          raffleId,
          raffleStatus: RaffleStatus.COMPLETED,
          winnerTicketId: winnerTicket.id,
          winnerTicketNumber: winnerTicket.ticketNumber,
          ticketCount,
          winnerIndex: fullProof.winnerIndex,
          beaconRound: fullProof.round,
          randomness: fullProof.randomness,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async disbandRaffle(raffleId: string): Promise<DisbandRaffleResult> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const lockRows = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
        );

        if (lockRows.length === 0) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        const raffle = await tx.raffle.findUnique({ where: { id: raffleId } });
        if (!raffle) {
          throw new NotFoundException(`Raffle ${raffleId} not found`);
        }

        if (raffle.status === RaffleStatus.DISBANDED) {
          throw new ConflictException('Raffle is already disbanded');
        }

        if (raffle.status === RaffleStatus.COMPLETED) {
          throw new ConflictException('Completed raffles cannot be disbanded');
        }

        if (raffle.status === RaffleStatus.SOLD_OUT) {
          throw new ConflictException(
            'SOLD_OUT raffles must resolve a winner, not disband',
          );
        }

        if (raffle.endTime.getTime() > Date.now()) {
          throw new ConflictException('Only expired raffles can be disbanded');
        }

        const sellThroughPercent =
          raffle.totalTickets === 0
            ? 0
            : (raffle.ticketsSold / raffle.totalTickets) * 100;
        const meetsMinSellThrough =
          raffle.minSellThrough !== null &&
          sellThroughPercent >= raffle.minSellThrough;

        if (meetsMinSellThrough) {
          throw new ConflictException(
            'Raffle met minimum sell-through and should follow completion flow',
          );
        }

        if (raffle.status !== RaffleStatus.EXPIRED) {
          await tx.raffleEvent.create({
            data: {
              raffleId,
              eventType: 'EXPIRED',
              metadata: {
                endTime: raffle.endTime.toISOString(),
                ticketsSold: raffle.ticketsSold,
                totalTickets: raffle.totalTickets,
              },
            },
          });
        }

        const refundResult = await tx.transaction.updateMany({
          where: {
            raffleId,
            status: TransactionStatus.SUCCEEDED,
          },
          data: {
            status: TransactionStatus.REFUNDED,
          },
        });

        await tx.raffle.update({
          where: { id: raffleId },
          data: { status: RaffleStatus.DISBANDED },
        });

        await tx.raffleEvent.create({
          data: {
            raffleId,
            eventType: 'DISBANDED',
            metadata: {
              refundedTransactions: refundResult.count,
              sellThroughPercent,
              minSellThrough: raffle.minSellThrough,
            },
          },
        });

        return {
          raffleId,
          raffleStatus: RaffleStatus.DISBANDED,
          refundedTransactions: refundResult.count,
          sellThroughPercent,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
  }

  async cleanupExpiredPendingImageUploads(): Promise<CleanupExpiredPendingUploadsResult> {
    const now = new Date();
    const expiredUploads = await this.prisma.pendingRaffleImageUpload.findMany({
      where: {
        consumedAt: null,
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        fileName: true,
      },
    });

    let deletedRecords = 0;
    let deletedFiles = 0;

    for (const upload of expiredUploads) {
      const deleteResult =
        await this.prisma.pendingRaffleImageUpload.deleteMany({
          where: {
            id: upload.id,
            consumedAt: null,
            expiresAt: { lte: now },
          },
        });

      if (deleteResult.count === 0) {
        continue;
      }

      deletedRecords += 1;

      try {
        await unlink(join(RAFFLE_UPLOADS_DIRECTORY, upload.fileName));
        deletedFiles += 1;
      } catch (error) {
        if (!this.isErrnoException(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }

    return {
      deletedRecords,
      deletedFiles,
    };
  }

  async processExpiredRaffles(): Promise<ProcessExpiredRafflesResult> {
    const now = new Date();
    const candidates = await this.prisma.raffle.findMany({
      where: {
        status: RaffleStatus.ACTIVE,
        endTime: {
          lte: now,
        },
      },
      select: {
        id: true,
        totalTickets: true,
        ticketsSold: true,
        minSellThrough: true,
      },
    });

    let disbanded = 0;
    let markedExpiredThresholdMet = 0;

    for (const raffle of candidates) {
      if (raffle.ticketsSold >= raffle.totalTickets) {
        continue;
      }

      const sellThroughPercent =
        raffle.totalTickets === 0
          ? 0
          : (raffle.ticketsSold / raffle.totalTickets) * 100;
      const meetsMinSellThrough =
        raffle.minSellThrough !== null &&
        sellThroughPercent >= raffle.minSellThrough;

      if (meetsMinSellThrough) {
        const updateResult = await this.prisma.raffle.updateMany({
          where: {
            id: raffle.id,
            status: RaffleStatus.ACTIVE,
            endTime: {
              lte: now,
            },
          },
          data: {
            status: RaffleStatus.EXPIRED,
          },
        });

        if (updateResult.count > 0) {
          markedExpiredThresholdMet += 1;
          await this.prisma.raffleEvent.create({
            data: {
              raffleId: raffle.id,
              eventType: 'EXPIRED',
              metadata: {
                reason: 'threshold-met-awaiting-resolution',
                sellThroughPercent,
                minSellThrough: raffle.minSellThrough,
              },
            },
          });
        }

        continue;
      }

      await this.disbandRaffle(raffle.id);
      disbanded += 1;
    }

    return {
      processed: candidates.length,
      disbanded,
      markedExpiredThresholdMet,
    };
  }

  private async getPendingUploadsForCreation(
    imageUrls: string[],
    ownerId: string,
    tx: Prisma.TransactionClient,
  ): Promise<Array<{ id: string; urlPath: string }>> {
    if (imageUrls.length === 0) {
      return [];
    }

    const fileNames = imageUrls.map((imageUrl) => {
      const match = imageUrl.match(RAFFLE_UPLOAD_URL_PATTERN);
      if (!match || !match[1]) {
        throw new BadRequestException(
          'imageUrls contains an invalid raffle upload URL.',
        );
      }

      return match[1];
    });

    if (new Set(fileNames).size !== fileNames.length) {
      throw new BadRequestException(
        'imageUrls cannot contain duplicate files.',
      );
    }

    const pendingUploads = await tx.pendingRaffleImageUpload.findMany({
      where: {
        ownerId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        fileName: { in: fileNames },
      },
      select: {
        id: true,
        fileName: true,
        urlPath: true,
      },
    });

    if (pendingUploads.length !== fileNames.length) {
      throw new BadRequestException(
        'imageUrls includes uploads that are missing, expired, or not owned by the requester.',
      );
    }

    const uploadsByFileName = new Map(
      pendingUploads.map((upload) => [upload.fileName, upload] as const),
    );

    return fileNames.map((fileName) => {
      const upload = uploadsByFileName.get(fileName);
      if (!upload) {
        throw new BadRequestException(
          'imageUrls includes uploads that are missing, expired, or not owned by the requester.',
        );
      }

      return {
        id: upload.id,
        urlPath: upload.urlPath,
      };
    });
  }

  private async removeFilesFromDisk(fileNames: string[]): Promise<void> {
    for (const fileName of fileNames) {
      try {
        await unlink(join(RAFFLE_UPLOADS_DIRECTORY, fileName));
      } catch (error) {
        if (!this.isErrnoException(error) || error.code !== 'ENOENT') {
          throw error;
        }
      }
    }
  }

  private isErrnoException(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
  }
}
