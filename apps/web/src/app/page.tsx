import type { Metadata } from 'next';
import AddBoxRounded from '@mui/icons-material/AddBoxRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import ConfirmationNumberRounded from '@mui/icons-material/ConfirmationNumberRounded';
import Inventory2Rounded from '@mui/icons-material/Inventory2Rounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EnhancedHomepageRaffles from '@/components/home/EnhancedHomepageRaffles';
import { alpha } from '@mui/material/styles';
import SiteHeader from '@/components/SiteHeader';
import { royaleTokens } from '@/design-system';
import { raffleFindAll } from '@/generated/clients';
import { getApiErrorMessage, getServerApiConfig } from '@/lib/generated-api';

export const metadata: Metadata = {
  title: 'Home',
};

export const dynamic = 'force-dynamic';

type RaffleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'DISBANDED'
  | 'COMPLETED';

type RaffleItemType = 'PHYSICAL' | 'DIGITAL';

type RaffleListItem = {
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
  endTime: string;
  createdAt: string;
};

type FetchRafflesResult =
  | { ok: true; data: RaffleListItem[] }
  | { ok: false; error: string };

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

const toneColorByValue = {
  primary: '#5B3DF5',
  secondary: '#4F5D75',
  tertiary: '#8C6A00',
} as const;

const sectionTitleSx = {
  maxWidth: 820,
} as const;

const sectionEyebrowSx = {
  color: 'primary.main',
  fontWeight: 700,
  letterSpacing: '0.08em',
} as const;

const sectionSurfaceSx = {
  py: { xs: 2, md: 3 },
} as const;

const sectionPanelSx = {
  p: { xs: 4, md: 6 },
  border: '1px solid',
  borderColor: royaleTokens.surface.outline,
  bgcolor: royaleTokens.surface.overlay,
  boxShadow: '0 16px 36px rgba(23, 21, 31, 0.08)',
} as const;

const heroActionButtonSx = {
  px: 5,
  py: 2,
  minHeight: 60,
} as const;

const howItWorksSteps = [
  {
    step: '01',
    title: 'List a raffle',
    description:
      'Create a listing, define ticket count, and set price in a format buyers can scan quickly.',
    icon: AddBoxRounded,
    tone: 'primary',
  },
  {
    step: '02',
    title: 'Buy tickets',
    description:
      'Participants browse live listings, review progress, and purchase entries with clear visibility.',
    icon: ConfirmationNumberRounded,
    tone: 'secondary',
  },
  {
    step: '03',
    title: 'Track outcome',
    description:
      'Raffles transition through explicit statuses so buyers and sellers can follow the result.',
    icon: AutorenewRounded,
    tone: 'tertiary',
  },
] as const;

