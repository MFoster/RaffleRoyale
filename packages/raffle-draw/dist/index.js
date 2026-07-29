"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDrawCommitment = buildDrawCommitment;
exports.revealWinnerProof = revealWinnerProof;
const constants_1 = require("./constants");
const derive_1 = require("./derive");
const drand_1 = require("./drand");
const verify_1 = require("./verify");
__exportStar(require("./constants"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./drand"), exports);
__exportStar(require("./derive"), exports);
__exportStar(require("./verify"), exports);
__exportStar(require("./beacon-client"), exports);
/**
 * Build the immutable commitment recorded when a raffle becomes resolvable.
 * Pins a future beacon round whose randomness cannot yet exist.
 */
function buildDrawCommitment(params) {
    const round = (0, drand_1.commitRoundFor)(params.info, params.nowSeconds, params.leadSeconds);
    return {
        chainHash: params.info.chainHash,
        scheme: params.info.scheme,
        round,
        committedAt: new Date(params.nowSeconds * 1000).toISOString(),
        availableAt: new Date((0, drand_1.timeOfRound)(params.info, round) * 1000).toISOString(),
        algorithm: constants_1.DRAW_ALGORITHM_VERSION,
    };
}
/**
 * Verify a published beacon round and deterministically derive the full,
 * re-verifiable winner proof for a raffle. Throws if the beacon signature or
 * randomness fails verification.
 */
function revealWinnerProof(params) {
    const publicKey = params.info.publicKey || constants_1.QUICKNET_PUBLIC_KEY;
    (0, verify_1.assertValidBeaconRound)({
        round: params.round.round,
        signature: params.round.signature,
        randomness: params.round.randomness,
        publicKey,
    });
    const derived = (0, derive_1.deriveWinnerIndex)(params.round.randomness, params.raffleId, params.ticketCount);
    return {
        algorithm: constants_1.DRAW_ALGORITHM_VERSION,
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
