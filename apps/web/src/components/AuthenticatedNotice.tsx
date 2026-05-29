'use client';

import { useSyncExternalStore } from 'react';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AppLink from '@/components/AppLink';
import { hasAuthSession, subscribeAuthSession } from '@/lib/auth-session';

type AuthenticatedNoticeProps = {
  context: 'login' | 'register';
};

export default function AuthenticatedNotice({ context }: AuthenticatedNoticeProps) {
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    hasAuthSession,
    () => false,
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Alert severity="info" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
      <Stack spacing={1}>
        <Typography sx={{ fontWeight: 700 }}>
          You are already authenticated.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {context === 'login'
            ? 'You are already signed in, so you can continue browsing raffles or create a new listing.'
            : 'You are already signed in, so you do not need to create another account right now.'}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Typography variant="body2">
            <AppLink href="/">Go to homepage</AppLink>
          </Typography>
          <Typography variant="body2">
            <AppLink href="/raffles/create">Create raffle</AppLink>
          </Typography>
        </Stack>
      </Stack>
    </Alert>
  );
}