const audiencePanels = [
  {
    title: 'For buyers',
    description: 'Know what you are entering before you commit.',
    bullets: [
      'Fixed ticket quantities keep each raffle understandable.',
      'Ticket progress and status are visible directly on listings.',
      'Each raffle has a clear lifecycle from active to completed/disbanded.',
    ],
    tone: 'secondary',
    icon: VisibilityRounded,
  },
  {
    title: 'For sellers',
    description: 'Launch inventory with a cleaner engagement format.',
    bullets: [
      'Create listings with title, price, and ticket structure.',
      'Attract engagement through visible live progress.',
      'Track each raffle through status changes and outcomes.',
    ],
    tone: 'primary',
    icon: Inventory2Rounded,
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function parseRaffleListItems(payload: unknown): RaffleListItem[] {
  if (!Array.isArray(payload)) {
    throw new Error('Expected raffles response to be an array.');
  }

  return payload.map((raw, index) => {
    if (!isRecord(raw)) {
      throw new Error(`Raffle at index ${String(index)} must be an object.`);
    }

    const status = parseRaffleStatus(raw.status);
    const itemType = parseRaffleItemType(raw.itemType);

    if (
      typeof raw.id !== 'string' ||
      typeof raw.title !== 'string' ||
      typeof raw.totalTickets !== 'number' ||
      typeof raw.ticketPrice !== 'number' ||
      typeof raw.ticketsSold !== 'number' ||
      typeof raw.endTime !== 'string' ||
      typeof raw.createdAt !== 'string' ||
      status === null ||
      itemType === null
    ) {
      throw new Error(
        `Raffle at index ${String(index)} has an unexpected response shape.`,
      );
    }

    const description =
      raw.description === null || typeof raw.description === 'string'
        ? raw.description
        : null;

    const minSellThrough =
      raw.minSellThrough === null || typeof raw.minSellThrough === 'number'
        ? raw.minSellThrough
        : null;

    return {
      id: raw.id,
      title: raw.title,
      description,
      imageUrls:
        Array.isArray(raw.imageUrls) &&
        raw.imageUrls.every((value) => typeof value === 'string')
          ? raw.imageUrls
          : [],
      status,
      itemType,
      totalTickets: raw.totalTickets,
      ticketPrice: raw.ticketPrice,
      ticketsSold: raw.ticketsSold,
      minSellThrough,
      endTime: raw.endTime,
      createdAt: raw.createdAt,
    };
  });
}

async function fetchLiveRaffles(): Promise<FetchRafflesResult> {
  try {
    const payload = await raffleFindAll(getServerApiConfig());
    const raffles = parseRaffleListItems(payload);

    return { ok: true, data: raffles };
  } catch (error) {
    return {
      ok: false,
      error: getApiErrorMessage(error, 'Could not load live raffles from the API.'),
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

export default async function Home() {
  const rafflesResult = await fetchLiveRaffles();
  const liveRaffles = rafflesResult.ok ? rafflesResult.data : [];
  const highlightedRaffle = liveRaffles[0] ?? null;
  const discoveryRaffles = liveRaffles.map((raffle) => ({
    id: raffle.id,
    title: raffle.title,
    description: raffle.description,
    imageUrls: raffle.imageUrls,
    ticketPrice: raffle.ticketPrice,
    ticketsSold: raffle.ticketsSold,
    totalTickets: raffle.totalTickets,
    endTime: raffle.endTime,
    createdAt: raffle.createdAt,
    status: raffle.status,
  }));

  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />

      <Container maxWidth="xl" sx={{ pt: { xs: 5, md: 8 }, px: { xs: 3, md: 4 } }}>
        <Stack >
   

          <Box component="section" id="featured-raffles" sx={sectionSurfaceSx}>
            {discoveryRaffles.length > 0 ? (
              <EnhancedHomepageRaffles
                raffles={discoveryRaffles}
                title="Discover live raffles"
                subtitle="Browse featured listings and sort by what matters most."
              />
            ) : (
              <Paper variant="outlined" sx={{ p: 4 }}>
                <Typography color="text.secondary">
                  {rafflesResult.ok
                    ? 'No raffles available yet. Seed data and come back to see live listings.'
                    : rafflesResult.error}
                </Typography>
              </Paper>
            )}
          </Box>

          <Box component="section" sx={sectionSurfaceSx}>
            <Paper
              sx={{
                ...sectionPanelSx,
                borderColor: alpha('#4F5D75', 0.24),
                background:
                  'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(79,93,117,0.07))',
              }}
            >
              <Stack spacing={2} sx={{ mb: 4 }}>
                <Typography variant="overline" sx={sectionEyebrowSx}>
                  How it works
                </Typography>
                <Typography variant="h2" sx={sectionTitleSx}>
                  A straightforward flow from listing to outcome.
                </Typography>
              </Stack>

              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
                {howItWorksSteps.map(({ step, title, description, icon: Icon, tone }) => {
                  const accent = toneColorByValue[tone];

                  return (
                  <Card key={title} sx={{ borderColor: alpha(accent, 0.28), bgcolor: alpha('#FFFFFF', 0.95) }}>
                    <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                      <Stack spacing={3}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="overline" sx={{ ...sectionEyebrowSx, color: accent }}>
                            Step {step}
                          </Typography>
                          <Box
                            sx={{
                              width: 46,
                              height: 46,
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: '50%',
                              bgcolor: alpha(accent, 0.13),
                              color: accent,
                              border: '1px solid',
                              borderColor: alpha(accent, 0.26),
                            }}
                          >
                            <Icon />
                          </Box>
                        </Stack>
                        <Typography variant="h5">{title}</Typography>
                        <Typography color="text.secondary">{description}</Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                )})}
              </Box>
            </Paper>
          </Box>

          <Box component="section" sx={sectionSurfaceSx}>
            <Paper
              sx={{
                ...sectionPanelSx,
                borderColor: alpha('#8C6A00', 0.22),
                background:
                  'linear-gradient(150deg, rgba(255,255,255,0.96), rgba(140,106,0,0.07), rgba(79,93,117,0.06))',
              }}
            >
              <Stack spacing={2} sx={{ mb: 4 }}>
                <Typography variant="overline" sx={sectionEyebrowSx}>
                  Built for both sides
                </Typography>
                <Typography variant="h2" sx={sectionTitleSx}>
                  Buyers gain clarity while sellers gain momentum.
                </Typography>
              </Stack>

              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
                {audiencePanels.map((panel) => {
                  const AccentIcon = panel.icon;
                  const accent = toneColorByValue[panel.tone];

                  return (
                    <Paper key={panel.title} sx={{ p: { xs: 4, md: 5 }, border: '1px solid', borderColor: alpha(accent, 0.26), bgcolor: alpha('#FFFFFF', 0.92) }}>
                      <Stack spacing={3}>
                        <Stack spacing={1}>
                          <Typography variant="overline" sx={{ ...sectionEyebrowSx, color: accent }}>
                            {panel.title}
                          </Typography>
                          <Typography variant="h5">{panel.description}</Typography>
                        </Stack>

                        <Stack spacing={2}>
                          {panel.bullets.map((bullet) => (
                            <Paper key={bullet} variant="outlined" sx={{ p: 3, borderColor: alpha(accent, 0.2) }}>
                              <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                                <Box
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    mt: 0.25,
                                    display: 'grid',
                                    placeItems: 'center',
                                    borderRadius: '50%',
                                    bgcolor: alpha(accent, 0.14),
                                    color: accent,
                                    flexShrink: 0,
                                  }}
                                >
                                  <AccentIcon fontSize="small" />
                                </Box>
                                <Typography color="text.secondary">{bullet}</Typography>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            </Paper>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
