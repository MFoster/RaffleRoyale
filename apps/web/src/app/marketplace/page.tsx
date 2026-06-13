import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SiteHeader from '@/components/SiteHeader';
import MarketplaceBrowser from '@/components/marketplace/MarketplaceBrowser';
import type { RaffleData } from '@/components/home/EnhancedRaffleCard';
import { royaleTokens } from '@/design-system';
import { raffleFindAll } from '@/generated/clients';
import { getApiErrorMessage, getServerApiConfig } from '@/lib/generated-api';

export const metadata: Metadata = {
  title: 'Marketplace',
};

export const dynamic = 'force-dynamic';

type RaffleStatus = 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'EXPIRED' | 'DISBANDED' | 'COMPLETED';
type RaffleItemType = 'PHYSICAL' | 'DIGITAL';
type MarketplaceRaffleData = RaffleData & { itemType: RaffleItemType };

type FetchMarketplaceRafflesResult =
  | { ok: true; data: MarketplaceRaffleData[] }
  | { ok: false; error: string };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMarketplaceRaffles(payload: unknown): MarketplaceRaffleData[] {
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
      throw new Error(`Raffle at index ${String(index)} has an unexpected response shape.`);
    }

    return {
      id: raw.id,
      title: raw.title,
      description: typeof raw.description === 'string' ? raw.description : null,
      imageUrls:
        Array.isArray(raw.imageUrls) && raw.imageUrls.every((value) => typeof value === 'string')
          ? raw.imageUrls
          : [],
      ticketPrice: raw.ticketPrice,
      ticketsSold: raw.ticketsSold,
      totalTickets: raw.totalTickets,
      endTime: raw.endTime,
      createdAt: raw.createdAt,
      status,
      itemType,
    };
  });
}

async function fetchMarketplaceRaffles(): Promise<FetchMarketplaceRafflesResult> {
  try {
    const payload = await raffleFindAll(getServerApiConfig());
    return { ok: true, data: parseMarketplaceRaffles(payload) };
  } catch (error) {
    return {
      ok: false,
      error: getApiErrorMessage(error, 'Could not load marketplace listings from the API.'),
    };
  }
}

export default async function MarketplacePage() {
  const rafflesResult = await fetchMarketplaceRaffles();

  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <Stack spacing={4}>
        {rafflesResult.ok ? (
          <MarketplaceBrowser raffles={rafflesResult.data} />
        ) : (
          <Box component="section" sx={{ py: { xs: 4, md: 6 } }}>
            <Paper variant="outlined" sx={{ maxWidth: 720, mx: 'auto', p: { xs: 3, md: 4 } }}>
              <Stack spacing={1.5}>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>
                  Marketplace unavailable
                </Typography>
                <Typography color="text.secondary">{rafflesResult.error}</Typography>
              </Stack>
            </Paper>
          </Box>
        )}
      </Stack>
    </Box>
  );
}