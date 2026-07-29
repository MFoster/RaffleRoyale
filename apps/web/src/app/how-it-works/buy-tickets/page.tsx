import type { Metadata } from 'next';
import TravelExploreRounded from '@mui/icons-material/TravelExploreRounded';
import ShoppingCartRounded from '@mui/icons-material/ShoppingCartRounded';
import InsightsRounded from '@mui/icons-material/InsightsRounded';
import FilterAltRounded from '@mui/icons-material/FilterAltRounded';
import ConfirmationNumberRounded from '@mui/icons-material/ConfirmationNumberRounded';
import NotificationsActiveRounded from '@mui/icons-material/NotificationsActiveRounded';
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

const ACCENT = '#E5187A';

export const metadata: Metadata = {
  title: 'Buy tickets',
  description:
    'How to find raffles worth joining and purchase tickets with full visibility into the odds.',
};

const findFeatures: readonly InfoFeature[] = [
  {
    icon: TravelExploreRounded,
    title: 'Browse the marketplace',
    body: 'Every live raffle lives in one place. Scan the marketplace to see what is up for grabs right now, complete with imagery, price, and how far along each raffle is toward selling out.',
  },
  {
    icon: FilterAltRounded,
    title: 'Filter to what you want',
    body: 'Narrow the marketplace down to the items, price ranges, and raffle states that match what you are after, so you are only looking at raffles worth your tickets.',
  },
  {
    icon: InsightsRounded,
    title: 'Read the odds before you commit',
    body: 'Each listing shows tickets sold against the fixed supply, so your odds are never a mystery. You can see exactly how competitive a raffle is and decide whether to buy now or wait.',
  },
];

const buyFeatures: readonly InfoFeature[] = [
  {
    icon: ConfirmationNumberRounded,
    title: 'Each ticket is a numbered entry',
    body: 'When you buy, you receive uniquely numbered tickets recorded against the raffle. One of those numbers is what gets drawn at resolution — the more you hold, the better your odds.',
  },
  {
    icon: ShoppingCartRounded,
    title: 'Purchasing is safe and atomic',
    body: 'Ticket purchases run inside locked, serializable database transactions. That means two buyers can never claim the same ticket and the supply can never be oversold, even at the moment a raffle sells out.',
  },
  {
    icon: NotificationsActiveRounded,
    title: 'Follow it to the finish',
    body: 'After you buy, watch the progress climb. The raffle resolves when it sells out or reaches its deadline — and if it falls short of its sell-through threshold, your purchase is refunded.',
  },
];

export default function BuyTicketsPage() {
  return (
    <InfoPageShell
      eyebrow="How it works · Step 02"
      title="Buy tickets"
      accent={ACCENT}
      icon={ConfirmationNumberRounded}
      intro="As a buyer you get full visibility before you spend a cent. Find raffles you actually care about, check the odds, and buy entries knowing the supply is fixed and the rules are enforced for you."
      highlights={['See odds up front', 'Fixed supply', 'Refunds if it falls short']}
      cta={{
        title: 'See what is up for grabs',
        subtitle:
          'Open the marketplace, sort by what interests you, and grab tickets while the odds are in your favour.',
      }}
    >
      <Section spacing="normal">
        <Stack spacing={4}>
          <SectionHeading
            eyebrow="Find raffles"
            title="Discover raffles worth your tickets."
            subtitle="The marketplace is built for fast scanning, so you can spot the right raffle and understand its odds in seconds."
          />
          <InfoFeatureGrid features={findFeatures} accent={ACCENT} columns={3} />
        </Stack>
      </Section>

      <Section spacing="normal">
        <Stack spacing={4}>
          <SectionHeading
            eyebrow="Purchase entries"
            title="Buying tickets, end to end."
            subtitle="Every purchase is recorded, locked, and counted toward a transparent, fixed supply."
          />
          <InfoFeatureGrid features={buyFeatures} accent={ACCENT} columns={3} />
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
              eyebrow="Know before you buy"
              title="Three things every listing tells you."
            />
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              }}
            >
              {[
                ['Your odds', 'Tickets sold versus the fixed total supply.'],
                ['The cost', 'A clear price for each numbered entry.'],
                ['The deadline', 'When the raffle draws or refunds.'],
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
