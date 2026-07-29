'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AppLink from '@/components/AppLink';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import SectionHeading from '@/components/layout/SectionHeading';
import RaffleListingGrid from '@/components/profile/RaffleListingGrid';
import type { RaffleData } from '@/components/home/EnhancedRaffleCard';
import {
  getAuthUserId,
  hasAuthSession,
  subscribeAuthSession,
} from '@/lib/auth-session';
import { fetchWithAuthRetry } from '@/lib/authenticated-fetch';
import { formatTimeUntilEnd } from '@/lib/raffleFormatters';
import {
  getInitials,
  parseRaffleStatus,
  RAFFLE_STATUS_LABELS,
  type RaffleStatus,
} from '@/lib/raffleStatus';

type TicketOutcome = 'PENDING' | 'WON' | 'LOST' | 'CLOSED';

type TicketActivity = {
  transactionId: string;
  amount: number;
  quantity: number;
  ticketNumbers: number[];
  outcome: TicketOutcome;
  winnerTicketNumber: number | null;
  raffle: {
    id: string;
    title: string;
    status: RaffleStatus;
    endTime: string;
    imageUrls: string[];
  };
};

type TicketGroup = {
  raffle: TicketActivity['raffle'];
  quantity: number;
  ticketNumbers: number[];
  totalSpent: number;
  outcome: TicketOutcome;
  winnerTicketNumber: number | null;
};

type AccountProfile = {
  id: string;
  email: string;
  phone: string | null;
  displayName: string | null;
  bio: string | null;
  kycStatus: string;
  createdAt: string;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      profile: AccountProfile;
      tickets: TicketActivity[];
      listings: RaffleData[];
    };

function formatCents(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseProfile(payload: unknown): AccountProfile | null {
  const record = asRecord(payload);
  if (!record || typeof record.id !== 'string' || typeof record.email !== 'string') {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    phone: typeof record.phone === 'string' ? record.phone : null,
    displayName: typeof record.displayName === 'string' ? record.displayName : null,
    bio: typeof record.bio === 'string' ? record.bio : null,
    kycStatus: typeof record.kycStatus === 'string' ? record.kycStatus : 'PENDING',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
  };
}

function parseTicket(value: unknown): TicketActivity | null {
  const record = asRecord(value);
  const raffle = asRecord(record?.raffle);
  if (!record || !raffle) {
    return null;
  }

  const status = parseRaffleStatus(raffle.status);
  if (
    typeof record.transactionId !== 'string' ||
    typeof record.quantity !== 'number' ||
    typeof raffle.id !== 'string' ||
    typeof raffle.title !== 'string' ||
    typeof raffle.endTime !== 'string' ||
    status === null
  ) {
    return null;
  }

  const outcome =
    record.outcome === 'WON' ||
    record.outcome === 'LOST' ||
    record.outcome === 'CLOSED'
      ? record.outcome
      : 'PENDING';

  return {
    transactionId: record.transactionId,
    amount: typeof record.amount === 'number' ? record.amount : 0,
    quantity: record.quantity,
    ticketNumbers: Array.isArray(record.ticketNumbers)
      ? record.ticketNumbers.filter((n): n is number => typeof n === 'number')
      : [],
    outcome,
    winnerTicketNumber:
      typeof record.winnerTicketNumber === 'number'
        ? record.winnerTicketNumber
        : null,
    raffle: {
      id: raffle.id,
      title: raffle.title,
      status,
      endTime: raffle.endTime,
      imageUrls: Array.isArray(raffle.imageUrls)
        ? raffle.imageUrls.filter((u): u is string => typeof u === 'string')
        : [],
    },
  };
}

function parseListing(value: unknown): RaffleData | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

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
    description: typeof record.description === 'string' ? record.description : null,
    imageUrls: Array.isArray(record.imageUrls)
      ? record.imageUrls.filter((u): u is string => typeof u === 'string')
      : [],
    ticketPrice: record.ticketPrice,
    ticketsSold: record.ticketsSold,
    totalTickets: record.totalTickets,
    endTime: record.endTime,
    createdAt: record.createdAt,
    status,
  };
}

