'use client';

import { useCallback, useEffect } from 'react';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface SuccessToastProps {
  open: boolean;
  title: string;
  message: string;
  actionLabel?: string;
  actionPath?: string;
  onClose: () => void;
  onAction?: () => void;
  duration?: number; // ms, default 5000
}

/**
 * SuccessToast - A reusable toast notification for successful actions
 *
 * Features:
 * - Auto-dismiss after configurable duration (default 5s)
 * - Optional action button that can navigate or trigger callback
 * - Manual close button
 * - Responsive: full-width on mobile, fixed width on desktop
 * - Accessibility: role="alert", aria-live="polite"
 * - Success icon with theme colors
 *
 * Usage:
 * ```
 * const { state, show } = useSuccessToast();
 * // ... later ...
 * show({
 *   title: '✅ Raffle Created!',
 *   message: 'Your raffle is now live and accepting entries.',
 *   actionLabel: 'View My Raffles',
 *   actionPath: '/dashboard#my-raffles'
 * });
 * ```
 */
export default function SuccessToast({
  open,
  title,
  message,
  actionLabel,
  actionPath,
  onClose,
  onAction,
  duration = 5000,
}: SuccessToastProps) {
  // Auto-dismiss after duration
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [open, duration, onClose]);

  const handleActionClick = useCallback(() => {
    if (actionPath) {
      window.location.assign(actionPath);
    } else if (onAction) {
      onAction();
    }
    onClose();
  }, [actionPath, onAction, onClose]);

  return (
    <Snackbar
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      autoHideDuration={duration}
      disableWindowBlurListener
      sx={{
        '& .MuiSnackbarContent-root': {
          backgroundColor: 'transparent',
          boxShadow: 'none',
        },
      }}
    >
      <Box
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          display: 'flex',
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
          maxWidth: { xs: '100%', sm: 400 },
          backgroundColor: '#FFFFFF',
          borderRadius: (theme) => theme.royale.radius.card,
          border: `1px solid ${alpha('#0B6B4B', 0.1)}`,
          boxShadow: `0 4px 12px ${alpha('#17151F', 0.1)}, 0 8px 24px ${alpha('#17151F', 0.08)}`,
          overflow: 'hidden',
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            width: '100%',
            p: { xs: 2, sm: 2.5 },
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
        >
          {/* Icon + Content */}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              flex: 1,
              alignItems: 'flex-start',
              pt: { xs: 0.5, sm: 0 },
            }}
          >
            {/* Success Icon */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 24,
                mt: 0.25,
              }}
            >
              <CheckCircleRounded
                sx={{
                  color: '#0B6B4B',
                  fontSize: '1.5rem',
                }}
              />
            </Box>

            {/* Text Content */}
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                {title}
              </Typography>
              {message && (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                  }}
                >
                  {message}
                </Typography>
              )}
            </Stack>
          </Stack>

          {/* Action Area */}
          <Stack
            direction={{ xs: 'row', sm: 'column' }}
            spacing={0.5}
            sx={{
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'space-between', sm: 'flex-end' },
              alignItems: 'center',
            }}
          >
            {/* Action Button or Spacer */}
            {actionLabel || onAction ? (
              <Button
                size="small"
                variant="text"
                color="primary"
                onClick={handleActionClick}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  minHeight: 'auto',
                  px: 1,
                  py: 0.75,
                  '&:hover': {
                    backgroundColor: alpha('#5B3DF5', 0.08),
                  },
                }}
              >
                {actionLabel || 'Action'}
              </Button>
            ) : null}

            {/* Close Button */}
            <IconButton
              size="small"
              onClick={onClose}
              aria-label="Dismiss success message"
              sx={{
                color: 'text.secondary',
                minHeight: 'auto',
                minWidth: 'auto',
                p: 0.25,
                '&:hover': {
                  backgroundColor: alpha('#17151F', 0.08),
                },
              }}
            >
              <CloseRounded fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>
      </Box>
    </Snackbar>
  );
}
