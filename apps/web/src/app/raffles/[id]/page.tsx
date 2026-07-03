import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AppLink from '@/components/AppLink';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import RaffleImageCarousel from '@/components/RaffleImageCarousel';
import RaffleDetailsActions from '@/components/RaffleDetailsActions';
import SiteHeader from '@/components/SiteHeader';
import WinnerDrawProof, { type DrawProofView } from '@/components/WinnerDrawProof';
import { royaleTokens } from '@/design-system';
import { getInitials } from '@/lib/raffleStatus';
import { raffleFindOne } from '@/generated/clients';
import {
  getApiErrorMessage,
  getApiErrorStatus,
  getServerApiConfig,
} from '@/lib/generated-api';

export const dynamic = 'force-dynamic';

type RaffleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'PENDING_DRAW'
  | 'DISBANDED'
  | 'COMPLETED';

type RaffleItemType = 'PHYSICAL' | 'DIGITAL';

type WinnerEventDetails = {
  id: string;
  winnerTicketNumber: number;
  winnerDisplayName: string | null;
  winnerEmail: string | null;
};

type RaffleSeller = {
  id: string;
  displayName: string | null;
};

type DrawCommitment = {
  beaconRound: number;
  scheme: string | null;
  chainHash: string | null;
  committedAt: string | null;
  availableAt: string | null;
};

type RaffleDetails = {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  status: RaffleStatus;
  itemType: RaffleItemType;
  totalTickets: number;
  ticketPrice: number;
  ticketsSold: number;
  minSellThrough: number | null;
  startTime: string;
  endTime: string;
  createdAt: string;
  seller: RaffleSeller | null;
  winnerEvent: WinnerEventDetails | null;
  drawProof: DrawProofView | null;
  drawCommitment: DrawCommitment | null;
};

type FetchRaffleResult =
  | { kind: 'ok'; raffle: RaffleDetails }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

const statusLabelByValue: Record<RaffleStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SOLD_OUT: 'Sold out',
  EXPIRED: 'Expired',
  PENDING_DRAW: 'Drawing winner',
  DISBANDED: 'Disbanded',
  COMPLETED: 'Completed',
};

const statusColorByValue: Record<
  RaffleStatus,
  'primary' | 'secondary' | 'tertiary' | 'neutral'
> = {
  DRAFT: 'neutral',
  ACTIVE: 'primary',
  SOLD_OUT: 'tertiary',
  EXPIRED: 'neutral',
  PENDING_DRAW: 'primary',
  DISBANDED: 'secondary',
  COMPLETED: 'tertiary',
};

function parseRaffleStatus(value: unknown): RaffleStatus | null {
  if (
    value === 'DRAFT' ||
    value === 'ACTIVE' ||
    value === 'SOLD_OUT' ||
    value === 'EXPIRED' ||
    value === 'PENDING_DRAW' ||
    value === 'DISBANDED' ||
    value === 'COMPLETED'
  ) {
    return value;
  }

  return null;
}

