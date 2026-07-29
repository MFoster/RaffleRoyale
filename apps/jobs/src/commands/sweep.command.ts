import {
  buildDrawCommitment,
  DEFAULT_DRAND_BASE_URL,
  HttpBeaconClient,
  QUICKNET_CHAIN_HASH,
  revealWinnerProof,
  type BeaconChainInfo,
} from '@raffleroyale/raffle-draw';
import { Prisma, type PrismaClient, RaffleStatus } from '@prisma/client';
import type { JobCommand } from './types';

type SweepSummary = {
  scanned: number;
  committed: number;
  revealed: number;
  skippedNoTickets: number;
  skippedNotEligible: number;
  skippedAlreadyResolved: number;
  skippedPendingDraw: number;
  errored: number;
};

const DEFAULT_DRAW_LEAD_SECONDS = 30;

function resolveLeadSeconds(): number {
  const parsed = Number(process.env.DRAND_DRAW_LEAD_SECONDS);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_DRAW_LEAD_SECONDS;
}

function isExpiredEligible(raffle: {
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

type AdvanceResult =
  | { action: 'committed'; raffleId: string; beaconRound: number }
  | {
      action: 'revealed';
      raffleId: string;
      winnerTicketNumber: number;
      beaconRound: number;
    }
  | { action: 'skip-no-tickets' }
  | { action: 'skip-not-eligible' }
  | { action: 'skip-already-resolved' }
  | { action: 'skip-pending-draw' };

/**
 * Advance raffle draws using the drand commit-reveal protocol. This mirrors the
 * API's two-phase flow so background sweeps and on-demand resolution share the
 * exact same verifiable algorithm (see @raffleroyale/raffle-draw):
 *
 *  - Phase 1 (commit): a resolvable raffle pins a future drand round and moves
 *    to PENDING_DRAW with a DRAW_COMMITTED audit event.
 *  - Phase 2 (reveal): once the committed round is published, its BLS signature
 *    is verified, the winner is deterministically derived, and a WINNER_SELECTED
 *    event records the full re-verifiable proof.
 */
export const sweepCommand: JobCommand = {
  name: 'sweep',
  description:
    'Advance raffle draws via the drand commit-reveal protocol (commit pending raffles, reveal verified winners).',
  async run({ prisma }) {
    const beacon = new HttpBeaconClient({
      baseUrl: process.env.DRAND_BASE_URL ?? DEFAULT_DRAND_BASE_URL,
      chainHash: process.env.DRAND_CHAIN_HASH ?? QUICKNET_CHAIN_HASH,
    });
    const leadSeconds = resolveLeadSeconds();

    let cachedInfo: BeaconChainInfo | null = null;
    const getChainInfo = async (): Promise<BeaconChainInfo> => {
      if (!cachedInfo) {
        cachedInfo = await beacon.getChainInfo();
      }
      return cachedInfo;
    };

    const candidates = await prisma.raffle.findMany({
      where: {
        status: {
          in: [
            RaffleStatus.SOLD_OUT,
            RaffleStatus.EXPIRED,
            RaffleStatus.PENDING_DRAW,
          ],
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const summary: SweepSummary = {
      scanned: candidates.length,
      committed: 0,
      revealed: 0,
      skippedNoTickets: 0,
      skippedNotEligible: 0,
      skippedAlreadyResolved: 0,
      skippedPendingDraw: 0,
      errored: 0,
    };

    for (const candidate of candidates) {
      try {
        const action = await advanceRaffle({
          prisma,
          beacon,
          getChainInfo,
          leadSeconds,
          raffleId: candidate.id,
        });

        switch (action.action) {
          case 'committed':
            summary.committed += 1;
            console.log(
              `Committed draw for raffle ${action.raffleId} to beacon round ${String(action.beaconRound)}.`,
            );
            break;
          case 'revealed':
            summary.revealed += 1;
            console.log(
              `Revealed winner for raffle ${action.raffleId} (ticket #${String(action.winnerTicketNumber)}, beacon round ${String(action.beaconRound)}).`,
            );
            break;
          case 'skip-no-tickets':
            summary.skippedNoTickets += 1;
            break;
          case 'skip-already-resolved':
            summary.skippedAlreadyResolved += 1;
            break;
          case 'skip-pending-draw':
            summary.skippedPendingDraw += 1;
            break;
          default:
            summary.skippedNotEligible += 1;
        }
      } catch (error) {
        summary.errored += 1;
        console.error(
          `Failed to advance draw for raffle ${candidate.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    console.table([summary]);
  },
};

async function advanceRaffle(params: {
  prisma: PrismaClient;
  beacon: HttpBeaconClient;
  getChainInfo: () => Promise<BeaconChainInfo>;
  leadSeconds: number;
  raffleId: string;
}): Promise<AdvanceResult> {
  const { prisma, beacon, getChainInfo, leadSeconds, raffleId } = params;

  const raffle = await prisma.raffle.findUnique({
    where: { id: raffleId },
    select: {
      id: true,
      status: true,
      totalTickets: true,
      ticketsSold: true,
      minSellThrough: true,
      drawBeaconRound: true,
      drawAvailableAt: true,
    },
  });
  if (!raffle) {
    return { action: 'skip-not-eligible' };
  }

  const existingWinner = await prisma.raffleEvent.findFirst({
    where: { raffleId, eventType: 'WINNER_SELECTED' },
    select: { id: true },
  });
  if (existingWinner || raffle.status === RaffleStatus.COMPLETED) {
    return { action: 'skip-already-resolved' };
  }

  if (raffle.status === RaffleStatus.PENDING_DRAW) {
    if (
      raffle.drawBeaconRound === null ||
      raffle.drawAvailableAt === null ||
      raffle.drawAvailableAt.getTime() > Date.now()
    ) {
      return { action: 'skip-pending-draw' };
    }
    return revealDraw({
      prisma,
      beacon,
      getChainInfo,
      raffleId,
      beaconRound: Number(raffle.drawBeaconRound),
    });
  }

  const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
  if (!isSoldOut && !isExpiredEligible(raffle)) {
    return { action: 'skip-not-eligible' };
  }

  const ticketCount = await prisma.ticket.count({ where: { raffleId } });
  if (ticketCount <= 0) {
    return { action: 'skip-no-tickets' };
  }

  return commitDraw({ prisma, getChainInfo, leadSeconds, raffleId });
}

async function commitDraw(params: {
  prisma: PrismaClient;
  getChainInfo: () => Promise<BeaconChainInfo>;
  leadSeconds: number;
  raffleId: string;
}): Promise<AdvanceResult> {
  const { prisma, getChainInfo, leadSeconds, raffleId } = params;
  const info = await getChainInfo();
  const commitment = buildDrawCommitment({
    info,
    nowSeconds: Math.floor(Date.now() / 1000),
    leadSeconds,
  });

  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
      );
      if (lockRows.length === 0) {
        return { action: 'skip-not-eligible' as const };
      }

      const raffle = await tx.raffle.findUnique({
        where: { id: raffleId },
        select: {
          id: true,
          status: true,
          totalTickets: true,
          ticketsSold: true,
          minSellThrough: true,
          drawBeaconRound: true,
        },
      });
      if (!raffle) {
        return { action: 'skip-not-eligible' as const };
      }

      if (
        raffle.status === RaffleStatus.PENDING_DRAW &&
        raffle.drawBeaconRound !== null
      ) {
        return { action: 'skip-pending-draw' as const };
      }

      const isSoldOut = raffle.status === RaffleStatus.SOLD_OUT;
      if (!isSoldOut && !isExpiredEligible(raffle)) {
        return { action: 'skip-not-eligible' as const };
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
            source: 'jobs-sweep-v1',
          },
        },
      });

      return {
        action: 'committed' as const,
        raffleId,
        beaconRound: commitment.round,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function revealDraw(params: {
  prisma: PrismaClient;
  beacon: HttpBeaconClient;
  getChainInfo: () => Promise<BeaconChainInfo>;
  raffleId: string;
  beaconRound: number;
}): Promise<AdvanceResult> {
  const { prisma, beacon, getChainInfo, raffleId, beaconRound } = params;

  const info = await getChainInfo();
  const round = await beacon.getRound(beaconRound);
  const ticketCount = await prisma.ticket.count({ where: { raffleId } });
  if (ticketCount <= 0) {
    return { action: 'skip-no-tickets' };
  }

  // Verifies the BLS signature + randomness and derives the winner index.
  const proof = revealWinnerProof({ raffleId, ticketCount, round, info });

  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM raffles WHERE id = ${raffleId} FOR UPDATE`,
      );
      if (lockRows.length === 0) {
        return { action: 'skip-not-eligible' as const };
      }

      const locked = await tx.raffle.findUnique({
        where: { id: raffleId },
        select: { id: true, status: true },
      });
      if (!locked) {
        return { action: 'skip-not-eligible' as const };
      }

      const existingWinner = await tx.raffleEvent.findFirst({
        where: { raffleId, eventType: 'WINNER_SELECTED' },
        select: { id: true },
      });
      if (existingWinner || locked.status === RaffleStatus.COMPLETED) {
        return { action: 'skip-already-resolved' as const };
      }
      if (locked.status !== RaffleStatus.PENDING_DRAW) {
        return { action: 'skip-not-eligible' as const };
      }

      const lockedCount = await tx.ticket.count({ where: { raffleId } });
      if (lockedCount !== ticketCount) {
        return { action: 'skip-not-eligible' as const };
      }

      const winnerTicket = await tx.ticket.findFirst({
        where: { raffleId },
        orderBy: { ticketNumber: 'asc' },
        skip: proof.winnerIndex,
      });
      if (!winnerTicket) {
        return { action: 'skip-no-tickets' as const };
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
            winnerIndex: proof.winnerIndex,
            algorithm: proof.algorithm,
            beacon: {
              chainHash: proof.chainHash,
              scheme: proof.scheme,
              round: proof.round,
              randomness: proof.randomness,
              signature: proof.signature,
              publicKey: proof.publicKey,
            },
            derivation: {
              seed: proof.seed,
              digest: proof.digest,
            },
            source: 'jobs-sweep-v1',
          },
        },
      });

      return {
        action: 'revealed' as const,
        raffleId,
        winnerTicketNumber: winnerTicket.ticketNumber,
        beaconRound: proof.round,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}