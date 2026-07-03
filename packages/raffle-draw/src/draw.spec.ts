import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { HttpBeaconClient } from './beacon-client';
import { deriveWinnerIndex } from './derive';
import {
  currentRoundAt,
  commitRoundFor,
  randomnessFromSignature,
  timeOfRound,
} from './drand';
import { revealWinnerProof } from './index';
import { assertValidBeaconRound, verifyBeaconSignature } from './verify';
import type { BeaconChainInfo } from './types';

const fixturesDir = join(__dirname, '..', 'test', 'fixtures');

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as T;
}

const rawInfo = readFixture<{
  public_key: string;
  period: number;
  genesis_time: number;
  chain_hash: string;
  scheme: string;
  beacon_id: string;
}>('quicknet-info.json');

const info: BeaconChainInfo = {
  publicKey: rawInfo.public_key,
  period: rawInfo.period,
  genesisTime: rawInfo.genesis_time,
  chainHash: rawInfo.chain_hash,
  scheme: rawInfo.scheme,
  beaconId: rawInfo.beacon_id,
};

const round = readFixture<{ round: number; signature: string }>(
  'quicknet-round.json',
);
const randomness = randomnessFromSignature(round.signature);

test('verifies a real drand quicknet beacon signature', () => {
  assert.equal(
    verifyBeaconSignature({
      round: round.round,
      signature: round.signature,
      publicKey: info.publicKey,
    }),
    true,
  );
});

test('rejects a tampered signature', () => {
  const tampered = round.signature.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  assert.equal(
    verifyBeaconSignature({
      round: round.round,
      signature: tampered,
      publicKey: info.publicKey,
    }),
    false,
  );
});

test('rejects a signature checked against the wrong round', () => {
  assert.equal(
    verifyBeaconSignature({
      round: round.round + 1,
      signature: round.signature,
      publicKey: info.publicKey,
    }),
    false,
  );
});

test('assertValidBeaconRound passes for the real round', () => {
  assert.doesNotThrow(() =>
    assertValidBeaconRound({
      round: round.round,
      signature: round.signature,
      randomness,
      publicKey: info.publicKey,
    }),
  );
});

test('derivation is deterministic and in range', () => {
  const a = deriveWinnerIndex(randomness, 'raffle-123', 50);
  const b = deriveWinnerIndex(randomness, 'raffle-123', 50);
  assert.deepEqual(a, b);
  assert.ok(a.winnerIndex >= 0 && a.winnerIndex < 50);
});

test('derivation changes with raffle id', () => {
  const a = deriveWinnerIndex(randomness, 'raffle-A', 100);
  const b = deriveWinnerIndex(randomness, 'raffle-B', 100);
  assert.notEqual(a.winnerIndex, b.winnerIndex);
});

test('derivation is uniform-ish across the ticket space', () => {
  const counts = new Array(10).fill(0);
  for (let i = 0; i < 2000; i++) {
    const { winnerIndex } = deriveWinnerIndex(
      randomnessFromSignature(round.signature),
      `raffle-${i}`,
      10,
    );
    counts[winnerIndex] += 1;
  }
  for (const c of counts) {
    assert.ok(c > 120, `bucket too small: ${c}`);
  }
});

test('revealWinnerProof returns a verifiable proof', () => {
  const proof = revealWinnerProof({
    raffleId: 'raffle-xyz',
    ticketCount: 25,
    round: { round: round.round, signature: round.signature, randomness },
    info,
  });
  assert.equal(proof.round, round.round);
  assert.equal(proof.randomness, randomness);
  assert.ok(proof.winnerIndex >= 0 && proof.winnerIndex < 25);
});

test('round math is internally consistent', () => {
  const r = commitRoundFor(info, info.genesisTime + 100, 30);
  assert.ok(r > currentRoundAt(info, info.genesisTime + 100));
  assert.equal(
    timeOfRound(info, r),
    info.genesisTime + (r - 1) * info.period,
  );
});

test('HttpBeaconClient parses a mocked round response', async () => {
  const client = new HttpBeaconClient({
    fetchImpl: (async () =>
      new Response(JSON.stringify(round), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch,
  });
  const fetched = await client.getRound(round.round);
  assert.equal(fetched.randomness, randomness);
});
