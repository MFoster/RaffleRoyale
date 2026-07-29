import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import StorefrontRounded from '@mui/icons-material/StorefrontRounded';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import PageContainer from '@/components/layout/PageContainer';
import Section from '@/components/layout/Section';
import SiteHeader from '@/components/SiteHeader';
import { royaleTokens } from '@/design-system';

export interface InfoPageShellProps {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  /** Hero accent colour (hex). */
  accent: string;
  icon: SvgIconComponent;
  /** Short supporting points rendered as pills under the intro. */
  highlights?: readonly string[];
  children: ReactNode;
  cta?: {
    title: string;
    subtitle: string;
  };
}

const defaultCta = {
  title: 'Ready to find your next raffle?',
  subtitle:
    'Browse live listings, watch the odds in real time, and join a raffle you can trust from listing to outcome.',
} as const;

/**
 * Shared chrome for the informational "how it works" pages: site header, a
 * themed hero, the page body, and a closing call to action to the marketplace.
 */
export default function InfoPageShell({
  eyebrow,
  title,
  intro,
  accent,
  icon: Icon,
  highlights,
  children,
  cta = defaultCta,
}: InfoPageShellProps) {
  return (
    <Box sx={{ pb: { xs: 6, md: 10 }, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />

      <PageContainer sx={{ pt: { xs: 4, md: 6 } }}>
        <Section spacing="normal" component="div" sx={{ pt: 0 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 5 }}
            sx={{ alignItems: { md: 'center' } }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: alpha(accent, 0.13),
                color: accent,
                border: '1px solid',
                borderColor: alpha(accent, 0.28),
              }}
            >
              <Icon sx={{ fontSize: 36 }} />
            </Box>
            <Stack spacing={2} sx={{ maxWidth: royaleTokens.layout.contentMeasure }}>
              <Typography
                variant="overline"
                sx={{ color: accent, fontWeight: 700, letterSpacing: '0.08em' }}
              >
                {eyebrow}
              </Typography>
              <Typography variant="h1" component="h1">
                {title}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {intro}
              </Typography>
              {highlights && highlights.length > 0 ? (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, pt: 0.5 }}>
                  {highlights.map((highlight) => (
                    <Box
                      key={highlight}
                      sx={{
                        px: 2,
                        py: 0.75,
                        borderRadius: 999,
                        border: '1px solid',
                        borderColor: alpha(accent, 0.24),
                        bgcolor: alpha(accent, 0.07),
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      {highlight}
                    </Box>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        </Section>

        {children}

        <Section spacing="normal">
          <Paper
            sx={{
              p: { xs: 4, md: 7 },
              textAlign: 'center',
              border: '1px solid',
              borderColor: alpha('#5B3DF5', 0.2),
              background:
                'linear-gradient(150deg, rgba(91,61,245,0.10), rgba(229,24,122,0.08), rgba(247,181,0,0.10))',
            }}
          >
            <Stack spacing={3} sx={{ alignItems: 'center', maxWidth: 720, mx: 'auto' }}>
              <Typography variant="h2">{cta.title}</Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {cta.subtitle}
              </Typography>
              <Button
                href="/marketplace"
                variant="contained"
                size="large"
                startIcon={<StorefrontRounded />}
                endIcon={<ArrowForwardRounded />}
                sx={{ px: { xs: 4, md: 6 }, py: { xs: 1.5, md: 2 }, fontSize: '1.05rem' }}
              >
                Explore the marketplace
              </Button>
            </Stack>
          </Paper>
        </Section>
      </PageContainer>
    </Box>
  );
}
