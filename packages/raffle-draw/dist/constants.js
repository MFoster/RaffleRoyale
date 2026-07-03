"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRAW_ALGORITHM_VERSION = exports.DEFAULT_DRAND_BASE_URL = exports.QUICKNET_BEACON_ID = exports.QUICKNET_SCHEME = exports.QUICKNET_PERIOD_SECONDS = exports.QUICKNET_GENESIS_TIME = exports.QUICKNET_PUBLIC_KEY = exports.QUICKNET_CHAIN_HASH = void 0;
/**
 * Default drand "quicknet" beacon parameters.
 *
 * quicknet is an unchained, low-latency randomness beacon. Each round is a
 * BLS signature (min-signature variant: signatures live on G1, public keys on
 * G2) over the round number, using scheme `bls-unchained-g1-rfc9380`.
 *
 * These values are public and verifiable at:
 *   https://api.drand.sh/v2/chains/<chainHash>/info
 */
exports.QUICKNET_CHAIN_HASH = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';
exports.QUICKNET_PUBLIC_KEY = '83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a';
exports.QUICKNET_GENESIS_TIME = 1692803367;
exports.QUICKNET_PERIOD_SECONDS = 3;
exports.QUICKNET_SCHEME = 'bls-unchained-g1-rfc9380';
exports.QUICKNET_BEACON_ID = 'quicknet';
exports.DEFAULT_DRAND_BASE_URL = 'https://api.drand.sh';
/**
 * Versioned identifier for the deterministic winner-selection algorithm.
 * Recorded alongside every draw so historical raffles remain reproducible even
 * if the derivation ever changes in a future version.
 */
exports.DRAW_ALGORITHM_VERSION = 'drand-quicknet-commit-reveal-v1';
