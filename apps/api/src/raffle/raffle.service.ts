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
import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { PurchaseTicketsDto } from './dto/purchase-tickets.dto';

export const MAX_RAFFLE_IMAGE_UPLOADS = 3;
export const MAX_RAFFLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const RAFFLE_UPLOADS_DIRECTORY = join(process.cwd(), 'uploads', 'raffles');
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

type ResolveWinnerResult = {
  raffleId: string;
  winnerTicketId: string;
  winnerTicketNumber: number;
  ticketCount: number;
  randomIndex: number;
  raffleStatus: RaffleStatus;
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

export type RaffleDetail = Omit<RaffleDetailBase, 'events'> & {
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

mkdirSync(RAFFLE_UPLOADS_DIRECTORY, { recursive: true });

@Injectable()
export class RaffleService {
  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<Raffle> {
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

        return raffle;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async findAll(): Promise<Raffle[]> {
    return this.prisma.raffle.findMany({
      orderBy: { createdAt: 'desc' },
    });
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
    return {
      ...raffle,
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

  async resolveWinner(raffleId: string): Promise<ResolveWinnerResult> {
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

        const existingWinnerEvent = await tx.raffleEvent.findFirst({
          where: {
            raffleId,
            eventType: 'WINNER_SELECTED',
          },
          select: {
            id: true,
          },
        });

        if (existingWinnerEvent) {
          throw new ConflictException('Winner has already been resolved');
        }

        if (raffle.status === RaffleStatus.COMPLETED) {
          throw new ConflictException('Winner has already been resolved');
        }

        const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
        const isExpired = raffle.status === RaffleStatus.EXPIRED;

        if (!isSoldOut && !isExpired) {
          throw new ConflictException(
            'Only SOLD_OUT or eligible EXPIRED raffles can resolve a winner',
          );
        }

        if (isExpired) {
          const sellThroughPercent =
            raffle.totalTickets === 0
              ? 0
              : (raffle.ticketsSold / raffle.totalTickets) * 100;
          const meetsMinSellThrough =
            raffle.minSellThrough !== null &&
            sellThroughPercent >= raffle.minSellThrough;

          if (!meetsMinSellThrough) {
            throw new ConflictException(
              'Expired raffle did not meet minimum sell-through',
            );
          }
        }

        const ticketCount = await tx.ticket.count({ where: { raffleId } });
        if (ticketCount <= 0) {
          throw new ConflictException('Cannot resolve winner with no tickets');
        }

        const randomIndex = randomInt(0, ticketCount);
        const winnerTicket = await tx.ticket.findFirst({
          where: { raffleId },
          orderBy: { ticketNumber: 'asc' },
          skip: randomIndex,
        });

        if (!winnerTicket) {
          throw new NotFoundException('Winner ticket could not be determined');
        }

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
              randomIndex,
              algorithm: 'crypto.randomInt-v1',
            },
          },
        });

        return {
          raffleId,
          winnerTicketId: winnerTicket.id,
          winnerTicketNumber: winnerTicket.ticketNumber,
          ticketCount,
          randomIndex,
          raffleStatus: RaffleStatus.COMPLETED,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
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
