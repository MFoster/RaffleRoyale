'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export type DrawProofView = {
  raffleId: string;
  algorithm: string;
  ticketCount: number;
  winnerIndex: number;
  winnerTicketNumber: number;
  beacon: {
    chainHash: string;
    scheme: string;
    round: number;
    randomness: string;
    signature: string;
    publicKey: string;
  };
  derivation: {
    seed: string;
    digest: string;
  };
};

const QUICKNET_CHAIN_HASH =
  '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971';

const TWO_POW_256 = BigInt(1) << BigInt(256);

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function uint64BE(value: number): Uint8Array {
  const buffer = new Uint8Array(8);
  new DataView(buffer.buffer).setBigUint64(0, BigInt(value), false);
  return buffer;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = BigInt(0);
  for (const byte of bytes) {
    result = (result << BigInt(8)) | BigInt(byte);
  }
  return result;
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return new Uint8Array(digest);
}

type RecomputeState =
  | { status: 'pending' }
  | { status: 'unsupported' }
  | {
      status: 'done';
      randomnessMatches: boolean;
      winnerMatches: boolean;
      recomputedIndex: number;
      recomputedRandomness: string;
    };

/**
 * Recomputes the winner entirely in the visitor's browser from the published
 * drand beacon signature, mirroring the server / @raffleroyale/raffle-draw
 * derivation. This proves the result was not hand-picked: anyone can verify it.
 */
async function recompute(proof: DrawProofView): Promise<RecomputeState> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return { status: 'unsupported' };
  }

  const signatureBytes = hexToBytes(proof.beacon.signature);
  const recomputedRandomnessBytes = await sha256(signatureBytes);
  const recomputedRandomness = bytesToHex(recomputedRandomnessBytes);
  const randomnessMatches =
    recomputedRandomness === proof.beacon.randomness.toLowerCase();

  const raffleIdBytes = new TextEncoder().encode(proof.raffleId);
  const seedBytes = await sha256(
    concatBytes(hexToBytes(proof.beacon.randomness), raffleIdBytes),
  );

  const countBig = BigInt(proof.ticketCount);
  const remainder = TWO_POW_256 % countBig;
  const limit = TWO_POW_256 - remainder;

  let digestBytes = await sha256(
    concatBytes(seedBytes, raffleIdBytes, uint64BE(proof.ticketCount)),
  );
  let digestValue = bytesToBigInt(digestBytes);
  while (digestValue >= limit) {
    digestBytes = await sha256(digestBytes);
    digestValue = bytesToBigInt(digestBytes);
  }

  const recomputedIndex = Number(digestValue % countBig);

  return {
    status: 'done',
    randomnessMatches,
    winnerMatches: recomputedIndex === proof.winnerIndex,
    recomputedIndex,
    recomputedRandomness,
  };
}

function ProofRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

export default function WinnerDrawProof({ proof }: { proof: DrawProofView }) {
  const [state, setState] = useState<RecomputeState>({ status: 'pending' });

  useEffect(() => {
    let active = true;
    recompute(proof)
      .then((next) => {
        if (active) {
          setState(next);
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'unsupported' });
        }
      });
    return () => {
      active = false;
    };
  }, [proof]);

  const verified =
    state.status === 'done' && state.randomnessMatches && state.winnerMatches;
  const isQuicknet = proof.beacon.chainHash === QUICKNET_CHAIN_HASH;
  const drandUrl = isQuicknet
    ? `https://api.drand.sh/v2/chains/${proof.beacon.chainHash}/rounds/${String(proof.beacon.round)}`
    : null;

  const badgeColor = verified ? '#1B7A3D' : '#8C6A00';
  const badgeLabel =
    state.status === 'pending'
      ? 'Verifying in your browser…'
      : state.status === 'unsupported'
        ? 'Open in a modern browser to auto-verify'
        : verified
          ? 'Verified in your browser'
          : 'Verification mismatch';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: { xs: 2.5, md: 3 },
        borderColor: alpha('#5B3DF5', 0.24),
        bgcolor: alpha('#FFFFFF', 0.7),
      }}
    >
      <Stack spacing={2.5}>
        <Stack spacing={1}>
          <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.08em' }}>
            Provably fair draw
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            How this winner was drawn
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The winner was chosen using public, independent randomness from the{' '}
            <Box component="span" sx={{ fontWeight: 700 }}>
              drand
            </Box>{' '}
            randomness beacon. We committed to a future beacon round before it
            existed, then derived the winner from its signature with SHA-256. No
            one — not even us — could predict or influence the outcome.
          </Typography>
        </Stack>

        <Box
          sx={{
            alignSelf: 'flex-start',
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            border: '1px solid',
            borderColor: alpha(badgeColor, 0.4),
            bgcolor: alpha(badgeColor, 0.1),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: badgeColor }}>
            {badgeLabel}
          </Typography>
        </Box>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            1. Public randomness (drand round {String(proof.beacon.round)})
          </Typography>
          <ProofRow label="Beacon scheme" value={proof.beacon.scheme} />
          <ProofRow label="Chain hash" value={proof.beacon.chainHash} />
          <ProofRow label="Beacon public key" value={proof.beacon.publicKey} />
          <ProofRow label="Round signature (BLS)" value={proof.beacon.signature} />
          <ProofRow label="Randomness = SHA-256(signature)" value={proof.beacon.randomness} />
          {drandUrl ? (
            <Typography variant="body2">
              <Box
                component="a"
                href={drandUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main', fontWeight: 700 }}
              >
                Inspect this round on the public drand network ↗
              </Box>
            </Typography>
          ) : null}
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            2. Deterministic winner derivation
          </Typography>
          <ProofRow label="Seed = SHA-256(randomness ‖ raffleId)" value={proof.derivation.seed} />
          <ProofRow label="Digest = SHA-256(seed ‖ raffleId ‖ ticketCount)" value={proof.derivation.digest} />
          <ProofRow label="Ticket count" value={String(proof.ticketCount)} />
          <ProofRow
            label="Winner index = digest mod ticketCount"
            value={`${String(proof.winnerIndex)} → ticket #${String(proof.winnerTicketNumber)}`}
          />
          <ProofRow label="Algorithm" value={proof.algorithm} />
          {state.status === 'done' ? (
            <Typography variant="body2" color="text.secondary">
              Your browser independently recomputed winner index{' '}
              <Box component="span" sx={{ fontWeight: 700 }}>
                {String(state.recomputedIndex)}
              </Box>{' '}
              {verified ? 'and it matches the published result.' : 'which did not match — please report this.'}
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
