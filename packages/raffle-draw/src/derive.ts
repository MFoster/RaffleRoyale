import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';

function uint64BE(value: number): Uint8Array {
  const buffer = new Uint8Array(8);
  new DataView(buffer.buffer).setBigUint64(0, BigInt(value), false);
  return buffer;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (const byte of bytes) {
    result = (result << 8n) | BigInt(byte);
  }
  return result;
}

const TWO_POW_256 = 1n << 256n;

export interface DerivedWinner {
  seed: string;
  digest: string;
  winnerIndex: number;
}

/**
 * Deterministically derive the winning ticket index from a beacon's randomness.
 *
 * Steps (all SHA-256, all reproducible by anyone):
 *   1. seed   = sha256(randomness ‖ raffleId)
 *   2. digest = sha256(seed ‖ raffleId ‖ ticketCount_be64)
 *   3. index  = bigint(digest) mod ticketCount
 *
 * Uniform selection is guaranteed via rejection sampling: if a digest falls in
 * the small non-uniform tail above the largest exact multiple of ticketCount,
 * it is re-hashed (`sha256(digest)`) until it lands in range. This removes any
 * modulo bias so every ticket has exactly equal odds.
 */
export function deriveWinnerIndex(
  randomnessHex: string,
  raffleId: string,
  ticketCount: number,
): DerivedWinner {
  if (!Number.isInteger(ticketCount) || ticketCount <= 0) {
    throw new Error(`ticketCount must be a positive integer, got ${ticketCount}`);
  }

  const raffleIdBytes = utf8ToBytes(raffleId);
  const seedBytes = sha256(concatBytes(hexToBytes(randomnessHex), raffleIdBytes));

  const countBig = BigInt(ticketCount);
  const limit = TWO_POW_256 - (TWO_POW_256 % countBig);

  let digestBytes = sha256(
    concatBytes(seedBytes, raffleIdBytes, uint64BE(ticketCount)),
  );
  let digestValue = bytesToBigInt(digestBytes);
  while (digestValue >= limit) {
    digestBytes = sha256(digestBytes);
    digestValue = bytesToBigInt(digestBytes);
  }

  return {
    seed: bytesToHex(seedBytes),
    digest: bytesToHex(digestBytes),
    winnerIndex: Number(digestValue % countBig),
  };
}
