import type { Metadata } from 'next';
import PersonAddAltRounded from '@mui/icons-material/PersonAddAltRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { royaleTokens } from '@/design-system';
import AuthenticatedNotice from '@/components/AuthenticatedNotice';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import RegisterForm from '@/components/RegisterForm';
import SiteHeader from '@/components/SiteHeader';

export const metadata: Metadata = {
  title: 'Register',
};

export default function RegisterPage() {
  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: 4,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: '1fr', lg: '0.95fr 1.05fr' },
          }}
        >
          <Stack spacing={3}>
            <ImagePlaceholder
              minHeight={320}
              title="Registration visual: new seller creating a premium raffle from a phone and laptop setup"
              caption="Show the start of the creator journey with strong product photography, clean UI, and a premium workspace mood."
            />
            <Card
              sx={{ background: royaleTokens.surface.spotlightGradient }}
            >
              <CardContent sx={{ p: 3.5 }}>
                <Stack spacing={1.5}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Create your identity hub
                  </Typography>
                  <Typography color="text.secondary">
                    Registration is the first step toward listing raffles,
                    purchasing tickets, and later completing verification and
                    fulfillment details.
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Stack>

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
                      <PersonAddAltRounded />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      Create your account
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary">
                    Get started as a buyer, raffler, or both. Verification and
                    profile depth can follow after account creation.
                  </Typography>
                </Stack>

                <AuthenticatedNotice context="register" />
                <RegisterForm />
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