function parseRaffleItemType(value: unknown): RaffleItemType | null {
  if (value === 'PHYSICAL' || value === 'DIGITAL') {
    return value;
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function findEventMetadata(
  events: unknown,
  eventType: string,
): Record<string, unknown> | null {
  if (!Array.isArray(events)) {
    return null;
  }
  for (const event of events) {
    const eventRecord = asRecord(event);
    if (!eventRecord || eventRecord.eventType !== eventType) {
      continue;
    }
    const metadata = asRecord(eventRecord.metadata);
    if (metadata) {
      return metadata;
    }
  }
  return null;
}

function parseDrawProof(events: unknown, raffleId: string): DrawProofView | null {
  const metadata = findEventMetadata(events, 'WINNER_SELECTED');
  if (!metadata) {
    return null;
  }

  const beacon = asRecord(metadata.beacon);
  const derivation = asRecord(metadata.derivation);
  if (!beacon || !derivation) {
    // Legacy winners (pre commit-reveal) have no verifiable proof to render.
    return null;
  }

  if (
    typeof beacon.chainHash !== 'string' ||
    typeof beacon.scheme !== 'string' ||
    typeof beacon.round !== 'number' ||
    typeof beacon.randomness !== 'string' ||
    typeof beacon.signature !== 'string' ||
    typeof beacon.publicKey !== 'string' ||
    typeof derivation.seed !== 'string' ||
    typeof derivation.digest !== 'string' ||
    typeof metadata.ticketCount !== 'number' ||
    typeof metadata.winnerIndex !== 'number' ||
    typeof metadata.winnerTicketNumber !== 'number' ||
    typeof metadata.algorithm !== 'string'
  ) {
    return null;
  }

  return {
    raffleId,
    algorithm: metadata.algorithm,
    ticketCount: metadata.ticketCount,
    winnerIndex: metadata.winnerIndex,
    winnerTicketNumber: metadata.winnerTicketNumber,
    beacon: {
      chainHash: beacon.chainHash,
      scheme: beacon.scheme,
      round: beacon.round,
      randomness: beacon.randomness,
      signature: beacon.signature,
      publicKey: beacon.publicKey,
    },
    derivation: {
      seed: derivation.seed,
      digest: derivation.digest,
    },
  };
}

function parseDrawCommitment(events: unknown): DrawCommitment | null {
  const metadata = findEventMetadata(events, 'DRAW_COMMITTED');
  if (!metadata || typeof metadata.beaconRound !== 'number') {
    return null;
  }

  return {
    beaconRound: metadata.beaconRound,
    scheme: typeof metadata.scheme === 'string' ? metadata.scheme : null,
    chainHash: typeof metadata.chainHash === 'string' ? metadata.chainHash : null,
    committedAt:
      typeof metadata.committedAt === 'string' ? metadata.committedAt : null,
    availableAt:
      typeof metadata.availableAt === 'string' ? metadata.availableAt : null,
  };
}

function parseRaffle(payload: unknown): RaffleDetails {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Raffle response must be an object.');
  }

  const record = payload as Record<string, unknown>;
  const status = parseRaffleStatus(record.status);
  const itemType = parseRaffleItemType(record.itemType);

  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.totalTickets !== 'number' ||
    typeof record.ticketPrice !== 'number' ||
    typeof record.ticketsSold !== 'number' ||
    typeof record.startTime !== 'string' ||
    typeof record.endTime !== 'string' ||
    typeof record.createdAt !== 'string' ||
    status === null ||
    itemType === null
  ) {
    throw new Error('Raffle response has an unexpected shape.');
  }

  const winnerEvent = (() => {
    const events = record.events;

    if (!Array.isArray(events)) {
      return null;
    }

    for (const event of events) {
      if (typeof event !== 'object' || event === null || Array.isArray(event)) {
        continue;
      }

      const eventRecord = event as Record<string, unknown>;

      if (
        eventRecord.eventType !== 'WINNER_SELECTED' ||
        typeof eventRecord.id !== 'string'
      ) {
        continue;
      }

      const winnerTicket = eventRecord.winnerTicket;

      if (
        typeof winnerTicket !== 'object' ||
        winnerTicket === null ||
        Array.isArray(winnerTicket)
      ) {
        continue;
      }

      const winnerTicketRecord = winnerTicket as Record<string, unknown>;
      if (typeof winnerTicketRecord.ticketNumber !== 'number') {
        continue;
      }

      const buyer = winnerTicketRecord.buyer;
      let winnerEmail: string | null = null;
      let winnerDisplayName: string | null = null;

      if (
        typeof buyer === 'object' &&
        buyer !== null &&
        !Array.isArray(buyer)
      ) {
        const buyerRecord = buyer as Record<string, unknown>;
        if (typeof buyerRecord.email === 'string') {
          winnerEmail = buyerRecord.email;
        }
        if (
          typeof buyerRecord.displayName === 'string' &&
          buyerRecord.displayName.trim().length > 0
        ) {
          winnerDisplayName = buyerRecord.displayName;
        }
      }

      return {
        id: eventRecord.id,
        winnerTicketNumber: winnerTicketRecord.ticketNumber,
        winnerDisplayName,
        winnerEmail,
      };
    }

    return null;
  })();

  const seller = (() => {
    const raffler = record.raffler;
    if (
      typeof raffler !== 'object' ||
      raffler === null ||
      Array.isArray(raffler)
    ) {
      return null;
    }

    const rafflerRecord = raffler as Record<string, unknown>;
    if (typeof rafflerRecord.id !== 'string') {
      return null;
    }

    return {
      id: rafflerRecord.id,
      displayName:
        typeof rafflerRecord.displayName === 'string' &&
        rafflerRecord.displayName.trim().length
          ? rafflerRecord.displayName
          : null,
    };
  })();

  return {
    id: record.id,
    title: record.title,
    description: typeof record.description === 'string' ? record.description : null,
    imageUrls:
      Array.isArray(record.imageUrls) &&
      record.imageUrls.every((value) => typeof value === 'string')
        ? record.imageUrls
        : [],
    status,
    itemType,
    totalTickets: record.totalTickets,
    ticketPrice: record.ticketPrice,
    ticketsSold: record.ticketsSold,
    minSellThrough:
      typeof record.minSellThrough === 'number' ? record.minSellThrough : null,
    startTime: record.startTime,
    endTime: record.endTime,
    createdAt: record.createdAt,
    seller,
    winnerEvent,
    drawProof: parseDrawProof(record.events, record.id),
    drawCommitment: parseDrawCommitment(record.events),
  };
}

