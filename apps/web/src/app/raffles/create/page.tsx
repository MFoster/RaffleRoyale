import type { Metadata } from 'next';
import AddCircleRounded from '@mui/icons-material/AddCircleRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import CreateRaffleForm from '@/components/CreateRaffleForm';
import ImagePlaceholder from '@/components/ImagePlaceholder';
import SiteHeader from '@/components/SiteHeader';
import { royaleTokens } from '@/design-system';

export const metadata: Metadata = {
  title: 'Create raffle',
};

export default function CreateRafflePage() {
  return (
    <Box sx={{ pb: 8, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 8 }, px: { xs: 3, md: 4 } }}>
        <Box
          sx={{
            display: 'grid',
            gap: 4,
            alignItems: 'stretch',
            gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
          }}
        >
          <Card>
            <CardContent sx={{ p: { xs: 4, md: 5 } }}>
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
                      <AddCircleRounded />
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      Create a raffle
                    </Typography>
                  </Stack>
                  <Typography color="text.secondary">
                    Configure your listing, ticket structure, and timeline. Buyers
                    will see this as soon as it is active.
                  </Typography>
                </Stack>

                <CreateRaffleForm />
              </Stack>
            </CardContent>
          </Card>

          <Stack spacing={3}>
            <ImagePlaceholder
              minHeight={320}
              title="Raffle creation visual: seller setting title, ticket count, and pricing"
              caption="Replace with product imagery and creation-flow screenshots for stronger trust and conversion."
            />
            <Card sx={{ background: royaleTokens.surface.spotlightGradient }}>
              <CardContent sx={{ p: 4 }}>
                <Stack spacing={1.5}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Creation tips
                  </Typography>
                  <Typography color="text.secondary">
                    Use clear titles, transparent pricing, and realistic durations.
                    Better listing quality improves buyer confidence and ticket sales.
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
