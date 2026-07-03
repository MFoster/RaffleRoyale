/**
 * Verify a drand "quicknet" (bls-unchained-g1-rfc9380) beacon signature.
 *
 * quicknet is the min-signature variant: the signature is a G1 point and the
 * public key is a G2 point. The signed message is `sha256(round_be64)`, hashed
 * to the G1 curve with the RFC 9380 DST.
 *
 * @returns true when the signature is a valid beacon for `round` under
 *   `publicKeyHex`.
 */
export declare function verifyBeaconSignature(params: {
    round: number;
    signature: string;
    publicKey: string;
}): boolean;
/**
 * Verify a beacon signature AND confirm the published randomness matches
 * `sha256(signature)`. Throws when either check fails.
 */
export declare function assertValidBeaconRound(params: {
    round: number;
    signature: string;
    randomness: string;
    publicKey: string;
}): void;
