import type { Metadata } from 'next';
import AddBoxRounded from '@mui/icons-material/AddBoxRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import ConfirmationNumberRounded from '@mui/icons-material/ConfirmationNumberRounded';
import Inventory2Rounded from '@mui/icons-material/Inventory2Rounded';
import VisibilityRounded from '@mui/icons-material/VisibilityRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EnhancedHomepageRaffles from '@/components/home/EnhancedHomepageRaffles';
import { alpha } from '@mui/material/styles';
import AppLink from '@/components/AppLink';
import PageContainer from '@/components/layout/PageContainer';
import Section from '@/components/layout/Section';
import SectionHeading from '@/components/layout/SectionHeading';
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

const toneColorByValue = {
  primary: '#5B3DF5',
  secondary: '#E5187A',
  tertiary: '#B97E00',
} as const;

const heroHighlights = [
  'Fixed ticket counts',
  'Live progress',
  'Transparent outcomes',
] as const;

const howItWorksSteps = [
  {
    step: '01',
    title: 'List a raffle',
    description:
      'Create a listing, define ticket count, and set price in a format buyers can scan quickly.',
    icon: AddBoxRounded,
    tone: 'primary',
    href: '/how-it-works/list-a-raffle',
  },
  {
    step: '02',
    title: 'Buy tickets',
    description:
      'Participants browse live listings, review progress, and purchase entries with clear visibility.',
    icon: ConfirmationNumberRounded,
    tone: 'secondary',
    href: '/how-it-works/buy-tickets',
  },
  {
    step: '03',
    title: 'Track outcome',
    description:
      'Raffles transition through explicit statuses so buyers and sellers can follow the result.',
    icon: AutorenewRounded,
    tone: 'tertiary',
    href: '/how-it-works/track-outcome',
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

export default async function Home() {
  const rafflesResult = await fetchLiveRaffles();
  const liveRaffles = rafflesResult.ok ? rafflesResult.data : [];
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
    <Box sx={{ pb: { xs: 6, md: 10 }, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />

      <PageContainer sx={{ pt: { xs: 4, md: 6 } }}>
        <Section spacing="normal" component="div" sx={{ pt: 0 }}>
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 4, md: 6 },
              gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' },
              alignItems: 'center',
            }}
          >
            <Stack spacing={3} sx={{ maxWidth: royaleTokens.layout.contentMeasure }}>
              <Typography variant="overline" sx={{ color: 'secondary.main', fontWeight: 700, letterSpacing: '0.08em' }}>
                Peer-to-peer raffle marketplace
              </Typography>
              <Typography variant="h1">
                Win standout gear through raffles you can actually trust.
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Browse live listings, buy tickets with full visibility into odds and
                progress, and follow every raffle through a clear, auditable outcome.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 0.5 }}>
                <Button
                  href="/marketplace"
                  variant="contained"
                  size="large"
                  startIcon={<StorefrontRounded />}
                >
                  Browse marketplace
                </Button>
                <Button href="/raffles/create" variant="outlined" size="large" startIcon={<AddBoxRounded />}>
                  Create a raffle
                </Button>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                {heroHighlights.map((highlight) => (
                  <Box
                    key={highlight}
                    sx={{
                      px: 2,
                      py: 0.75,
                      borderRadius: 999,
                      border: '1px solid',
                      borderColor: alpha('#5B3DF5', 0.2),
                      bgcolor: alpha('#5B3DF5', 0.06),
                      fontWeight: 600,
                      fontSize: '0.85rem',
                    }}
                  >
                    {highlight}
                  </Box>
                ))}
              </Stack>
            </Stack>

            <Paper
              sx={{
                display: { xs: 'none', md: 'block' },
                p: { md: 5 },
                border: '1px solid',
                borderColor: alpha('#5B3DF5', 0.18),
                background:
                  'linear-gradient(150deg, rgba(91,61,245,0.10), rgba(229,24,122,0.08), rgba(247,181,0,0.10))',
              }}
            >
              <Stack spacing={3}>
                {howItWorksSteps.map(({ step, title, description, icon: Icon, tone }) => {
                  const accent = toneColorByValue[tone];

                  return (
                    <Stack key={step} direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          flexShrink: 0,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          bgcolor: alpha(accent, 0.14),
                          color: accent,
                          border: '1px solid',
                          borderColor: alpha(accent, 0.28),
                        }}
                      >
                        <Icon />
                      </Box>
                      <Stack spacing={0.5}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {description}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                })}
              </Stack>
            </Paper>
          </Box>
        </Section>

        <Section component="div" id="featured-raffles" spacing="compact">
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
        </Section>

        <Section>
          <Paper
            sx={{
              p: { xs: 4, md: 6 },
              border: '1px solid',
              borderColor: royaleTokens.surface.outline,
              bgcolor: royaleTokens.surface.overlay,
              boxShadow: '0 4px 12px rgba(22, 18, 38, 0.08), 0 12px 32px rgba(22, 18, 38, 0.09)',
            }}
          >
            <Stack spacing={4}>
              <SectionHeading
                eyebrow="How it works"
                title="A straightforward flow from listing to outcome."
              />

              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
                {howItWorksSteps.map(({ step, title, description, icon: Icon, tone, href }) => {
                  const accent = toneColorByValue[tone];

                  return (
                    <Card key={title} sx={{ borderColor: alpha(accent, 0.28) }}>
                      <CardActionArea
                        component={AppLink}
                        href={href}
                        sx={{ height: '100%', borderRadius: 'inherit' }}
                      >
                        <CardContent sx={{ p: { xs: 4, md: 5 } }}>
                          <Stack spacing={3}>
                            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="overline" sx={{ color: accent, fontWeight: 700, letterSpacing: '0.08em' }}>
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
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: accent, fontWeight: 600 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                Learn more
                              </Typography>
                              <ArrowForwardRounded sx={{ fontSize: 18 }} />
                            </Stack>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            </Stack>
          </Paper>
        </Section>

        <Section>
          <Paper
            sx={{
              p: { xs: 4, md: 6 },
              border: '1px solid',
              borderColor: alpha('#E5187A', 0.2),
              background:
                'linear-gradient(150deg, rgba(255,255,255,0.96), rgba(229,24,122,0.06), rgba(91,61,245,0.06))',
            }}
          >
            <Stack spacing={4}>
              <SectionHeading
                eyebrow="Built for both sides"
                title="Buyers gain clarity while sellers gain momentum."
              />

              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' } }}>
                {audiencePanels.map((panel) => {
                  const AccentIcon = panel.icon;
                  const accent = toneColorByValue[panel.tone];

                  return (
                    <Paper key={panel.title} sx={{ p: { xs: 4, md: 5 }, border: '1px solid', borderColor: alpha(accent, 0.26) }}>
                      <Stack spacing={3}>
                        <Stack spacing={1}>
                          <Typography variant="overline" sx={{ color: accent, fontWeight: 700, letterSpacing: '0.08em' }}>
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
            </Stack>
          </Paper>
        </Section>
      </PageContainer>
    </Box>
  );
}
