'use client';

import Chip from '@mui/material/Chip';
import type { ChipProps } from '@mui/material/Chip';

export type StatusBadgeType = 'ending-soon' | 'new' | 'hot';

interface StatusBadgeConfig {
  label: string;
  icon?: string;
  color: ChipProps['color'];
}

const badgeConfigs: Record<StatusBadgeType, StatusBadgeConfig> = {
  'ending-soon': {
    label: '⏰ Ending Soon',
    color: 'error',
  },
  'new': {
    label: '✨ New',
    color: 'info',
  },
  'hot': {
    label: '🔥 Hot',
    color: 'warning',
  },
};

export interface StatusBadgeProps {
  type: StatusBadgeType;
  variant?: 'filled' | 'outlined';
  size?: 'small' | 'medium';
}

/**
 * StatusBadge - Visual indicator for raffle status
 *
 * Shows status of a raffle with color-coded chips:
 * - Red (Ending Soon): Less than 24 hours remaining
 * - Blue (New): Created within last 3 days
 * - Orange (Hot): 75%+ tickets sold
 *
 * Usage:
 * ```
 * <StatusBadge type="ending-soon" />
 * <StatusBadge type="new" size="small" />
 * <StatusBadge type="hot" variant="outlined" />
 * ```
 */
export default function StatusBadge({
  type,
  variant = 'filled',
  size = 'medium',
}: StatusBadgeProps) {
  const config = badgeConfigs[type];

  if (!config) {
    return null;
  }

  return (
    <Chip
      label={config.label}
      color={config.color}
      variant={variant}
      size={size}
      sx={{
        fontWeight: 600,
        fontSize: size === 'small' ? '0.75rem' : '0.875rem',
        height: 'auto',
        '& .MuiChip-label': {
          px: size === 'small' ? 1 : 1.25,
          py: size === 'small' ? 0.5 : 0.75,
        },
      }}
    />
  );
}

/**
 * Helper function to determine status badge type based on raffle data
 */
export function getStatusBadgeType(
  endTime: Date,
  createdAt: Date,
  ticketsSold: number,
  totalTickets: number
): StatusBadgeType | null {
  // Check if ending soon (< 24 hours)
  const hoursUntilEnd = (endTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
  if (hoursUntilEnd <= 24 && hoursUntilEnd > 0) {
    return 'ending-soon';
  }

  // Check if new (< 3 days old)
  const daysSince = (new Date().getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince <= 3) {
    return 'new';
  }

  // Check if hot (75%+ tickets sold)
  const percentageSold = (ticketsSold / totalTickets) * 100;
  if (percentageSold >= 75) {
    return 'hot';
  }

  return null;
}
