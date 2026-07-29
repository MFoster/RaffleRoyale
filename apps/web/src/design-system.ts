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
    /** Max readable measure for headings/body copy (px). */
    contentMeasure: number;
    /** Horizontal page gutter (theme spacing units), responsive via sx. */
    pageGutter: number;
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
    canvas: '#F5F3FB',
    sunken: '#ECE8F6',
    raised: '#FFFFFF',
    overlay: alpha('#FFFFFF', 0.88),
    inverse: '#161226',
    outline: alpha('#161226', 0.12),
    outlineSoft: alpha('#161226', 0.07),
    heroGradient:
      'linear-gradient(180deg, rgba(91, 61, 245, 0.12) 0%, rgba(229, 24, 122, 0.06) 34%, #F5F3FB 64%)',
    spotlightGradient:
      'linear-gradient(135deg, rgba(91, 61, 245, 0.10), rgba(229, 24, 122, 0.08), rgba(247, 181, 0, 0.10))',
    highlightGradient:
      'linear-gradient(135deg, rgba(22, 18, 38, 1), rgba(91, 61, 245, 0.94))',
    mediaGradient:
      'linear-gradient(145deg, rgba(91, 61, 245, 0.96), rgba(22, 18, 38, 0.96))',
  },
  accents: {
    tertiaryContainer: '#FFEFC2',
    tertiaryOnContainer: '#2A1D00',
    coral: {
      main: '#E5187A',
      light: '#FFD6E7',
      dark: '#A60E58',
      contrastText: '#FFFFFF',
    },
    aqua: {
      main: '#0E9BC9',
      light: '#C2EEF8',
      dark: '#076B8C',
      contrastText: '#FFFFFF',
    },
    success: '#0E9F5A',
    warning: '#E08600',
    danger: '#E03B3B',
  },
  layout: {
    sectionGap: 10,
    contentGap: 6,
    compactGap: 3,
    cardPadding: 6,
    cardPaddingDense: 4,
    contentMeasure: 820,
    pageGutter: 4,
  },
  radius: {
    control: 16,
    card: 20,
    panel: 24,
    pill: 999,
  },
  typography: {
    fontFamilySans:
      "var(--font-geist-sans, 'Inter'), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    fontFamilyMono:
      "var(--font-geist-mono, 'Roboto Mono'), ui-monospace, 'SFMono-Regular', Consolas, monospace",
  },
};
