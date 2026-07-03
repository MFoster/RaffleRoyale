import { Injectable } from '@nestjs/common';
import {
  buildDrawCommitment,
  DEFAULT_DRAND_BASE_URL,
  HttpBeaconClient,
  QUICKNET_CHAIN_HASH,
  type BeaconChainInfo,
  type BeaconRound,
  type DrawCommitment,
} from '@raffleroyale/raffle-draw';

const CHAIN_INFO_TTL_MS = 60 * 60 * 1000;
const DEFAULT_DRAW_LEAD_SECONDS = 30;

/**
 * Wraps the drand beacon HTTP client for the API. Chain parameters are public
 * and effectively static, so they are cached. The endpoint, chain, and draw
 * lead time are environment-configurable so the same verification path runs
 * against the public drand network in production and a local signed beacon in
 * development / tests.
 */
@Injectable()
export class BeaconService {
  private readonly client: HttpBeaconClient;
  private readonly leadSeconds: number;
  private cachedInfo: { value: BeaconChainInfo; fetchedAt: number } | null =
    null;

  constructor() {
    this.client = new HttpBeaconClient({
      baseUrl: process.env.DRAND_BASE_URL ?? DEFAULT_DRAND_BASE_URL,
      chainHash: process.env.DRAND_CHAIN_HASH ?? QUICKNET_CHAIN_HASH,
    });
    const parsedLead = Number(process.env.DRAND_DRAW_LEAD_SECONDS);
    this.leadSeconds =
      Number.isFinite(parsedLead) && parsedLead > 0
        ? parsedLead
        : DEFAULT_DRAW_LEAD_SECONDS;
  }

  async getChainInfo(): Promise<BeaconChainInfo> {
    const now = Date.now();
    if (
      this.cachedInfo &&
      now - this.cachedInfo.fetchedAt < CHAIN_INFO_TTL_MS
    ) {
      return this.cachedInfo.value;
    }
    const value = await this.client.getChainInfo();
    this.cachedInfo = { value, fetchedAt: now };
    return value;
  }

  async getRound(round: number): Promise<BeaconRound> {
    return this.client.getRound(round);
  }

  /**
   * Build a commitment to a future beacon round whose randomness cannot yet be
   * known. Computed from the (cached) chain genesis/period — no per-call
   * dependency on the round itself existing.
   */
  async buildCommitment(nowSeconds: number): Promise<DrawCommitment> {
    const info = await this.getChainInfo();
    return buildDrawCommitment({
      info,
      nowSeconds,
      leadSeconds: this.leadSeconds,
    });
  }
}
