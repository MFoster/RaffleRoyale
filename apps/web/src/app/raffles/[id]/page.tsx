import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import RaffleDetailsActions from '@/components/RaffleDetailsActions';
import SiteHeader from '@/components/SiteHeader';
import { royaleTokens } from '@/design-system';
import { fetchApiResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

type RaffleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'DISBANDED'
  | 'COMPLETED';

type RaffleItemType = 'PHYSICAL' | 'DIGITAL';

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
  DISBANDED: 'secondary',
  COMPLETED: 'tertiary',
};

function parseRaffleStatus(value: unknown): RaffleStatus | null {
  if (
    value === 'DRAFT' ||
    value === 'ACTIVE' ||
    value === 'SOLD_OUT' ||
    value === 'EXPIRED' ||
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
  };
}

async function fetchRaffle(id: string): Promise<FetchRaffleResult> {
  const apiResult = await fetchApiResponse(`/raffles/${id}`, { cache: 'no-store' });

  if (!apiResult.ok) {
    return { kind: 'error', message: apiResult.error };
  }

  try {
    const { response } = apiResult;

    if (response.status === 404) {
      return { kind: 'not_found' };
    }

    if (!response.ok) {
      return {
        kind: 'error',
        message: `Raffle API responded with ${response.status}.`,
      };
    }

    const payload: unknown = await response.json();
    const raffle = parseRaffle(payload);
    return { kind: 'ok', raffle };
  } catch {
    return {
      kind: 'error',
      message: 'Could not load raffle details from the API.',
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
            href="/#featured-raffles"
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
                      Live raffle
                    </Typography>
                    <Typography variant="h2">{result.raffle.title}</Typography>
                  </Stack>
                  <Chip
                    label={statusLabelByValue[result.raffle.status]}
                    color={statusColorByValue[result.raffle.status]}
                    variant="filled"
                  />
                </Stack>

                {result.raffle.imageUrls.length > 0 ? (
                  <Stack spacing={1.5}>
                    <Box
                      component="img"
                      src={result.raffle.imageUrls[0]}
                      alt={`${result.raffle.title} primary image`}
                      sx={{
                        width: '100%',
                        minHeight: 340,
                        maxHeight: 460,
                        objectFit: 'cover',
                        borderRadius: 3,
                        border: '1px solid',
                        borderColor: alpha('#5B3DF5', 0.2),
                      }}
                    />
                    {result.raffle.imageUrls.length > 1 ? (
                      <Box
                        sx={{
                          display: 'grid',
                          gap: 1.5,
                          gridTemplateColumns: {
                            xs: 'repeat(2, 1fr)',
                            md: 'repeat(3, 1fr)',
                          },
                        }}
                      >
                        {result.raffle.imageUrls.slice(1).map((imageUrl, index) => (
                          <Box
                            key={imageUrl}
                            component="img"
                            src={imageUrl}
                            alt={`${result.raffle.title} image ${String(index + 2)}`}
                            sx={{
                              width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 2,
                              border: '1px solid',
                              borderColor: alpha('#5B3DF5', 0.18),
                            }}
                          />
                        ))}
                      </Box>
                    ) : null}
                  </Stack>
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
          )}
        </Stack>
      </Container>
    </Box>
  );
}
