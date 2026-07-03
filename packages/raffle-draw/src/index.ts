import {
  DRAW_ALGORITHM_VERSION,
  QUICKNET_PUBLIC_KEY,
} from './constants';
import { deriveWinnerIndex } from './derive';
import { commitRoundFor, timeOfRound } from './drand';
import { assertValidBeaconRound } from './verify';
import type {
  BeaconChainInfo,
  BeaconRound,
  DrawCommitment,
  DrawProof,
} from './types';

export * from './constants';
export * from './types';
export * from './drand';
export * from './derive';
export * from './verify';
export * from './beacon-client';

/**
 * Build the immutable commitment recorded when a raffle becomes resolvable.
 * Pins a future beacon round whose randomness cannot yet exist.
 */
export function buildDrawCommitment(params: {
  info: BeaconChainInfo;
  nowSeconds: number;
  leadSeconds: number;
}): DrawCommitment {
  const round = commitRoundFor(params.info, params.nowSeconds, params.leadSeconds);
  return {
    chainHash: params.info.chainHash,
    scheme: params.info.scheme,
    round,
    committedAt: new Date(params.nowSeconds * 1000).toISOString(),
    availableAt: new Date(timeOfRound(params.info, round) * 1000).toISOString(),
    algorithm: DRAW_ALGORITHM_VERSION,
  };
}

/**
 * Verify a published beacon round and deterministically derive the full,
 * re-verifiable winner proof for a raffle. Throws if the beacon signature or
 * randomness fails verification.
 */
export function revealWinnerProof(params: {
  raffleId: string;
  ticketCount: number;
  round: BeaconRound;
  info: BeaconChainInfo;
}): DrawProof {
  const publicKey = params.info.publicKey || QUICKNET_PUBLIC_KEY;

  assertValidBeaconRound({
    round: params.round.round,
    signature: params.round.signature,
    randomness: params.round.randomness,
    publicKey,
  });

  const derived = deriveWinnerIndex(
    params.round.randomness,
    params.raffleId,
    params.ticketCount,
  );

  return {
    algorithm: DRAW_ALGORITHM_VERSION,
    chainHash: params.info.chainHash,
    scheme: params.info.scheme,
    round: params.round.round,
    signature: params.round.signature,
    randomness: params.round.randomness,
    seed: derived.seed,
    digest: derived.digest,
    winnerIndex: derived.winnerIndex,
    ticketCount: params.ticketCount,
    winnerTicketNumber: -1,
    publicKey,
  };
}
