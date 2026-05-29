import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import { royaleTokens } from '@/design-system';

type ImagePlaceholderProps = {
  title: string;
  caption: string;
  minHeight?: number;
};

export default function ImagePlaceholder({
  title,
  caption,
  minHeight = 260,
}: ImagePlaceholderProps) {
  return (
    <Box
      role="img"
      aria-label={caption}
      sx={{
        minHeight,
        p: { xs: 2.5, md: 3 },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 6,
        border: `1px dashed ${alpha('#ffffff', 0.32)}`,
        background: royaleTokens.surface.mediaGradient,
        color: 'common.white',
        overflow: 'hidden',
        position: 'relative',
        isolation: 'isolate',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at top right, rgba(255,255,255,0.18), transparent 32%), linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.06) 100%)',
          zIndex: -1,
        },
      }}
    >
      <Chip
        label="Image placeholder"
        size="small"
        sx={{
          alignSelf: 'flex-start',
          bgcolor: alpha('#ffffff', 0.14),
          color: 'common.white',
          backdropFilter: 'blur(8px)',
        }}
      />
      <Stack spacing={1.25} sx={{ maxWidth: 420 }}>
        <Chip
          label="Replace with final artwork"
          size="small"
          variant="outlined"
          sx={{
            alignSelf: 'flex-start',
            borderColor: alpha('#ffffff', 0.26),
            color: 'common.white',
          }}
        />
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, lineHeight: 1.2, textWrap: 'balance' }}
        >
          {title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: alpha('#ffffff', 0.82),
            lineHeight: 1.55,
            overflowWrap: 'anywhere',
          }}
        >
          {caption}
        </Typography>
      </Stack>
    </Box>
  );
}
