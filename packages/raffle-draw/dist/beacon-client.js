"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpBeaconClient = void 0;
const constants_1 = require("./constants");
const drand_1 = require("./drand");
/**
 * BeaconClient backed by the drand v2 HTTP API.
 */
class HttpBeaconClient {
    constructor(options = {}) {
        this.baseUrl = (options.baseUrl ?? constants_1.DEFAULT_DRAND_BASE_URL).replace(/\/+$/, '');
        this.chainHash = options.chainHash ?? constants_1.QUICKNET_CHAIN_HASH;
        this.fetchTimeoutMs = options.fetchTimeoutMs ?? 8000;
        const resolvedFetch = options.fetchImpl ?? globalThis.fetch;
        if (typeof resolvedFetch !== 'function') {
            throw new Error('A fetch implementation is required for HttpBeaconClient');
        }
        this.fetchImpl = resolvedFetch;
    }
    async getChainInfo() {
        const raw = await this.request(`/v2/chains/${this.chainHash}/info`);
        return {
            publicKey: raw.public_key,
            period: raw.period,
            genesisTime: raw.genesis_time,
            chainHash: raw.chain_hash,
            scheme: raw.scheme,
            beaconId: raw.beacon_id,
        };
    }
    async getRound(round) {
        const raw = await this.request(`/v2/chains/${this.chainHash}/rounds/${round}`);
        return this.toRound(raw);
    }
    async getLatestRound() {
        const raw = await this.request(`/v2/chains/${this.chainHash}/rounds/latest`);
        return this.toRound(raw);
    }
    toRound(raw) {
        return {
            round: raw.round,
            signature: raw.signature,
            randomness: raw.randomness ?? (0, drand_1.randomnessFromSignature)(raw.signature),
        };
    }
    async request(path) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
        try {
            const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
                signal: controller.signal,
                headers: { accept: 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`drand request failed (${response.status}) for ${path}`);
            }
            return (await response.json());
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.HttpBeaconClient = HttpBeaconClient;
