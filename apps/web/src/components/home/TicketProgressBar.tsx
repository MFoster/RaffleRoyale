'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface TicketProgressBarProps {
  ticketsSold: number;
  totalTickets: number;
  showPercentage?: boolean;
  showLabel?: boolean;
}

/**
 * TicketProgressBar - Visual representation of ticket sales progress
 *
 * Shows a linear progress bar with optional percentage label
 *
 * Usage:
 * ```
 * <TicketProgressBar ticketsSold={87} totalTickets={100} showPercentage showLabel />
 * ```
 */
export default function TicketProgressBar({
  ticketsSold,
  totalTickets,
  showPercentage = true,
  showLabel = true,
}: TicketProgressBarProps) {
  const percentage = Math.min(100, Math.round((ticketsSold / totalTickets) * 100));

  return (
    <Stack spacing={0.75}>
      {showLabel && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Tickets Sold
          </Typography>
          {showPercentage && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                fontSize: '0.8rem',
              }}
            >
              {percentage}%
            </Typography>
          )}
        </Box>
      )}

      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: alpha('#17151F', 0.06),
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            backgroundColor: '#0B6B4B',
            backgroundImage: `linear-gradient(90deg, #0B6B4B 0%, #0D8659 100%)`,
          },
        }}
      />

      {showLabel && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontSize: '0.75rem',
          }}
        >
          {ticketsSold} of {totalTickets} tickets
        </Typography>
      )}
    </Stack>
  );
}
