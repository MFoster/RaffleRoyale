import type { BeaconChainInfo } from './types';
/**
 * Encode a drand round number as the 8-byte big-endian buffer that the beacon
 * signs over (unchained scheme).
 */
export declare function roundToBuffer(round: number): Uint8Array;
/**
 * The message a drand validator signs for an unchained round:
 * `sha256(round_be64)`.
 */
export declare function messageForRound(round: number): Uint8Array;
/**
 * Derive the canonical randomness for a round from its signature:
 * `sha256(signature)`. Matches the `randomness` field drand publishes.
 */
export declare function randomnessFromSignature(signatureHex: string): string;
/**
 * The wall-clock time (in seconds) at which a given round is published.
 */
export declare function timeOfRound(info: BeaconChainInfo, round: number): number;
/**
 * The most recent round expected to exist at `unixSeconds`.
 */
export declare function currentRoundAt(info: BeaconChainInfo, unixSeconds: number): number;
/**
 * Pick a future round to commit to, given the present time and a minimum
 * lead time. The returned round is guaranteed to be strictly in the future so
 * its randomness cannot be known at commit time.
 */
export declare function commitRoundFor(info: BeaconChainInfo, nowSeconds: number, leadSeconds: number): number;