function groupTicketsByRaffle(tickets: TicketActivity[]): TicketGroup[] {
  const groups = new Map<string, TicketGroup>();

  for (const ticket of tickets) {
    const existing = groups.get(ticket.raffle.id);
    if (existing) {
      existing.quantity += ticket.quantity;
      existing.totalSpent += ticket.amount;
      existing.ticketNumbers = [...existing.ticketNumbers, ...ticket.ticketNumbers];
    } else {
      groups.set(ticket.raffle.id, {
        raffle: ticket.raffle,
        quantity: ticket.quantity,
        ticketNumbers: [...ticket.ticketNumbers],
        totalSpent: ticket.amount,
        outcome: ticket.outcome,
        winnerTicketNumber: ticket.winnerTicketNumber,
      });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    ticketNumbers: [...group.ticketNumbers].sort((a, b) => a - b),
  }));
}

const OUTCOME_CHIP: Record<
  TicketOutcome,
  { label: string; color: 'primary' | 'tertiary' | 'neutral' | 'secondary' }
> = {
  PENDING: { label: 'In progress', color: 'primary' },
  WON: { label: 'You won', color: 'tertiary' },
  LOST: { label: 'Not selected', color: 'neutral' },
  CLOSED: { label: 'Closed / refunded', color: 'neutral' },
};

function TicketRow({ group }: { group: TicketGroup }) {
  const thumbnail = group.raffle.imageUrls[0];
  const isCurrent =
    group.raffle.status === 'ACTIVE' || group.raffle.status === 'SOLD_OUT';
  const outcome = OUTCOME_CHIP[group.outcome];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        gap: 2,
        alignItems: 'center',
        transition: 'border-color 120ms ease',
        '&:hover': { borderColor: alpha('#5B3DF5', 0.4) },
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 2,
          overflow: 'hidden',
          flexShrink: 0,
          bgcolor: alpha('#5B3DF5', 0.08),
        }}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt={group.raffle.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <ImagePlaceholder minHeight={64} title={group.raffle.title} caption="" />
        )}
      </Box>

      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component={AppLink}
          href={`/raffles/${group.raffle.id}`}
          sx={{
            fontWeight: 700,
            textDecoration: 'none',
            color: 'text.primary',
            '&:hover': { color: 'primary.main' },
          }}
        >
          {group.raffle.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {group.quantity} {group.quantity === 1 ? 'ticket' : 'tickets'} · #
          {group.ticketNumbers.join(', #')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatCents(group.totalSpent)} spent
        </Typography>
      </Stack>

      <Stack spacing={0.75} sx={{ alignItems: 'flex-end', flexShrink: 0 }}>
        {isCurrent ? (
          <>
            <Chip
              size="small"
              color="primary"
              variant="filled"
              label={RAFFLE_STATUS_LABELS[group.raffle.status]}
            />
            <Typography variant="caption" color="text.secondary">
              Ends in {formatTimeUntilEnd(group.raffle.endTime)}
            </Typography>
          </>
        ) : (
          <>
            <Chip
              size="small"
              color={outcome.color}
              variant="filled"
              label={outcome.label}
            />
            {group.winnerTicketNumber !== null ? (
              <Typography variant="caption" color="text.secondary">
                Winning ticket #{group.winnerTicketNumber}
              </Typography>
            ) : null}
          </>
        )}
      </Stack>
    </Paper>
  );
}

function TicketList({
  groups,
  emptyMessage,
}: {
  groups: TicketGroup[];
  emptyMessage: string;
}) {
  if (groups.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 3, borderStyle: 'dashed', textAlign: 'center' }}
      >
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1.5}>
      {groups.map((group) => (
        <TicketRow key={group.raffle.id} group={group} />
      ))}
    </Stack>
  );
}

