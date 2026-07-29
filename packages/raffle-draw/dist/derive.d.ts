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
export declare function deriveWinnerIndex(randomnessHex: string, raffleId: string, ticketCount: number): DerivedWinner;
