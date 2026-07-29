import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type { BeaconChainInfo } from './types';

/**
 * Encode a drand round number as the 8-byte big-endian buffer that the beacon
 * signs over (unchained scheme).
 */
export function roundToBuffer(round: number): Uint8Array {
  if (!Number.isInteger(round) || round < 1) {
    throw new Error(`Invalid drand round: ${round}`);
  }
  const buffer = new Uint8Array(8);
  const view = new DataView(buffer.buffer);
  view.setBigUint64(0, BigInt(round), false);
  return buffer;
}

/**
 * The message a drand validator signs for an unchained round:
 * `sha256(round_be64)`.
 */
export function messageForRound(round: number): Uint8Array {
  return sha256(roundToBuffer(round));
}

/**
 * Derive the canonical randomness for a round from its signature:
 * `sha256(signature)`. Matches the `randomness` field drand publishes.
 */
export function randomnessFromSignature(signatureHex: string): string {
  return bytesToHex(sha256(hexToBytes(signatureHex)));
}

/**
 * The wall-clock time (in seconds) at which a given round is published.
 */
export function timeOfRound(info: BeaconChainInfo, round: number): number {
  return info.genesisTime + (round - 1) * info.period;
}

/**
 * The most recent round expected to exist at `unixSeconds`.
 */
export function currentRoundAt(info: BeaconChainInfo, unixSeconds: number): number {
  if (unixSeconds < info.genesisTime) {
    return 1;
  }
  return Math.floor((unixSeconds - info.genesisTime) / info.period) + 1;
}

/**
 * Pick a future round to commit to, given the present time and a minimum
 * lead time. The returned round is guaranteed to be strictly in the future so
 * its randomness cannot be known at commit time.
 */
export function commitRoundFor(
  info: BeaconChainInfo,
  nowSeconds: number,
  leadSeconds: number,
): number {
  const leadRounds = Math.max(1, Math.ceil(leadSeconds / info.period));
  return currentRoundAt(info, nowSeconds) + leadRounds;
}
