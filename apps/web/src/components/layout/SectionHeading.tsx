import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { royaleTokens } from '@/design-system';

export interface SectionHeadingProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional trailing content (e.g. nav buttons, links) aligned to the end. */
  action?: ReactNode;
  align?: 'start' | 'center';
  /** Heading typography level. */
  titleVariant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5';
}

/**
 * Consistent section header: optional eyebrow, title, supporting copy, and an
 * optional trailing action. Constrains copy to a readable measure so individual
 * pages no longer set one-off `maxWidth` values on headings.
 */
export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
  align = 'start',
  titleVariant = 'h2',
}: SectionHeadingProps) {
  const isCentered = align === 'center';

  return (
    <Stack
      direction={{ xs: 'column', md: action ? 'row' : 'column' }}
      spacing={2}
      sx={{
        alignItems: action
          ? { xs: 'flex-start', md: 'flex-end' }
          : isCentered
            ? 'center'
            : 'flex-start',
        justifyContent: action ? 'space-between' : 'flex-start',
      }}
    >
      <Stack
        spacing={1.25}
        sx={{
          maxWidth: royaleTokens.layout.contentMeasure,
          textAlign: isCentered ? 'center' : 'left',
          mx: isCentered ? 'auto' : 0,
        }}
      >
        {eyebrow ? (
          <Typography
            variant="overline"
            sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.08em' }}
          >
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant={titleVariant} component="h2">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="subtitle1" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  );
}
