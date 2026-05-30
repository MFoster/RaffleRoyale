import type { Metadata } from 'next';
import LockRounded from '@mui/icons-material/LockRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { royaleTokens } from '@/design-system';
import AuthenticatedNotice from '@/components/AuthenticatedNotice';
import AppLink from '@/components/AppLink';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import LoginForm from '@/components/LoginForm';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: 4,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
          }}
        >
          <Card>
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={3}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: '50%',
                        bgcolor: alpha('#5B3DF5', 0.12),
                        color: 'primary.main',
                      }}
                    >
                      <LockRounded />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      Welcome back
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary">
                    Sign in to manage raffles, track purchases, and review your
                    account activity.
                  </Typography>
                </Stack>

                <AuthenticatedNotice context="login" />
                <LoginForm />
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <ImagePlaceholder
              minHeight={300}
              title="Login visual: authenticated user dashboard with active raffles and ticket summaries"
              caption="Use a polished dashboard scene that reassures returning users they can monitor purchases, listings, and status changes in one place."
            />
            <Card
              sx={{
                bgcolor: 'neutral.dark',
                color: 'common.white',
              }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Stack spacing={2}>
                  <Typography variant="h5" sx={{ color: 'common.white', fontWeight: 800 }}>
                    Inside your account
                  </Typography>
                  <Typography sx={{ color: alpha('#ffffff', 0.76) }}>
                    View your raffles, purchases, draw results, and upcoming
                    fulfillment steps without losing track of the details.
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>
                    <AppLink href="/register">Create a new account instead</AppLink>
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}
