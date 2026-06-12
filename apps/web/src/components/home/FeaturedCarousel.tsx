'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Container from '@mui/material/Container';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import EnhancedRaffleCard, { type RaffleData } from './EnhancedRaffleCard';

export interface FeaturedCarouselProps {
  raffles: RaffleData[];
  onRaffleClick?: (raffleId: string) => void;
  autoAdvanceIntervalMs?: number; // 8000 on desktop, undefined on mobile (manual only)
}

/**
 * FeaturedCarousel - Displays featured raffles in a carousel
 *
 * Features:
 * - Auto-advances every 8 seconds on tablet+ (can be disabled on mobile)
 * - Manual navigation with prev/next buttons
 * - Keyboard navigation (arrow keys)
 * - Responsive: single column on mobile, auto-advance only on larger screens
 * - Pagination indicators
 * - Smooth transitions
 *
 * Usage:
 * ```
 * <FeaturedCarousel
 *   raffles={raffles}
 *   onRaffleClick={(id) => navigate(`/raffles/${id}`)}
 *   autoAdvanceIntervalMs={8000}
 * />
 * ```
 */
export default function FeaturedCarousel({
  raffles,
  onRaffleClick,
  autoAdvanceIntervalMs = 8000,
}: FeaturedCarouselProps) {
  const theme = useTheme();
  const isTabletUp = useMediaQuery(theme.breakpoints.up('md'));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoAdvanceEnabled, setAutoAdvanceEnabled] = useState(true);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show auto-advance only on larger screens and when the user has left it on.
  const shouldAutoAdvance =
    isTabletUp && Boolean(autoAdvanceIntervalMs) && raffles.length > 1 && autoAdvanceEnabled;

  const visibleRaffles = useMemo(() => raffles.slice(0, 5), [raffles]);

  const totalSlides = visibleRaffles.length;

  // Reset auto-advance timer
  const resetAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
    }

    if (shouldAutoAdvance) {
      autoAdvanceTimerRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % totalSlides);
      }, autoAdvanceIntervalMs);
    }
  }, [shouldAutoAdvance, totalSlides, autoAdvanceIntervalMs]);

  // Initialize and cleanup auto-advance
  useEffect(() => {
    resetAutoAdvanceTimer();

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearInterval(autoAdvanceTimerRef.current);
      }
    };
  }, [resetAutoAdvanceTimer]);
  const pauseAutoAdvance = useCallback(() => {
    setAutoAdvanceEnabled(false);

    if (autoAdvanceTimerRef.current) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);
  
  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
    resetAutoAdvanceTimer();
  }, [totalSlides, resetAutoAdvanceTimer]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
    resetAutoAdvanceTimer();
  }, [totalSlides, resetAutoAdvanceTimer]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    },
    [handlePrevious, handleNext]
  );

  const handleCardClick = useCallback(
    (raffleId: string) => {
      if (onRaffleClick) {
        onRaffleClick(raffleId);
      }
    },
    [onRaffleClick]
  );

  if (visibleRaffles.length === 0) {
    return null;
  }

  const currentRaffle = visibleRaffles[currentIndex];
  const autoAdvanceCheckboxId = 'featured-raffles-auto-advance';



  return (
    <Box
      component="section"
      sx={{
        py: { xs: 4, md: 6 },
        backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.03),
      }}
      role="region"
      aria-label="Featured raffles carousel"
      onKeyDown={handleKeyDown}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 4,
          }}
        >
          <Stack spacing={0.5}>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.5rem', sm: '1.875rem' },
              }}
            >
              Featured Raffles
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.85rem', sm: '0.95rem' },
              }}
            >
              Check out our top picks
            </Typography>
          </Stack>

          {/* Navigation Buttons - Desktop only */}
          {visibleRaffles.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
              <IconButton
                onClick={handlePrevious}
                size="small"
                aria-label="Previous featured raffle"
                sx={{
                  border: (theme) => `1px solid ${theme.royale.surface.outline}`,
                  borderRadius: (theme) => theme.royale.radius.control,
                  '&:hover': {
                    backgroundColor: alpha('#17151F', 0.04),
                  },
                }}
              >
                <ChevronLeftRounded fontSize="small" />
              </IconButton>
              <IconButton
                onClick={handleNext}
                size="small"
                aria-label="Next featured raffle"
                sx={{
                  border: (theme) => `1px solid ${theme.royale.surface.outline}`,
                  borderRadius: (theme) => theme.royale.radius.control,
                  '&:hover': {
                    backgroundColor: alpha('#17151F', 0.04),
                  },
                }}
              >
                <ChevronRightRounded fontSize="small" />
              </IconButton>
            </Stack>
          )}
        </Stack>

        {/* Carousel */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr' },
            gap: { xs: 2, md: 3 },
          }}
        >
          <EnhancedRaffleCard
            raffle={currentRaffle}
            onClick={() => handleCardClick(currentRaffle.id)}
          />
        </Box>

        {/* Pagination and Controls */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            mt: 3,
            alignItems: { xs: 'center', sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          {/* Pagination Dots */}
          {visibleRaffles.length > 1 && (
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'center',
                justifyContent: { xs: 'center', sm: 'flex-start' },
              }}
            >
              {visibleRaffles.map((_, index) => (
                <ButtonBase
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    pauseAutoAdvance();
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={currentIndex === index ? 'page' : undefined}
                  sx={{
                    flex: '0 0 12px',
                    width: 12,
                    height: 12,
                    minWidth: 12,
                    minHeight: 12,
                    p: 0,
                    border: 0,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    backgroundColor:
                      currentIndex === index
                        ? 'primary.main'
                        : alpha('#17151F', 0.12),
                    '&:hover': {
                      backgroundColor:
                        currentIndex === index
                          ? 'primary.main'
                          : alpha('#17151F', 0.2),
                    },
                  }}
                />
              ))}
            </Box>
          )}

          {visibleRaffles.length > 1 && isTabletUp && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                justifyContent: 'flex-end',
                whiteSpace: 'nowrap',
              }}
            >
              <FormControlLabel
                label="Auto-advance"
                control={
                  <Checkbox
                    checked={autoAdvanceEnabled}
                    onChange={(_, checked) => {
                      setAutoAdvanceEnabled(checked);
                      if (!checked && autoAdvanceTimerRef.current) {
                        clearInterval(autoAdvanceTimerRef.current);
                        autoAdvanceTimerRef.current = null;
                      }
                    }}
                    slotProps={{ input: { id: autoAdvanceCheckboxId } }}
                  />
                }
                sx={{
                  m: 0,
                  gap: 0.5,
                  '& .MuiFormControlLabel-label': {
                    userSelect: 'none',
                  },
                }}
              />
            </Stack>
          )}

          {/* Mobile Navigation */}
          {visibleRaffles.length > 1 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                display: { xs: 'flex', sm: 'none' },
                width: '100%',
              }}
            >
              <Button
                onClick={handlePrevious}
                startIcon={<ChevronLeftRounded />}
                variant="outlined"
                sx={{ flex: 1 }}
              >
                Previous
              </Button>
              <Button
                onClick={handleNext}
                endIcon={<ChevronRightRounded />}
                variant="outlined"
                sx={{ flex: 1 }}
              >
                Next
              </Button>
            </Stack>
          )}

        </Stack>
      </Container>
    </Box>
  );
}