async function fetchDashboardState(userId: string): Promise<LoadState> {
  try {
    const [profileResponse, ticketsResponse, listingsResponse] =
      await Promise.all([
        fetchWithAuthRetry(`/api/user/${userId}`),
        fetchWithAuthRetry(`/api/user/${userId}/tickets`),
        fetchWithAuthRetry(`/api/user/${userId}/raffle`),
      ]);

    if (!profileResponse.ok) {
      return {
        kind: 'error',
        message: 'Could not load your account details. Please try again.',
      };
    }

    const profile = parseProfile(await profileResponse.json());
    if (!profile) {
      return {
        kind: 'error',
        message: 'Received an unexpected account response.',
      };
    }

    const ticketsPayload: unknown = ticketsResponse.ok
      ? await ticketsResponse.json()
      : [];
    const listingsPayload: unknown = listingsResponse.ok
      ? await listingsResponse.json()
      : [];

    const tickets = Array.isArray(ticketsPayload)
      ? ticketsPayload.map(parseTicket).filter((t): t is TicketActivity => t !== null)
      : [];
    const listings = Array.isArray(listingsPayload)
      ? listingsPayload.map(parseListing).filter((l): l is RaffleData => l !== null)
      : [];

    return { kind: 'ready', profile, tickets, listings };
  } catch {
    return {
      kind: 'error',
      message: 'Could not reach the API. Please try again.',
    };
  }
}

