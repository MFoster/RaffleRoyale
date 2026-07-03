"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundToBuffer = roundToBuffer;
exports.messageForRound = messageForRound;
exports.randomnessFromSignature = randomnessFromSignature;
exports.timeOfRound = timeOfRound;
exports.currentRoundAt = currentRoundAt;
exports.commitRoundFor = commitRoundFor;
const sha256_1 = require("@noble/hashes/sha256");
const utils_1 = require("@noble/hashes/utils");
/**
 * Encode a drand round number as the 8-byte big-endian buffer that the beacon
 * signs over (unchained scheme).
 */
function roundToBuffer(round) {
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
function messageForRound(round) {
    return (0, sha256_1.sha256)(roundToBuffer(round));
}
/**
 * Derive the canonical randomness for a round from its signature:
 * `sha256(signature)`. Matches the `randomness` field drand publishes.
 */
function randomnessFromSignature(signatureHex) {
    return (0, utils_1.bytesToHex)((0, sha256_1.sha256)((0, utils_1.hexToBytes)(signatureHex)));
}
/**
 * The wall-clock time (in seconds) at which a given round is published.
 */
function timeOfRound(info, round) {
    return info.genesisTime + (round - 1) * info.period;
}
/**
 * The most recent round expected to exist at `unixSeconds`.
 */
function currentRoundAt(info, unixSeconds) {
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
function commitRoundFor(info, nowSeconds, leadSeconds) {
    const leadRounds = Math.max(1, Math.ceil(leadSeconds / info.period));
    return currentRoundAt(info, nowSeconds) + leadRounds;
}
