'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import SearchRounded from '@mui/icons-material/SearchRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import ClearRounded from '@mui/icons-material/ClearRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import EnhancedRaffleCard, { type RaffleData } from '../home/EnhancedRaffleCard';

type MarketplaceStatusFilter = 'all' | 'DRAFT' | 'ACTIVE' | 'SOLD_OUT' | 'EXPIRED' | 'DISBANDED' | 'COMPLETED';
type MarketplaceItemTypeFilter = 'all' | 'PHYSICAL' | 'DIGITAL';
type MarketplaceSortOption = 'ending-soon' | 'newest' | 'most-sold' | 'price-low' | 'price-high';
type MarketplaceRaffleData = RaffleData & {
  itemType: Exclude<MarketplaceItemTypeFilter, 'all'>;
};

const statusLabelByValue: Record<Exclude<MarketplaceStatusFilter, 'all'>, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SOLD_OUT: 'Sold out',
  EXPIRED: 'Expired',
  DISBANDED: 'Disbanded',
  COMPLETED: 'Completed',
};

const itemTypeLabelByValue: Record<Exclude<MarketplaceItemTypeFilter, 'all'>, string> = {
  PHYSICAL: 'Physical',
  DIGITAL: 'Digital',
};

const sortLabelByValue: Record<MarketplaceSortOption, string> = {
  'ending-soon': 'Ending soon',
  newest: 'Newest',
  'most-sold': 'Most sold',
  'price-low': 'Price: low to high',
  'price-high': 'Price: high to low',
};

function formatCurrencyFromMinorUnits(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

function sortRaffles(raffles: RaffleData[], sortBy: MarketplaceSortOption): RaffleData[] {
  const sorted = [...raffles];

  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'most-sold':
      return sorted.sort((a, b) => b.ticketsSold - a.ticketsSold);
    case 'price-low':
      return sorted.sort((a, b) => a.ticketPrice - b.ticketPrice);
    case 'price-high':
      return sorted.sort((a, b) => b.ticketPrice - a.ticketPrice);
    case 'ending-soon':
    default:
      return sorted.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime());
  }
}

export interface MarketplaceBrowserProps {
  raffles: MarketplaceRaffleData[];
  onRaffleClick?: (raffleId: string) => void;
}

