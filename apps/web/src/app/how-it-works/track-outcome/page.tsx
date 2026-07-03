import type { Metadata } from 'next';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import CasinoRounded from '@mui/icons-material/CasinoRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import HubRounded from '@mui/icons-material/HubRounded';
import ScheduleSendRounded from '@mui/icons-material/ScheduleSendRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
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

const ACCENT = '#B97E00';

export const metadata: Metadata = {
  title: 'Track outcome',
  description:
    'How Raffle Royale commits each raffle to an immutable event ledger and reveals a verifiable winner drawn from the public drand randomness beacon.',
};

const transparencyFeatures: readonly InfoFeature[] = [
  {
    icon: LockRounded,
    title: 'Commit: we pin a future randomness round',
    body: 'The instant a raffle becomes resolvable, we lock it to a specific upcoming round of the public drand randomness beacon and record that commitment in the ledger (a DRAW_COMMITTED event) — before that randomness exists. We choose the round; we cannot choose what it will say.',
  },
  {
    icon: CasinoRounded,
    title: 'Reveal: the winner is derived from public randomness',
    body: 'When the committed drand round is published, we verify its BLS signature and derive the winner deterministically with SHA-256: randomness → seed → winning index (with rejection sampling for perfectly even odds). The beacon round, signature, seed, digest, and index are all saved with the result.',
  },
  {
    icon: VerifiedUserRounded,
    title: 'Anyone can verify it',
    body: 'The finished raffle page shows the full proof and your browser recomputes the winner from the published signature on the spot. Because drand is an independent public network, you can look up the exact round yourself and confirm the outcome — no trust in us required.',
  },
  {
    icon: ShieldRounded,
    title: 'Tamper-resistant by construction',
    body: 'Ticket sales and the draw run inside serializable database transactions with explicit row locks. The committed round and the winning ticket are pinned from the locked pool atomically, so tickets cannot be injected, removed, or reordered at the moment of resolution.',
  },
];

const serviceFeatures: readonly InfoFeature[] = [
  {
    icon: HubRounded,
    title: 'Core API',
    body: 'A NestJS service owns the raffle rules: it validates every request, enforces ticket limits, runs the locked draw, and appends each lifecycle event to the ledger.',
  },
  {
    icon: ScheduleSendRounded,
    title: 'Scheduler',
    body: 'A scheduler service tracks each raffle’s expiration and, when a deadline arrives, dispatches a message to evaluate the raffle — so outcomes happen on time without anyone pressing a button.',
  },
  {
    icon: AutorenewRounded,
    title: 'Jobs worker',
    body: 'A background worker consumes those messages and sweeps eligible raffles — committing each to a drand round, then revealing the verified winner once that round publishes (or triggering refunds), keeping resolution reliable even under load.',
  },
  {
    icon: VerifiedUserRounded,
    title: 'Signed messaging',
    body: 'Every message passed between services is signed with a shared key and verified on arrival, so a lifecycle action can’t be forged or replayed by anything outside the system.',
  },
  {
    icon: StorageRounded,
    title: 'PostgreSQL of record',
    body: 'All raffles, tickets, transactions, and events are stored in PostgreSQL through Prisma — the durable, queryable record that every service reads from and writes to.',
  },
];

const lifecycle = [
  { label: 'Draft', detail: 'The raffle is being prepared.' },
  { label: 'Active', detail: 'Tickets are on sale to everyone.' },
  { label: 'Sold out / Expired', detail: 'Supply is gone or the deadline hit.' },
  {
    label: 'Drawing winner',
    detail: 'Committed to a future public drand round, awaiting its randomness.',
  },
  {
    label: 'Completed / Disbanded',
    detail: 'The verified winner is revealed, or tickets are refunded.',
  },
] as const;

const confidenceReasons = [
  'Fixed ticket supply means your odds are knowable and never diluted after you buy.',
  'A sell-through threshold protects you: too few tickets sold means an automatic refund, not a hollow win.',
  'The winner is drawn from public, independent randomness (the drand beacon) committed before that randomness existed — and your browser recomputes the result, so it is verifiable rather than a black box.',
  'Every state change is written to an immutable ledger you can follow from listing to payout.',
] as const;

export default function TrackOutcomePage() {
  return (
    <InfoPageShell
      eyebrow="How it works · Step 03"
      title="Track outcome"
      accent={ACCENT}
      icon={AutorenewRounded}
      intro="The outcome is the whole point — so Raffle Royale makes it transparent. Each raffle is committed to an immutable ledger as it unfolds, and the winner is drawn from the public drand randomness beacon — committed before that randomness exists and verifiable by anyone, including in your own browser."
      highlights={['Public drand randomness', 'Verifiable commit-reveal draw', 'Immutable event ledger']}
    >
      <Section spacing="normal">
        <Stack spacing={4}>
          <SectionHeading
            eyebrow="Commit & reveal"
            title="A draw you can verify, not just trust."
            subtitle="Transparency here is structural: the platform commits the history as it happens and reveals exactly how the winner was chosen."
          />
          <InfoFeatureGrid features={transparencyFeatures} accent={ACCENT} columns={2} />
        </Stack>
      </Section>

      <Section spacing="normal">
        <Stack spacing={4}>
          <SectionHeading
            eyebrow="The services behind every outcome"
            title="Purpose-built services keep resolution honest and on time."
            subtitle="Each part has one job, and they coordinate over signed messages so no single step can be tampered with."
          />
          <InfoFeatureGrid features={serviceFeatures} accent={ACCENT} columns={3} />
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
          <Stack spacing={4}>
            <SectionHeading
              eyebrow="Lifecycle transparency"
              title="Every raffle moves through explicit, visible states."
              subtitle="There is no ambiguous in-between. A raffle is always in one clearly named state, and each transition is recorded."
            />
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              }}
            >
              {lifecycle.map(({ label, detail }, index) => (
                <Card key={label} sx={{ borderColor: alpha(ACCENT, 0.24), height: '100%' }}>
                  <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
                    <Stack spacing={1.5}>
                      <Typography
                        variant="overline"
                        sx={{ color: ACCENT, fontWeight: 700, letterSpacing: '0.08em' }}
                      >
                        {`Stage ${String(index + 1)}`}
                      </Typography>
                      <Typography variant="h6">{label}</Typography>
                      <Typography color="text.secondary" variant="body2">
                        {detail}
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Box>
          </Stack>
        </Paper>
      </Section>

      <Section spacing="normal">
        <Paper
          sx={{
            p: { xs: 4, md: 6 },
            border: '1px solid',
            borderColor: alpha(ACCENT, 0.22),
            background:
              'linear-gradient(150deg, rgba(247,181,0,0.10), rgba(91,61,245,0.06), rgba(255,255,255,0.94))',
          }}
        >
          <Stack spacing={3}>
            <SectionHeading
              eyebrow="Why buy with confidence"
              title="Transparency is what makes a ticket worth buying."
            />
            <Stack spacing={2}>
              {confidenceReasons.map((reason) => (
                <Stack key={reason} direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                  <Box
                    sx={{
                      mt: '4px',
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: '50%',
                      bgcolor: alpha(ACCENT, 0.14),
                      color: ACCENT,
                    }}
                  >
                    <FactCheckRounded sx={{ fontSize: 16 }} />
                  </Box>
                  <Typography color="text.secondary">{reason}</Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Section>
    </InfoPageShell>
  );
}
