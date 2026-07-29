/**
 * Public parameters describing a drand beacon chain. Mirrors the JSON returned
 * by `GET /v2/chains/{chainHash}/info`.
 */
export interface BeaconChainInfo {
    publicKey: string;
    period: number;
    genesisTime: number;
    chainHash: string;
    scheme: string;
    beaconId: string;
}
/**
 * A single published beacon round. The v2 drand API returns only `round` and
 * `signature`; the `randomness` is deterministically derived as
 * `sha256(signature)`.
 */
export interface BeaconRound {
    round: number;
    signature: string;
    randomness: string;
}
/**
 * The immutable commitment recorded the moment a raffle becomes resolvable.
 * It pins a *future* beacon round whose randomness cannot yet be known, which
 * is what makes the eventual draw unpredictable and tamper-evident.
 */
export interface DrawCommitment {
    chainHash: string;
    scheme: string;
    round: number;
    committedAt: string;
    availableAt: string;
    algorithm: string;
}
/**
 * The full, re-verifiable proof of a completed draw. Stored in the
 * WINNER_SELECTED event metadata and surfaced to the public.
 */
export interface DrawProof {
    algorithm: string;
    chainHash: string;
    scheme: string;
    round: number;
    signature: string;
    randomness: string;
    seed: string;
    digest: string;
    winnerIndex: number;
    ticketCount: number;
    winnerTicketNumber: number;
    publicKey: string;
}
