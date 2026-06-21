import Box from '@mui/material/Box';
import type { BoxProps } from '@mui/material/Box';

export interface SectionProps extends BoxProps {
  /** Vertical rhythm preset. */
  spacing?: 'compact' | 'normal' | 'spacious';
}

const paddingBySpacing = {
  compact: { xs: 3, md: 4 },
  normal: { xs: 4, md: 6 },
  spacious: { xs: 6, md: 9 },
} as const;

/**
 * A page section with consistent vertical rhythm.
 *
 * Replaces ad-hoc `py` values scattered across pages so the spacing scale stays
 * uniform site-wide.
 */
export default function Section({
  children,
  spacing = 'normal',
  component = 'section',
  sx,
  ...rest
}: SectionProps) {
  return (
    <Box
      component={component}
      sx={[
        { py: paddingBySpacing[spacing] },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </Box>
  );
}
