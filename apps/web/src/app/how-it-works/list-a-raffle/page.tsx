import type { Metadata } from 'next';
import ConfirmationNumberRounded from '@mui/icons-material/ConfirmationNumberRounded';
import SellRounded from '@mui/icons-material/SellRounded';
import PercentRounded from '@mui/icons-material/PercentRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import AddBoxRounded from '@mui/icons-material/AddBoxRounded';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import InfoPageShell from '@/components/info/InfoPageShell';
import InfoFeatureGrid, {
  type InfoFeature,
} from '@/components/info/InfoFeatureGrid';
import Section from '@/components/layout/Section';
import SectionHeading from '@/components/layout/SectionHeading';
import { royaleTokens } from '@/design-system';

const ACCENT = '#5B3DF5';

export const metadata: Metadata = {
  title: 'List a raffle',
  description:
    'How ticket count, price per ticket, and the sell-through threshold work together within a raffle expiration window.',
};

const features: readonly InfoFeature[] = [
  {
    icon: ConfirmationNumberRounded,
    title: 'Ticket count sets the odds',
    body: 'You choose a fixed number of tickets up front, and that supply never changes. Because the count is locked, every buyer can calculate their exact odds at any moment — one ticket in a 100-ticket raffle is always a clean 1-in-100 chance.',
  },
  {
    icon: SellRounded,
    title: 'Price per ticket sets the pot',
    body: 'The price is what a buyer pays for a single entry. Ticket count multiplied by ticket price is the full value of the raffle, so a 100-ticket raffle at $5 represents a transparent $500 pool that anyone can verify before they join.',
  },
  {
    icon: PercentRounded,
    title: 'A sell-through threshold protects everyone',
    body: 'The threshold is the minimum percentage of tickets that must sell for the raffle to pay out. It guards against a winner being drawn from a nearly empty pool — if too few tickets sell, the raffle is disbanded and buyers are refunded instead.',
  },
  {
    icon: ScheduleRounded,
    title: 'An expiration time keeps things moving',
    body: 'Every raffle has a deadline. It resolves early the moment it sells out, or it is evaluated at expiration: if the sell-through threshold was met, a winner is drawn; if not, it disbands and refunds. Buyers always know exactly when the outcome lands.',
  },
];

export default function ListARafflePage() {
  return (
    <InfoPageShell
      eyebrow="How it works · Step 01"
      title="List a raffle"
      accent={ACCENT}
      icon={AddBoxRounded}
      intro="Turning an item into a raffle comes down to four simple settings. Together they define the odds, the pot, the safety net, and the deadline — all visible to buyers from the very first ticket."
      highlights={['Fixed ticket supply', 'Transparent pricing', 'Built-in refunds']}
    >
      <Section spacing="normal">
        <Stack spacing={4}>
          <SectionHeading
            eyebrow="The four settings"
            title="Define the raffle, then let the rules run themselves."
            subtitle="Once you publish, the count, price, threshold, and expiration drive the entire lifecycle automatically — no manual intervention required."
          />
          <InfoFeatureGrid features={features} accent={ACCENT} columns={2} />
        </Stack>
      </Section>

      <Section spacing="normal">
        <Paper
          sx={{
            p: { xs: 4, md: 6 },
            border: '1px solid',
            borderColor: alpha(ACCENT, 0.2),
            bgcolor: royaleTokens.surface.overlay,
          }}
        >
          <Stack spacing={3}>
            <SectionHeading
              eyebrow="A quick example"
              title="100 tickets · $5 each · 60% threshold · 7-day window"
            />
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              }}
            >
              {[
                ['Total pool', '$500 if every ticket sells (100 × $5).'],
                ['Odds per ticket', 'A flat 1-in-100 for every entry purchased.'],
                [
                  'Threshold',
                  'At least 60 tickets must sell, or the raffle disbands and refunds.',
                ],
                [
                  'Resolution',
                  'Draws instantly at sell-out, or after 7 days if 60%+ sold.',
                ],
              ].map(([label, value]) => (
                <Box
                  key={label}
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: alpha(ACCENT, 0.18),
                    bgcolor: alpha(ACCENT, 0.05),
                  }}
                >
                  <Typography variant="overline" sx={{ color: ACCENT, fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Typography color="text.secondary">{value}</Typography>
                </Box>
              ))}
            </Box>
          </Stack>
        </Paper>
      </Section>
    </InfoPageShell>
  );
}
