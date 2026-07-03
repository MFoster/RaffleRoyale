import type { BeaconChainInfo, BeaconRound, DrawCommitment, DrawProof } from './types';
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
export declare function buildDrawCommitment(params: {
    info: BeaconChainInfo;
    nowSeconds: number;
    leadSeconds: number;
}): DrawCommitment;
/**
 * Verify a published beacon round and deterministically derive the full,
 * re-verifiable winner proof for a raffle. Throws if the beacon signature or
 * randomness fails verification.
 */
export declare function revealWinnerProof(params: {
    raffleId: string;
    ticketCount: number;
    round: BeaconRound;
    info: BeaconChainInfo;
}): DrawProof;
