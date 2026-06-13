'use client';

import { useSyncExternalStore } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import AppLink from './AppLink';
import {
  clearAuthSession,
  hasAuthSession,
  subscribeAuthSession,
} from '@/lib/auth-session';

export default function SiteHeader() {
  const router = useRouter();
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    hasAuthSession,
    () => false,
  );

  function handleSignOut() {
    clearAuthSession();
    router.push('/login');
  }

  return (
    <Container maxWidth="xl" sx={{ pt: 4 }}>
      <Stack
        component="header"
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <AppLink
          href="/"
          aria-label="Raffle Royale home"
          style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
        >
          <Image
            src="/RaffleRoyaleLogo.png"
            alt="Raffle Royale"
            width={230}
            height={70}
            priority
          />
        </AppLink>
        <Stack
          component="nav"
          direction="row"
          spacing={2}
          aria-label="Primary navigation"
        >
          {isAuthenticated ? (
            <>
              <Button href="/marketplace" color="inherit" size="large">
                Marketplace
              </Button>
              <Button href="/raffles/create" variant="contained" size="large">
                Create raffle
              </Button>
              <Button variant="outlined" color="inherit" size="large" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button href="/marketplace" color="inherit" size="large">
                Marketplace
              </Button>
              <Button href="/login" color="inherit" size="large">
                Log in
              </Button>
              <Button href="/register" variant="contained" size="large">
                Create account
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}
