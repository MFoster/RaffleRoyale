import type { ReactNode } from 'react';
import type { SvgIconComponent } from '@mui/icons-material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface InfoFeature {
  icon: SvgIconComponent;
  title: string;
  body: ReactNode;
}

export interface InfoFeatureGridProps {
  features: readonly InfoFeature[];
  accent: string;
  /** Columns on md+ screens. */
  columns?: 2 | 3;
}

/**
 * A responsive grid of explanatory feature cards used across the informational
 * pages.
 */
export default function InfoFeatureGrid({
  features,
  accent,
  columns = 2,
}: InfoFeatureGridProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: {
          xs: '1fr',
          md: `repeat(${String(columns)}, 1fr)`,
        },
      }}
    >
      {features.map(({ icon: Icon, title, body }) => (
        <Card key={title} sx={{ borderColor: alpha(accent, 0.24), height: '100%' }}>
          <CardContent sx={{ p: { xs: 3.5, md: 4 } }}>
            <Stack spacing={2.5}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  bgcolor: alpha(accent, 0.13),
                  color: accent,
                  border: '1px solid',
                  borderColor: alpha(accent, 0.26),
                }}
              >
                <Icon />
              </Box>
              <Typography variant="h5">{title}</Typography>
              <Typography color="text.secondary">{body}</Typography>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
