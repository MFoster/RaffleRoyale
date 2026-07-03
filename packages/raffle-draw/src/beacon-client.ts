import { DEFAULT_DRAND_BASE_URL, QUICKNET_CHAIN_HASH } from './constants';
import { randomnessFromSignature } from './drand';
import type { BeaconChainInfo, BeaconRound } from './types';

/**
 * Abstraction over a drand HTTP API so the draw pipeline can run against the
 * public network in production and a deterministic local beacon in tests /
 * egress-restricted environments.
 */
export interface BeaconClient {
  getChainInfo(): Promise<BeaconChainInfo>;
  getRound(round: number): Promise<BeaconRound>;
  getLatestRound(): Promise<BeaconRound>;
}

interface RawInfo {
  public_key: string;
  period: number;
  genesis_time: number;
  chain_hash: string;
  scheme: string;
  beacon_id: string;
}

interface RawRound {
  round: number;
  signature: string;
  randomness?: string;
}

export interface HttpBeaconClientOptions {
  baseUrl?: string;
  chainHash?: string;
  fetchTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * BeaconClient backed by the drand v2 HTTP API.
 */
export class HttpBeaconClient implements BeaconClient {
  private readonly baseUrl: string;
  private readonly chainHash: string;
  private readonly fetchTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HttpBeaconClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_DRAND_BASE_URL).replace(/\/+$/, '');
    this.chainHash = options.chainHash ?? QUICKNET_CHAIN_HASH;
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? 8000;
    const resolvedFetch = options.fetchImpl ?? globalThis.fetch;
    if (typeof resolvedFetch !== 'function') {
      throw new Error('A fetch implementation is required for HttpBeaconClient');
    }
    this.fetchImpl = resolvedFetch;
  }

  async getChainInfo(): Promise<BeaconChainInfo> {
    const raw = await this.request<RawInfo>(
      `/v2/chains/${this.chainHash}/info`,
    );
    return {
      publicKey: raw.public_key,
      period: raw.period,
      genesisTime: raw.genesis_time,
      chainHash: raw.chain_hash,
      scheme: raw.scheme,
      beaconId: raw.beacon_id,
    };
  }

  async getRound(round: number): Promise<BeaconRound> {
    const raw = await this.request<RawRound>(
      `/v2/chains/${this.chainHash}/rounds/${round}`,
    );
    return this.toRound(raw);
  }

  async getLatestRound(): Promise<BeaconRound> {
    const raw = await this.request<RawRound>(
      `/v2/chains/${this.chainHash}/rounds/latest`,
    );
    return this.toRound(raw);
  }

  private toRound(raw: RawRound): BeaconRound {
    return {
      round: raw.round,
      signature: raw.signature,
      randomness: raw.randomness ?? randomnessFromSignature(raw.signature),
    };
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: controller.signal,
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(
          `drand request failed (${response.status}) for ${path}`,
        );
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
