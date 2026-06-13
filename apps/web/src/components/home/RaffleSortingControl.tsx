'use client';

import { useCallback } from 'react';
import TuneRounded from '@mui/icons-material/TuneRounded';
import FormControl from '@mui/material/FormControl';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export type SortOption = 'ending-soon' | 'created' | 'most-sold';

export interface RaffleSortingControlProps {
  sortBy: SortOption;
  onSortChange: (sortBy: SortOption) => void;
}

/**
 * RaffleSortingControl - Dropdown to sort raffles
 *
 * Options:
 * - Ending Soon: Sort by time until end (ascending)
 * - Recently Created: Sort by creation date (descending)
 * - Most Sold: Sort by tickets sold (descending)
 *
 * Usage:
 * ```
 * <RaffleSortingControl
 *   sortBy="ending-soon"
 *   onSortChange={(sort) => setSortBy(sort)}
 * />
 * ```
 */
export default function RaffleSortingControl({
  sortBy,
  onSortChange,
}: RaffleSortingControlProps) {
  const handleChange = useCallback(
    (value: string) => {
      onSortChange(value as SortOption);
    },
    [onSortChange]
  );

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      sx={{
        alignItems: { xs: 'flex-start', sm: 'center' },
        mb: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          color: 'text.secondary',
          fontSize: '0.95rem',
          fontWeight: 600,
        }}
      >
        <TuneRounded fontSize="small" />
        Sort by:
      </Box>

      <FormControl
        size="small"
        sx={{
          minWidth: { xs: '100%', sm: 200 },
        }}
      >
        <Select
          value={sortBy}
          onChange={(e) => handleChange(e.target.value)}
          variant="outlined"
          sx={{
            fontSize: '0.95rem',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme) => theme.royale.surface.outline,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: (theme) => theme.royale.surface.outline,
            },
          }}
        >
          <MenuItem value="ending-soon">Ending Soon</MenuItem>
          <MenuItem value="created">Recently Created</MenuItem>
          <MenuItem value="most-sold">Most Sold</MenuItem>
        </Select>
      </FormControl>
    </Stack>
  );
}
