'use client';

import { useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EnhancedRaffleCard, { type RaffleData } from './EnhancedRaffleCard';
import RaffleSortingControl, { type SortOption } from './RaffleSortingControl';

export interface RaffleGalleryProps {
  raffles: RaffleData[];
  sortBy?: SortOption;
  onSortChange?: (sortBy: SortOption) => void;
  onRaffleClick?: (raffleId: string) => void;
  title?: string;
  subtitle?: string;
  showSorting?: boolean;
}

/**
 * Sorting logic for raffles
 */
function sortRaffles(raffles: RaffleData[], sortBy: SortOption): RaffleData[] {
  const sorted = [...raffles];

  switch (sortBy) {
    case 'ending-soon':
      return sorted.sort((a, b) => {
        const endA = new Date(a.endTime).getTime();
        const endB = new Date(b.endTime).getTime();
        return endA - endB;
      });

    case 'created':
      return sorted.sort((a, b) => {
        const createdA = new Date(a.createdAt).getTime();
        const createdB = new Date(b.createdAt).getTime();
        return createdB - createdA;
      });

    case 'most-sold':
      return sorted.sort((a, b) => b.ticketsSold - a.ticketsSold);

    default:
      return sorted;
  }
}

/**
 * RaffleGallery - Displays raffles in a responsive grid with sorting
 *
 * Features:
 * - Responsive grid (1 col mobile, 2 tablet, 3-4 desktop)
 * - Sorting by: Ending Soon, Recently Created, Most Sold
 * - Enhanced raffle cards with status badges and progress
 * - Optimized with useMemo to prevent unnecessary re-renders
 * - Keyboard accessible sorting
 *
 * Usage:
 * ```
 * <RaffleGallery
 *   raffles={raffles}
 *   sortBy="ending-soon"
 *   onSortChange={(sort) => setSortBy(sort)}
 *   onRaffleClick={(id) => navigate(`/raffles/${id}`)}
 *   showSorting
 * />
 * ```
 */
export default function RaffleGallery({
  raffles,
  sortBy = 'ending-soon',
  onSortChange,
  onRaffleClick,
  title,
  subtitle,
  showSorting = true,
}: RaffleGalleryProps) {
  const sortedRaffles = useMemo(() => sortRaffles(raffles, sortBy), [raffles, sortBy]);

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      if (onSortChange) {
        onSortChange(newSort);
      }
    },
    [onSortChange]
  );

  const handleRaffleClick = useCallback(
    (raffleId: string) => {
      if (onRaffleClick) {
        onRaffleClick(raffleId);
      }
    },
    [onRaffleClick]
  );

  if (raffles.length === 0) {
    return (
      <Box
        sx={{
          py: { xs: 6, md: 8 },
          textAlign: 'center',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
          }}
        >
          No raffles available
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 1,
          }}
        >
          Check back soon for new raffle listings
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 4, md: 6 },
      }}
      role="region"
      aria-label={title || 'Raffle gallery'}
    >
      <Container maxWidth="lg">
        {/* Header */}
        {(title || subtitle) && (
          <Stack spacing={1} sx={{ mb: 4 }}>
            {title && (
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: '1.5rem', sm: '1.875rem' },
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Stack>
        )}

        {/* Sorting Control */}
        {showSorting && onSortChange && (
          <RaffleSortingControl sortBy={sortBy} onSortChange={handleSortChange} />
        )}

        {/* Results Count */}
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.8rem',
            mb: 2,
            display: 'block',
          }}
        >
          Showing {sortedRaffles.length} raffle{sortedRaffles.length !== 1 ? 's' : ''}
        </Typography>

        {/* Grid */}
        <Grid
          container
          spacing={{ xs: 2, md: 3 }}
          sx={{
            mb: 4,
          }}
        >
          {sortedRaffles.map((raffle) => (
            <Grid
              key={raffle.id}
              size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            >
              <EnhancedRaffleCard
                raffle={raffle}
                onClick={() => handleRaffleClick(raffle.id)}
              />
            </Grid>
          ))}
        </Grid>

        {/* Load More or Footer Message */}
        {sortedRaffles.length > 12 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 2,
              borderTop: (theme) => `1px solid ${theme.royale.surface.outline}`,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: '0.9rem',
              }}
            >
              Showing {sortedRaffles.length} of {sortedRaffles.length} raffles
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
}
