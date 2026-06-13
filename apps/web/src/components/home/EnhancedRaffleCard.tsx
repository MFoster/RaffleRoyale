'use client';

import { useMemo } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { alpha } from '@mui/material/styles';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import StatusBadge, { getStatusBadgeType } from './StatusBadge';
import TicketProgressBar from './TicketProgressBar';
import { formatTimeUntilEnd, formatPrice, truncateText } from '@/lib/raffleFormatters';

export interface RaffleData {
  id: string;
  title: string;
  description?: string | null;
  imageUrls: string[];
  creatorName?: string;
  creatorImage?: string;
  ticketPrice: number;
  ticketsSold: number;
  totalTickets: number;
  endTime: string | Date;
  createdAt: string | Date;
  status: string;
}

export interface EnhancedRaffleCardProps {
  raffle: RaffleData;
  onClick?: () => void;
}

/**
 * EnhancedRaffleCard - Displays raffle information with enhanced UX
 *
 * Features:
 * - Image with placeholder fallback
 * - Status badge (Ending Soon, New, Hot)
 * - Ticket progress bar
 * - Time remaining indicator
 * - Responsive design
 * - Hover effects
 * - Creator information
 *
 * Usage:
 * ```
 * <EnhancedRaffleCard
 *   raffle={raffleData}
 *   onClick={() => navigate(`/raffles/${raffleData.id}`)}
 * />
 * ```
 */
export default function EnhancedRaffleCard({
  raffle,
  onClick,
}: EnhancedRaffleCardProps) {
  const statusBadgeType = useMemo(
    () =>
      getStatusBadgeType(
        new Date(raffle.endTime),
        new Date(raffle.createdAt),
        raffle.ticketsSold,
        raffle.totalTickets
      ),
    [raffle.endTime, raffle.createdAt, raffle.ticketsSold, raffle.totalTickets]
  );

  const timeRemaining = useMemo(
    () => formatTimeUntilEnd(raffle.endTime),
    [raffle.endTime]
  );

  const imageUrl = raffle.imageUrls?.[0];

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: (theme) =>
          theme.transitions.create(['box-shadow', 'transform'], {
            duration: 200,
          }),
        '&:hover': onClick
          ? {
              boxShadow: `0 12px 32px ${alpha('#17151F', 0.12)}, 0 20px 48px ${alpha('#17151F', 0.1)}`,
              transform: 'translateY(-2px)',
            }
          : {},
      }}
    >
      {/* Image Container */}
      <Box
        sx={{
          position: 'relative',
          paddingBottom: '66.67%', // 3:2 aspect ratio
          overflow: 'hidden',
          backgroundColor: alpha('#17151F', 0.04),
        }}
      >
        {imageUrl ? (
          <CardMedia
            component="img"
            image={imageUrl}
            alt={raffle.title}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha('#5B3DF5', 0.08),
            }}
          >
            <ImagePlaceholder
              minHeight={300}
              title={raffle.title}
              caption="Raffle image"
            />
          </Box>
        )}

        {/* Status Badge - Positioned Absolute */}
        {statusBadgeType && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1,
            }}
          >
            <StatusBadge type={statusBadgeType} size="small" />
          </Box>
        )}
      </Box>

      {/* Content */}
      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          pb: 2,
        }}
      >
        {/* Title */}
        <Stack spacing={0.5}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '0.95rem', sm: '1rem' },
              color: 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {raffle.title}
          </Typography>

          {/* Creator Info */}
          {raffle.creatorName && (
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.8rem',
              }}
            >
              by {truncateText(raffle.creatorName, 20)}
            </Typography>
          )}
        </Stack>

        {/* Price and Time */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontWeight: 700,
              color: 'primary.main',
              fontSize: { xs: '0.9rem', sm: '0.95rem' },
            }}
          >
            {formatPrice(raffle.ticketPrice)} per ticket
          </Typography>

          <Chip
            label={timeRemaining}
            size="small"
            variant="outlined"
            sx={{
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 600,
              borderColor: alpha('#17151F', 0.12),
              backgroundColor: alpha('#17151F', 0.02),
              '& .MuiChip-label': {
                px: 0.75,
              },
            }}
          />
        </Box>

        {/* Ticket Progress */}
        <Box sx={{ mt: 1 }}>
          <TicketProgressBar
            ticketsSold={raffle.ticketsSold}
            totalTickets={raffle.totalTickets}
            showPercentage
            showLabel={false}
          />
        </Box>

        {/* Description (if available) */}
        {raffle.description && (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              mt: 0.5,
            }}
          >
            {raffle.description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