export default function MarketplaceBrowser({ raffles, onRaffleClick }: MarketplaceBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MarketplaceStatusFilter>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState<MarketplaceItemTypeFilter>('all');
  const [sortBy, setSortBy] = useState<MarketplaceSortOption>('ending-soon');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [onlyWithImages, setOnlyWithImages] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const priceBounds = useMemo(() => {
    if (raffles.length === 0) {
      return [0, 0] as const;
    }

    return raffles.reduce(
      (bounds, raffle) => [Math.min(bounds[0], raffle.ticketPrice), Math.max(bounds[1], raffle.ticketPrice)] as const,
      [raffles[0].ticketPrice, raffles[0].ticketPrice] as const,
    );
  }, [raffles]);

  useEffect(() => {
    setPriceRange([priceBounds[0], priceBounds[1]]);
  }, [priceBounds]);

  const filteredRaffles = useMemo(() => {
    const nextRaffles = raffles.filter((raffle) => {
      const searchableText = [raffle.title, raffle.description, raffle.creatorName]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase();

      const matchesSearch = deferredSearchQuery.length === 0 || searchableText.includes(deferredSearchQuery);
      const matchesStatus = statusFilter === 'all' || raffle.status === statusFilter;
      const matchesItemType = itemTypeFilter === 'all' || raffle.itemType === itemTypeFilter;
      const matchesPrice = raffle.ticketPrice >= priceRange[0] && raffle.ticketPrice <= priceRange[1];
      const matchesImages = !onlyWithImages || raffle.imageUrls.length > 0;

      return matchesSearch && matchesStatus && matchesItemType && matchesPrice && matchesImages;
    });

    return sortRaffles(nextRaffles, sortBy);
  }, [deferredSearchQuery, itemTypeFilter, onlyWithImages, priceRange, raffles, sortBy, statusFilter]);

  const activeFilterCount = [
    deferredSearchQuery.length > 0,
    statusFilter !== 'all',
    itemTypeFilter !== 'all',
    onlyWithImages,
    priceRange[0] !== priceBounds[0] || priceRange[1] !== priceBounds[1],
  ].filter(Boolean).length;

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setItemTypeFilter('all');
    setSortBy('ending-soon');
    setOnlyWithImages(false);
    setPriceRange([priceBounds[0], priceBounds[1]]);
  }, [priceBounds]);

  const handlePriceRangeChange = useCallback((_event: Event, value: number | number[]) => {
    if (Array.isArray(value)) {
      setPriceRange([value[0], value[1]]);
    }
  }, []);

  return (
    <Box component="section" sx={{ py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <Stack spacing={4}>
          <Stack spacing={1.5} sx={{ maxWidth: 900 }}>
            <Chip
              label="Marketplace"
              color="tertiary"
              variant="filled"
              sx={{ alignSelf: 'flex-start', fontWeight: 700, color: 'tertiary.contrastText' }}
            />
            <Typography variant="h1" component="h1" sx={{ maxWidth: 12 * 16 }}>
              Find the raffles you are looking for.
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" sx={{ maxWidth: 760 }}>
              Search live listings from one place, then narrow the field with advanced filters for status, item type, ticket price, and image availability.
            </Typography>
          </Stack>

          <TextField
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search raffles, prizes, descriptions, or creators"
            autoComplete="off"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ maxWidth: 820 }}
          />

          <Box
            sx={{
              display: 'grid',
              gap: { xs: 3, lg: 4 },
              gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
              alignItems: 'start',
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                position: { lg: 'sticky' },
                top: { lg: 24 },
                borderColor: (theme) => theme.royale.surface.outline,
                background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,244,248,0.96))',
              }}
            >
              <Stack spacing={3}>
                <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary', fontWeight: 700 }}>
                    <TuneRounded fontSize="small" />
                    Advanced filters
                  </Box>
                  <Button onClick={clearFilters} size="small" variant="text" startIcon={<ClearRounded />}>
                    Clear
                  </Button>
                </Stack>

                <FormControl size="small" fullWidth>
                  <InputLabel id="marketplace-sort-label">Sort by</InputLabel>
                  <Select
                    labelId="marketplace-sort-label"
                    value={sortBy}
                    label="Sort by"
                    onChange={(event) => setSortBy(event.target.value as MarketplaceSortOption)}
                  >
                    {Object.entries(sortLabelByValue).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel id="marketplace-status-label">Status</InputLabel>
                  <Select
                    labelId="marketplace-status-label"
                    value={statusFilter}
                    label="Status"
                    onChange={(event) => setStatusFilter(event.target.value as MarketplaceStatusFilter)}
                  >
                    <MenuItem value="all">All statuses</MenuItem>
                    {Object.entries(statusLabelByValue).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl size="small" fullWidth>
                  <InputLabel id="marketplace-type-label">Item type</InputLabel>
                  <Select
                    labelId="marketplace-type-label"
                    value={itemTypeFilter}
                    label="Item type"
                    onChange={(event) => setItemTypeFilter(event.target.value as MarketplaceItemTypeFilter)}
                  >
                    <MenuItem value="all">All item types</MenuItem>
                    {Object.entries(itemTypeLabelByValue).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box>
                  <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Ticket price
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatCurrencyFromMinorUnits(priceRange[0])} - {formatCurrencyFromMinorUnits(priceRange[1])}
                    </Typography>
                  </Stack>
                  <Slider
                    value={priceRange}
                    onChange={handlePriceRangeChange}
                    min={priceBounds[0]}
                    max={priceBounds[1]}
                    disabled={priceBounds[0] === priceBounds[1]}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => formatCurrencyFromMinorUnits(Number(value))}
                  />
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyWithImages}
                      onChange={(_, checked) => setOnlyWithImages(checked)}
                    />
                  }
                  label="Only listings with images"
                />

                <Divider />

                <Stack spacing={1}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Active filters
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activeFilterCount === 0
                      ? 'No filters are active.'
                      : `${String(activeFilterCount)} filter${activeFilterCount === 1 ? '' : 's'} active.`}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>

            <Stack spacing={2.5}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Typography variant="h5" component="h2" sx={{ fontWeight: 800 }}>
                  Browse results
                </Typography>
                <Chip label={`${String(filteredRaffles.length)} result${filteredRaffles.length === 1 ? '' : 's'}`} color="primary" variant="outlined" />
              </Stack>

              {filteredRaffles.length === 0 ? (
                <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 } }}>
                  <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      No raffles match those filters
                    </Typography>
                    <Typography color="text.secondary">
                      Try widening the price range, clearing the image filter, or searching for a different prize.
                    </Typography>
                    <Button onClick={clearFilters} variant="contained" sx={{ alignSelf: 'flex-start' }}>
                      Reset filters
                    </Button>
                  </Stack>
                </Paper>
              ) : (
                <Grid container spacing={{ xs: 2, md: 3 }}>
                  {filteredRaffles.map((raffle) => (
                    <Grid key={raffle.id} size={{ xs: 12, sm: 6, md: 4 }}>
                      <EnhancedRaffleCard raffle={raffle} onClick={() => onRaffleClick?.(raffle.id)} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}