import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import SiteHeader from '@/components/SiteHeader';
import PageContainer from '@/components/layout/PageContainer';
import Section from '@/components/layout/Section';
import SectionHeading from '@/components/layout/SectionHeading';
import RaffleListingGrid from '@/components/profile/RaffleListingGrid';
import type { RaffleData } from '@/components/home/EnhancedRaffleCard';
import { royaleTokens } from '@/design-system';
import { fetchApiResponse } from '@/lib/api';
import {
  getInitials,
  isCurrentRaffleStatus,
  parseRaffleStatus,
  type RaffleStatus,
} from '@/lib/raffleStatus';

export const dynamic = 'force-dynamic';

type ProfileListing = RaffleData;

type PublicProfile = {
  id: string;
  displayName: string | null;
  bio: string | null;
  kycStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  raffles: ProfileListing[];
};

type FetchProfileResult =
  | { kind: 'ok'; profile: PublicProfile }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

function parseListing(value: unknown): ProfileListing | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const status = parseRaffleStatus(record.status);

  if (
    typeof record.id !== 'string' ||
    typeof record.title !== 'string' ||
    typeof record.totalTickets !== 'number' ||
    typeof record.ticketPrice !== 'number' ||
    typeof record.ticketsSold !== 'number' ||
    typeof record.endTime !== 'string' ||
    typeof record.createdAt !== 'string' ||
    status === null
  ) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    description:
      typeof record.description === 'string' ? record.description : null,
    imageUrls:
      Array.isArray(record.imageUrls) &&
      record.imageUrls.every((entry) => typeof entry === 'string')
        ? (record.imageUrls as string[])
        : [],
    ticketPrice: record.ticketPrice,
    ticketsSold: record.ticketsSold,
    totalTickets: record.totalTickets,
    endTime: record.endTime,
    createdAt: record.createdAt,
    status,
  };
}

function parseProfile(payload: unknown): PublicProfile {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new Error('Profile response must be an object.');
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.createdAt !== 'string') {
    throw new Error('Profile response has an unexpected shape.');
  }

  const kycStatus =
    record.kycStatus === 'VERIFIED' || record.kycStatus === 'REJECTED'
      ? record.kycStatus
      : 'PENDING';

  const raffles = Array.isArray(record.raffles)
    ? record.raffles
        .map(parseListing)
        .filter((listing): listing is ProfileListing => listing !== null)
    : [];

  return {
    id: record.id,
    displayName:
      typeof record.displayName === 'string' && record.displayName.trim().length
        ? record.displayName
        : null,
    bio: typeof record.bio === 'string' ? record.bio : null,
    kycStatus,
    createdAt: record.createdAt,
    raffles,
  };
}

async function fetchProfile(id: string): Promise<FetchProfileResult> {
  const result = await fetchApiResponse(`/user/${id}/profile`, {
    cache: 'no-store',
  });

  if (!result.ok) {
    return { kind: 'error', message: result.error };
  }

  if (result.response.status === 404) {
    return { kind: 'not_found' };
  }

  if (!result.response.ok) {
    return {
      kind: 'error',
      message: 'Could not load this profile from the API.',
    };
  }

  try {
    const payload: unknown = await result.response.json();
    return { kind: 'ok', profile: parseProfile(payload) };
  } catch {
    return {
      kind: 'error',
      message: 'Received an unexpected profile response from the API.',
    };
  }
}

function formatMemberSince(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await fetchProfile(id);

  if (result.kind !== 'ok') {
    return { title: 'Seller profile' };
  }

  const name = result.profile.displayName ?? 'Raffle host';
  return { title: `${name} | Raffle Royale` };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchProfile(id);

  if (result.kind === 'not_found') {
    notFound();
  }

  return (
    <Box sx={{ pb: { xs: 6, md: 10 }, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <PageContainer sx={{ pt: { xs: 4, md: 6 } }}>
        {result.kind === 'error' ? (
          <Paper variant="outlined" sx={{ p: 3.5 }}>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Profile unavailable
            </Typography>
            <Typography color="text.secondary">{result.message}</Typography>
          </Paper>
        ) : (
          (() => {
            const { profile } = result;
            const displayName = profile.displayName ?? 'Raffle host';
            const liveRaffles = profile.raffles.filter((raffle) =>
              isCurrentRaffleStatus(raffle.status as RaffleStatus),
            );
            const pastRaffles = profile.raffles.filter(
              (raffle) => !isCurrentRaffleStatus(raffle.status as RaffleStatus),
            );

            return (
              <Stack spacing={{ xs: 4, md: 6 }}>
                <Paper
                  sx={{
                    p: { xs: 3, md: 4.5 },
                    border: '1px solid',
                    borderColor: alpha('#5B3DF5', 0.18),
                    bgcolor: alpha('#FFFFFF', 0.94),
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={{ xs: 2.5, sm: 3.5 }}
                    sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
                  >
                    <Avatar
                      sx={{
                        width: { xs: 72, md: 88 },
                        height: { xs: 72, md: 88 },
                        fontSize: { xs: '1.5rem', md: '1.85rem' },
                        fontWeight: 700,
                        bgcolor: 'primary.main',
                      }}
                    >
                      {getInitials(profile.displayName)}
                    </Avatar>
                    <Stack spacing={1.25} sx={{ flex: 1 }}>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Typography variant="h3" sx={{ fontWeight: 800 }}>
                          {displayName}
                        </Typography>
                        {profile.kycStatus === 'VERIFIED' ? (
                          <Chip
                            label={
                              <Box
                                component="span"
                                sx={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <VerifiedRounded sx={{ fontSize: 16 }} />
                                Verified host
                              </Box>
                            }
                            color="primary"
                            variant="filled"
                            size="small"
                          />
                        ) : null}
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', color: 'text.secondary' }}
                      >
                        <StorefrontRounded fontSize="small" />
                        <Typography variant="body2">
                          {profile.raffles.length}{' '}
                          {profile.raffles.length === 1 ? 'raffle' : 'raffles'} ·
                          Member since {formatMemberSince(profile.createdAt)}
                        </Typography>
                      </Stack>
                      <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
                        {profile.bio ??
                          'This host has not added a bio yet. Check out their raffles below.'}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>

                <Section component="div" spacing="compact" sx={{ py: 0 }}>
                  <Stack spacing={2.5}>
                    <SectionHeading
                      eyebrow="Live now"
                      title="Current raffles"
                      subtitle="Active listings you can still buy tickets for."
                      titleVariant="h4"
                    />
                    <RaffleListingGrid
                      raffles={liveRaffles}
                      emptyMessage="No live raffles from this host right now."
                    />
                  </Stack>
                </Section>

                <Section component="div" spacing="compact" sx={{ py: 0 }}>
                  <Stack spacing={2.5}>
                    <SectionHeading
                      eyebrow="History"
                      title="Past raffles"
                      subtitle="Completed, expired, and disbanded listings."
                      titleVariant="h4"
                    />
                    <RaffleListingGrid
                      raffles={pastRaffles}
                      emptyMessage="This host has no past raffles yet."
                    />
                  </Stack>
                </Section>
              </Stack>
            );
          })()
        )}
      </PageContainer>
    </Box>
  );
}
