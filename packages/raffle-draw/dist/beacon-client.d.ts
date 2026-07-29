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
export interface HttpBeaconClientOptions {
    baseUrl?: string;
    chainHash?: string;
    fetchTimeoutMs?: number;
    fetchImpl?: typeof fetch;
}
/**
 * BeaconClient backed by the drand v2 HTTP API.
 */
export declare class HttpBeaconClient implements BeaconClient {
    private readonly baseUrl;
    private readonly chainHash;
    private readonly fetchTimeoutMs;
    private readonly fetchImpl;
    constructor(options?: HttpBeaconClientOptions);
    getChainInfo(): Promise<BeaconChainInfo>;
    getRound(round: number): Promise<BeaconRound>;
    getLatestRound(): Promise<BeaconRound>;
    private toRound;
    private request;
}
