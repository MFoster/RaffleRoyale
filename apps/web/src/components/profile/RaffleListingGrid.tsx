import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EnhancedRaffleCard, {
  type RaffleData,
} from '@/components/home/EnhancedRaffleCard';

export interface RaffleListingGridProps {
  raffles: RaffleData[];
  emptyMessage?: string;
}

/**
 * Responsive grid of raffle cards reused across profile and account views so
 * listings render consistently everywhere.
 */
export default function RaffleListingGrid({
  raffles,
  emptyMessage = 'Nothing to show here yet.',
}: RaffleListingGridProps) {
  if (raffles.length === 0) {
    return (
      <Paper
        variant="outlined"
        sx={{ p: 3, borderStyle: 'dashed', textAlign: 'center' }}
      >
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 2, sm: 2.5 },
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: 'repeat(3, 1fr)',
        },
      }}
    >
      {raffles.map((raffle) => (
        <EnhancedRaffleCard key={raffle.id} raffle={raffle} />
      ))}
    </Box>
  );
}
