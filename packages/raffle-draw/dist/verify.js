"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyBeaconSignature = verifyBeaconSignature;
exports.assertValidBeaconRound = assertValidBeaconRound;
const bls12_381_1 = require("@noble/curves/bls12-381");
const utils_1 = require("@noble/hashes/utils");
const drand_1 = require("./drand");
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
function verifyBeaconSignature(params) {
    const message = (0, drand_1.messageForRound)(params.round);
    try {
        // quicknet is min-signature (sigs on G1). `verifyShortSignature` hashes the
        // message to G1 with the RFC 9380 DST `BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_`
        // — exactly the drand `bls-unchained-g1-rfc9380` scheme.
        return bls12_381_1.bls12_381.verifyShortSignature((0, utils_1.hexToBytes)(params.signature), message, (0, utils_1.hexToBytes)(params.publicKey));
    }
    catch {
        return false;
    }
}
/**
 * Verify a beacon signature AND confirm the published randomness matches
 * `sha256(signature)`. Throws when either check fails.
 */
function assertValidBeaconRound(params) {
    if (!verifyBeaconSignature({
        round: params.round,
        signature: params.signature,
        publicKey: params.publicKey,
    })) {
        throw new Error(`drand signature verification failed for round ${params.round}`);
    }
    const derived = (0, drand_1.randomnessFromSignature)(params.signature);
    if (derived !== params.randomness.toLowerCase()) {
        throw new Error(`drand randomness mismatch for round ${params.round}: expected ${derived}`);
    }
}
