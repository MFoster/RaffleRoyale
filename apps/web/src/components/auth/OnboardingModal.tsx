'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AddBoxRounded from '@mui/icons-material/AddBoxRounded';
import ConfirmationNumberRounded from '@mui/icons-material/ConfirmationNumberRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface OnboardingModalProps {
  open: boolean;
  onBrowseRaffles: () => void;
  onCreateRaffle: () => void;
  onClose: () => void;
}

/**
 * OnboardingModal - Displayed after successful signup to guide users to their first action.
 * Shows a modal with two equal-width CTAs:
 * - Enter a Raffle (browse existing raffles)
 * - Create a Raffle (create a new raffle)
 *
 * Accessibility:
 * - Dialog provides automatic focus trap
 * - X button has aria-label
 * - Semantic HTML structure for screen readers
 * - Keyboard navigation (Tab cycles through buttons, Escape to close)
 * - WCAG AA color contrast compliant
 */
export default function OnboardingModal({
  open,
  onBrowseRaffles,
  onCreateRaffle,
  onClose,
}: OnboardingModalProps) {
  const router = useRouter();

  const handleBrowse = useCallback(() => {
    onBrowseRaffles();
    router.push('/raffles');
  }, [onBrowseRaffles, router]);

  const handleCreate = useCallback(() => {
    onCreateRaffle();
    router.push('/raffles/create');
  }, [onCreateRaffle, router]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: (theme) => theme.royale.radius.card,
            backgroundImage: 'none',
          },
        },
        backdrop: {
          sx: {
            backgroundColor: alpha('#17151F', 0.5),
          },
        },
      }}
    >
      {/* Close button */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1,
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="Close onboarding modal"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: alpha('#17151F', 0.08),
            },
          }}
        >
          <CloseRounded fontSize="medium" />
        </IconButton>
      </Box>

      <DialogContent
        sx={{
          pt: { xs: 6, sm: 8 },
          pb: { xs: 4, sm: 6 },
          px: { xs: 3, sm: 4 },
        }}
      >
        <Stack spacing={4}>
          {/* Header */}
          <Stack spacing={1.5} sx={{ textAlign: 'center' }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.875rem', sm: '2.125rem' },
              }}
            >
              Welcome to Raffle Royale!
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                fontSize: { xs: '0.95rem', sm: '1rem' },
              }}
            >
              Choose your next step
            </Typography>
          </Stack>

          {/* CTA Buttons */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{
              pt: 1,
            }}
          >
            {/* Browse Raffles Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleBrowse}
              fullWidth
              startIcon={<ConfirmationNumberRounded />}
              sx={{
                minHeight: 56,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Enter a Raffle
            </Button>

            {/* Create Raffle Button */}
            <Button
              variant="contained"
              color="primary"
              onClick={handleCreate}
              fullWidth
              startIcon={<AddBoxRounded />}
              sx={{
                minHeight: 56,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              Create a Raffle
            </Button>
          </Stack>

          {/* Subtext */}
          <Typography
            variant="caption"
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.85rem',
              pt: 1,
            }}
          >
            You can also close this and explore later from your dashboard
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