export default function AccountDashboard() {
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    hasAuthSession,
    () => false,
  );
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeTab, setActiveTab] = useState(0);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const userId = getAuthUserId();
    if (!userId) {
      return;
    }

    let active = true;
    void fetchDashboardState(userId).then((result) => {
      if (!active) {
        return;
      }
      setState(result);
      if (result.kind === 'ready') {
        setDisplayName(result.profile.displayName ?? '');
        setBio(result.profile.bio ?? '');
        setPhone(result.profile.phone ?? '');
      }
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated, reloadKey]);

  const ticketGroups = useMemo(
    () => (state.kind === 'ready' ? groupTicketsByRaffle(state.tickets) : []),
    [state],
  );

  const activeTicketGroups = ticketGroups.filter(
    (group) =>
      group.raffle.status === 'ACTIVE' || group.raffle.status === 'SOLD_OUT',
  );
  const pastTicketGroups = ticketGroups.filter(
    (group) =>
      group.raffle.status !== 'ACTIVE' && group.raffle.status !== 'SOLD_OUT',
  );

  const currentListings =
    state.kind === 'ready'
      ? state.listings.filter(
          (listing) =>
            listing.status === 'ACTIVE' ||
            listing.status === 'SOLD_OUT' ||
            listing.status === 'DRAFT',
        )
      : [];
  const pastListings =
    state.kind === 'ready'
      ? state.listings.filter(
          (listing) =>
            listing.status !== 'ACTIVE' &&
            listing.status !== 'SOLD_OUT' &&
            listing.status !== 'DRAFT',
        )
      : [];

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== 'ready') {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetchWithAuthRetry(`/api/user/${state.profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          bio: bio.trim(),
          phone: phone.trim(),
        }),
      });

      if (!response.ok) {
        setSaveError('Could not save your changes. Please try again.');
        return;
      }

      const updated = parseProfile(await response.json());
      if (updated) {
        setState({ ...state, profile: updated });
      }
      setSaveSuccess(true);
    } catch {
      setSaveError('Could not reach the API. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <Paper sx={{ p: { xs: 3, md: 4.5 }, maxWidth: 520, mx: 'auto' }}>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Sign in to view your account
          </Typography>
          <Typography color="text.secondary">
            Manage your profile, track tickets, and review your listings once you
            are signed in.
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button href="/login" variant="contained">
              Log in
            </Button>
            <Button href="/register" variant="outlined" color="inherit">
              Create account
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state.kind === 'error') {
    return (
      <Paper variant="outlined" sx={{ p: 3.5, maxWidth: 520, mx: 'auto' }}>
        <Stack spacing={2}>
          <Typography variant="h5">Something went wrong</Typography>
          <Typography color="text.secondary">{state.message}</Typography>
          <Button
            variant="contained"
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => {
              setState({ kind: 'loading' });
              setReloadKey((key) => key + 1);
            }}
          >
            Try again
          </Button>
        </Stack>
      </Paper>
    );
  }

  const { profile } = state;
  const displayLabel = profile.displayName ?? profile.email;

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          border: '1px solid',
          borderColor: alpha('#5B3DF5', 0.18),
          bgcolor: alpha('#FFFFFF', 0.94),
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2.5, sm: 3 }}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' } }}
        >
          <Avatar
            sx={{
              width: 72,
              height: 72,
              fontSize: '1.5rem',
              fontWeight: 700,
              bgcolor: 'primary.main',
            }}
          >
            {getInitials(profile.displayName ?? profile.email)}
          </Avatar>
          <Stack spacing={1} sx={{ flex: 1 }}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {displayLabel}
              </Typography>
              {profile.kycStatus === 'VERIFIED' ? (
                <Chip
                  icon={<VerifiedRounded />}
                  label="Verified"
                  color="primary"
                  size="small"
                />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {profile.email}
            </Typography>
          </Stack>
          <Button
            href={`/users/${profile.id}`}
            variant="outlined"
            color="inherit"
            endIcon={<OpenInNewRounded />}
          >
            View public profile
          </Button>
        </Stack>
      </Paper>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: number) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`My tickets (${ticketGroups.length})`} />
          <Tab label={`My listings (${state.listings.length})`} />
          <Tab label="Profile" />
        </Tabs>
      </Box>

      {activeTab === 0 ? (
        <Stack spacing={4}>
          <Stack spacing={2}>
            <SectionHeading
              eyebrow="Check often"
              title="Active tickets"
              subtitle="Raffles you are entered in that are still running."
              titleVariant="h5"
            />
            <TicketList
              groups={activeTicketGroups}
              emptyMessage="You have no active tickets right now."
            />
          </Stack>
          <Stack spacing={2}>
            <SectionHeading
              eyebrow="Results"
              title="Ticket history"
              subtitle="Raffles that have finished, including the ones you won."
              titleVariant="h5"
            />
            <TicketList
              groups={pastTicketGroups}
              emptyMessage="None of your raffles have finished yet."
            />
          </Stack>
        </Stack>
      ) : null}

      {activeTab === 1 ? (
        <Stack spacing={4}>
          <Stack spacing={2}>
            <SectionHeading
              eyebrow="Live"
              title="Current listings"
              subtitle="Drafts and active raffles you are hosting."
              titleVariant="h5"
              action={
                <Button href="/raffles/create" variant="contained" size="small">
                  Create raffle
                </Button>
              }
            />
            <RaffleListingGrid
              raffles={currentListings}
              emptyMessage="You have no active listings. Create your first raffle!"
            />
          </Stack>
          <Stack spacing={2}>
            <SectionHeading
              eyebrow="History"
              title="Past listings"
              subtitle="Completed, expired, and disbanded raffles you hosted."
              titleVariant="h5"
            />
            <RaffleListingGrid
              raffles={pastListings}
              emptyMessage="You have no past listings yet."
            />
          </Stack>
        </Stack>
      ) : null}

      {activeTab === 2 ? (
        <Paper sx={{ p: { xs: 3, md: 4 }, maxWidth: 640 }}>
          <Stack
            component="form"
            spacing={2.5}
            onSubmit={(event) => void handleSaveProfile(event)}
          >
            <SectionHeading
              title="Personal information"
              subtitle="Update how you appear to other members across Raffle Royale."
              titleVariant="h5"
            />
            {saveError ? <Alert severity="error">{saveError}</Alert> : null}
            {saveSuccess ? (
              <Alert severity="success">Your profile has been updated.</Alert>
            ) : null}
            <TextField
              label="Display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 80 } }}
              helperText="Shown on your public profile and raffle listings."
              fullWidth
            />
            <TextField
              label="Bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 600 } }}
              helperText={`${bio.length}/600 — tell buyers a bit about yourself.`}
              multiline
              minRows={4}
              fullWidth
            />
            <TextField
              label="Phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 30 } }}
              helperText="Private — never shown on your public profile."
              fullWidth
            />
            <Box>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </Box>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