async function fetchRaffle(id: string): Promise<FetchRaffleResult> {
  try {
    const payload = await raffleFindOne(id, getServerApiConfig());
    const raffle = parseRaffle(payload);
    return { kind: 'ok', raffle };
  } catch (error) {
    if (getApiErrorStatus(error) === 404) {
      return { kind: 'not_found' };
    }

    return {
      kind: 'error',
      message: getApiErrorMessage(
        error,
        'Could not load raffle details from the API.',
      ),
    };
  }
}

function formatCurrencyFromMinorUnits(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function getProgressPercent(ticketsSold: number, totalTickets: number): number {
  if (totalTickets <= 0) {
    return 0;
  }

  const ratio = (ticketsSold / totalTickets) * 100;
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchRaffle(id);

  if (result.kind !== 'ok') {
    return { title: 'Raffle details' };
  }

  return {
    title: result.raffle.title,
  };
}

export default async function RaffleDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchRaffle(id);

  if (result.kind === 'not_found') {
    notFound();
  }

  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 }, px: { xs: 2.5, md: 4 } }}>
        <Stack spacing={4}>
          <Button
            href="/marketplace"
            variant="outlined"
            color="inherit"
            sx={{ alignSelf: 'flex-start' }}
            startIcon={<ArrowBackRounded />}
          >
            Back to raffles
          </Button>

          {result.kind === 'error' ? (
            <Paper variant="outlined" sx={{ p: 3.5 }}>
              <Typography variant="h5" sx={{ mb: 1.5 }}>
                Raffle unavailable
              </Typography>
              <Typography color="text.secondary">{result.message}</Typography>
            </Paper>
          ) : (
            (() => {
              const winnerEvent = result.raffle.winnerEvent;
              const isWinnerState =
                result.raffle.status === 'COMPLETED' || winnerEvent !== null;
              const winnerDisplayName =
                winnerEvent?.winnerDisplayName ??
                winnerEvent?.winnerEmail ??
                'Winner account';

              return (
            <Paper
              sx={{
                p: { xs: 3.5, md: 5 },
                border: '1px solid',
                borderColor: alpha('#5B3DF5', 0.24),
                bgcolor: alpha('#FFFFFF', 0.94),
              }}
            >
              <Stack spacing={3.5}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={2}
                  sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
                >
                  <Stack spacing={1}>
                    <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.08em' }}>
                      {isWinnerState ? 'Winner selected' : 'Live raffle'}
                    </Typography>
                    <Typography variant="h2">{result.raffle.title}</Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    {isWinnerState ? (
                      <Chip
                        icon={<WorkspacePremiumRounded />}
                        label="Winner"
                        color="tertiary"
                        variant="filled"
                      />
                    ) : null}
                    <Chip
                      label={statusLabelByValue[result.raffle.status]}
                      color={statusColorByValue[result.raffle.status]}
                      variant="filled"
                    />
                  </Stack>
                </Stack>

                {isWinnerState ? (
                  <Paper
                    sx={{
                      p: 3,
                      border: '1px solid',
                      borderColor: alpha('#8C6A00', 0.32),
                      background:
                        'linear-gradient(140deg, rgba(255,255,255,0.98), rgba(140,106,0,0.14))',
                    }}
                  >
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.25 }}>
                      <WorkspacePremiumRounded sx={{ color: '#8C6A00' }} />
                      <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        We have a winner
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700 }}>
                      {winnerDisplayName}
                    </Typography>
                    {winnerEvent ? (
                      <Typography variant="body2" color="text.secondary">
                        Winning ticket #{String(winnerEvent.winnerTicketNumber)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Winner has been selected and announced.
                      </Typography>
                    )}
                  </Paper>
                ) : null}

                {result.raffle.status === 'PENDING_DRAW' &&
                result.raffle.drawCommitment ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 3,
                      borderColor: alpha('#5B3DF5', 0.32),
                      bgcolor: alpha('#5B3DF5', 0.06),
                    }}
                  >
                    <Stack spacing={1}>
                      <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.08em' }}>
                        Drawing the winner
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        Committed to drand round{' '}
                        {String(result.raffle.drawCommitment.beaconRound)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        We have locked in a future public randomness round
                        {result.raffle.drawCommitment.availableAt
                          ? `, published around ${formatDateLabel(result.raffle.drawCommitment.availableAt)}`
                          : ''}
                        . The winner will be derived from its signature the moment
                        it is released — provably chosen before the randomness
                        even existed.
                      </Typography>
                    </Stack>
                  </Paper>
                ) : null}

                {result.raffle.drawProof ? (
                  <WinnerDrawProof proof={result.raffle.drawProof} />
                ) : null}

                {result.raffle.imageUrls.length > 0 ? (
                  <RaffleImageCarousel
                    imageUrls={result.raffle.imageUrls}
                    title={result.raffle.title}
                  />
                ) : (
                  <ImagePlaceholder
                    minHeight={340}
                    title={`Raffle detail visual: ${result.raffle.title}`}
                    caption="Replace with actual raffle media to increase trust and conversion."
                  />
                )}

                <Typography color="text.secondary">
                  {result.raffle.description ?? 'No description has been provided for this raffle.'}
                </Typography>

                {result.raffle.seller ? (
                  <Paper
                    component={AppLink}
                    href={`/users/${result.raffle.seller.id}`}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      textDecoration: 'none',
                      color: 'inherit',
                      transition: 'border-color 120ms ease, background-color 120ms ease',
                      '&:hover': {
                        borderColor: alpha('#5B3DF5', 0.45),
                        bgcolor: alpha('#5B3DF5', 0.04),
                      },
                    }}
                  >
                    <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 700 }}>
                      {getInitials(result.raffle.seller.displayName)}
                    </Avatar>
                    <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary">
                        Listed by
                      </Typography>
                      <Typography sx={{ fontWeight: 700 }}>
                        {result.raffle.seller.displayName ?? 'Raffle host'}
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ color: 'primary.main', fontWeight: 700 }}
                    >
                      View profile
                    </Typography>
                  </Paper>
                ) : null}

                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                  }}
                >
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Ticket price
                    </Typography>
                    <Typography variant="h6">
                      {formatCurrencyFromMinorUnits(result.raffle.ticketPrice)}
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Tickets sold
                    </Typography>
                    <Typography variant="h6">
                      {result.raffle.ticketsSold} / {result.raffle.totalTickets}
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Starts
                    </Typography>
                    <Typography variant="h6">
                      {formatDateLabel(result.raffle.startTime)}
                    </Typography>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Ends
                    </Typography>
                    <Typography variant="h6">
                      {formatDateLabel(result.raffle.endTime)}
                    </Typography>
                  </Paper>
                </Box>

                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {getProgressPercent(result.raffle.ticketsSold, result.raffle.totalTickets)}%
                      </Typography>
                    </Stack>
                    <Box
                      sx={{
                        height: 10,
                        borderRadius: 999,
                        bgcolor: alpha('#5B3DF5', 0.12),
                        overflow: 'hidden',
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: `${String(getProgressPercent(result.raffle.ticketsSold, result.raffle.totalTickets))}%`,
                          bgcolor: 'primary.main',
                        }}
                      />
                    </Box>
                  </Stack>
                </Paper>

                <RaffleDetailsActions
                  raffleId={result.raffle.id}
                  raffleTitle={result.raffle.title}
                  raffleStatus={result.raffle.status}
                  availableTickets={Math.max(
                    0,
                    result.raffle.totalTickets - result.raffle.ticketsSold,
                  )}
                  ticketPrice={result.raffle.ticketPrice}
                />
              </Stack>
            </Paper>
              );
            })()
          )}
        </Stack>
      </Container>
    </Box>
  );
}
