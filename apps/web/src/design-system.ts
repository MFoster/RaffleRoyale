import { alpha } from '@mui/material/styles';

export type AccentTone = {
  main: string;
  light: string;
  dark: string;
  contrastText: string;
};

export type RoyaleTokens = {
  surface: {
    canvas: string;
    sunken: string;
    raised: string;
    overlay: string;
    inverse: string;
    outline: string;
    outlineSoft: string;
    heroGradient: string;
    spotlightGradient: string;
    highlightGradient: string;
    mediaGradient: string;
  };
  accents: {
    tertiaryContainer: string;
    tertiaryOnContainer: string;
    coral: AccentTone;
    aqua: AccentTone;
    success: string;
    warning: string;
    danger: string;
  };
  layout: {
    sectionGap: number;
    contentGap: number;
    compactGap: number;
    cardPadding: number;
    cardPaddingDense: number;
  };
  radius: {
    control: number;
    card: number;
    panel: number;
    pill: number;
  };
  typography: {
    fontFamilySans: string;
    fontFamilyMono: string;
  };
};

export const royaleTokens: RoyaleTokens = {
  surface: {
    canvas: '#F6F4F8',
    sunken: '#EEEAF2',
    raised: '#FFFFFF',
    overlay: alpha('#FFFFFF', 0.86),
    inverse: '#17151F',
    outline: alpha('#17151F', 0.12),
    outlineSoft: alpha('#17151F', 0.08),
    heroGradient:
      'linear-gradient(180deg, rgba(91, 61, 245, 0.09) 0%, rgba(79, 93, 117, 0.06) 38%, #F6F4F8 68%)',
    spotlightGradient:
      'linear-gradient(135deg, rgba(91, 61, 245, 0.08), rgba(79, 93, 117, 0.08), rgba(140, 106, 0, 0.08))',
    highlightGradient:
      'linear-gradient(135deg, rgba(23, 21, 31, 1), rgba(91, 61, 245, 0.92))',
    mediaGradient:
      'linear-gradient(145deg, rgba(91, 61, 245, 0.96), rgba(23, 21, 31, 0.96))',
  },
  accents: {
    tertiaryContainer: '#FFF1C1',
    tertiaryOnContainer: '#2A2000',
    coral: {
      main: '#B3265E',
      light: '#FFD9E3',
      dark: '#8B1E49',
      contrastText: '#FFFFFF',
    },
    aqua: {
      main: '#006A60',
      light: '#BDF2EA',
      dark: '#005047',
      contrastText: '#FFFFFF',
    },
    success: '#0B6B4B',
    warning: '#9A6700',
    danger: '#B42318',
  },
  layout: {
    sectionGap: 10,
    contentGap: 6,
    compactGap: 3,
    cardPadding: 6,
    cardPaddingDense: 4,
  },
  radius: {
    control: 16,
    card: 20,
    panel: 24,
    pill: 999,
  },
  typography: {
    fontFamilySans:
      'var(--font-geist-sans), Inter, Arial, Helvetica, sans-serif',
    fontFamilyMono:
      'var(--font-geist-mono), "Roboto Mono", "SFMono-Regular", Consolas, monospace',
  },
};
