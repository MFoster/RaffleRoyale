/**
 * Local signed drand-compatible beacon for development / egress-restricted
 * environments.
 *
 * Dev containers (api, jobs) sit behind a transparent egress proxy and cannot
 * reach the public drand network, but the raffle draw pipeline must still run
 * the *real* verification path (BLS signature verify + randomness derivation).
 *
 * This service signs rounds with a deterministic development BLS key using the
 * exact same scheme as drand quicknet (`bls-unchained-g1-rfc9380`: G1
 * signatures, G2 public keys, message = sha256(round as big-endian uint64)).
 * The api and jobs services point `DRAND_BASE_URL` at this server and
 * `DRAND_CHAIN_HASH` at the dev chain hash so the identical
 * `HttpBeaconClient` -> `assertValidBeaconRound` -> `deriveWinnerIndex` flow
 * executes everywhere. It is NEVER used in production.
 */
import { createServer } from 'node:http';
import { bls12_381 } from '@noble/curves/bls12-381';
import { sha256 } from '@noble/hashes/sha256';
import { messageForRound } from '../src/drand';
import { QUICKNET_SCHEME } from '../src/constants';

const PORT = Number(process.env.MOCK_BEACON_PORT ?? 8088);
const SEED = process.env.MOCK_BEACON_SEED ?? 'raffleroyale-dev-beacon-v1';
const CHAIN_HASH =
  process.env.DRAND_CHAIN_HASH ??
  'b8525930172629e30477e25b56ac4c4a75850cd0b6c150a97d216ec64acb8df6';
const PERIOD = Number(process.env.MOCK_BEACON_PERIOD ?? 3);
const GENESIS_TIME = Number(process.env.MOCK_BEACON_GENESIS_TIME ?? 1700000000);
const BEACON_ID = process.env.MOCK_BEACON_ID ?? 'raffleroyale-dev';

const secretKey = sha256(new TextEncoder().encode(SEED));
const publicKey = bls12_381.getPublicKeyForShortSignatures(secretKey);
const publicKeyHex = Buffer.from(publicKey).toString('hex');

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function currentRound(): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (nowSeconds <= GENESIS_TIME) {
    return 1;
  }
  return Math.floor((nowSeconds - GENESIS_TIME) / PERIOD) + 1;
}

function signRound(round: number): { round: number; signature: string } {
  const message = messageForRound(round);
  const signature = bls12_381.signShortSignature(message, secretKey);
  return { round, signature: toHex(signature) };
}

function sendJson(
  res: import('node:http').ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const infoPayload = {
  public_key: publicKeyHex,
  period: PERIOD,
  genesis_time: GENESIS_TIME,
  hash: CHAIN_HASH,
  chain_hash: CHAIN_HASH,
  scheme: QUICKNET_SCHEME,
  beacon_id: BEACON_ID,
};

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  const path = url.split('?')[0];

  if (path === '/health' || path === '/') {
    sendJson(res, 200, { status: 'ok', chainHash: CHAIN_HASH });
    return;
  }

  const infoMatch = /^\/v2\/chains\/([^/]+)\/info$/.exec(path);
  if (infoMatch) {
    sendJson(res, 200, infoPayload);
    return;
  }

  const roundMatch = /^\/v2\/chains\/([^/]+)\/rounds\/([^/]+)$/.exec(path);
  if (roundMatch) {
    const roundParam = roundMatch[2];
    const round = roundParam === 'latest' ? currentRound() : Number(roundParam);
    if (!Number.isInteger(round) || round < 1) {
      sendJson(res, 400, { error: 'invalid round' });
      return;
    }
    sendJson(res, 200, signRound(round));
    return;
  }

  sendJson(res, 404, { error: 'not found', path });
});

server.listen(PORT, () => {
  console.log(
    `[mock-beacon] listening on :${PORT} chainHash=${CHAIN_HASH} genesis=${GENESIS_TIME} period=${PERIOD}s scheme=${QUICKNET_SCHEME}`,
  );
  console.log(`[mock-beacon] public key ${publicKeyHex}`);
});
