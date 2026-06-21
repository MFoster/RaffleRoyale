import { alpha, createTheme } from '@mui/material/styles';
import { royaleTokens, type RoyaleTokens } from './design-system';

declare module '@mui/material/styles' {
  interface Palette {
    tertiary: Palette['primary'];
    neutral: Palette['primary'];
  }

  interface PaletteOptions {
    tertiary?: PaletteOptions['primary'];
    neutral?: PaletteOptions['primary'];
  }

  interface Theme {
    royale: RoyaleTokens;
  }

  interface ThemeOptions {
    royale?: RoyaleTokens;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    tertiary: true;
    neutral: true;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    tertiary: true;
    neutral: true;
  }
}

const defaultTheme = createTheme();
const shadows = [...defaultTheme.shadows] as typeof defaultTheme.shadows;
shadows[1] = '0 1px 2px rgba(22, 18, 38, 0.06), 0 8px 24px rgba(22, 18, 38, 0.07)';
shadows[2] = '0 4px 12px rgba(22, 18, 38, 0.08), 0 12px 32px rgba(22, 18, 38, 0.09)';
shadows[3] = '0 8px 24px rgba(22, 18, 38, 0.12), 0 20px 48px rgba(22, 18, 38, 0.13)';

const theme = createTheme({
  cssVariables: true,
  spacing: 4,
  royale: royaleTokens,
  palette: {
    primary: {
      main: '#5B3DF5',
      light: '#8A73FF',
      dark: '#3D22C4',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E5187A',
      light: '#FF5BA6',
      dark: '#A60E58',
      contrastText: '#FFFFFF',
    },
    tertiary: {
      main: '#F7B500',
      light: '#FFD45E',
      dark: '#B97E00',
      contrastText: '#2A1D00',
    },
    neutral: {
      main: '#5B6474',
      light: '#D7DBE3',
      dark: '#161226',
      contrastText: '#FFFFFF',
    },
    info: {
      main: royaleTokens.accents.aqua.main,
      light: royaleTokens.accents.aqua.light,
      dark: royaleTokens.accents.aqua.dark,
      contrastText: royaleTokens.accents.aqua.contrastText,
    },
    success: {
      main: royaleTokens.accents.success,
      contrastText: '#FFFFFF',
    },
    warning: {
      main: royaleTokens.accents.warning,
      contrastText: '#2A1D00',
    },
    error: {
      main: royaleTokens.accents.danger,
      contrastText: '#FFFFFF',
    },
    background: {
      default: royaleTokens.surface.canvas,
      paper: royaleTokens.surface.raised,
    },
    text: {
      primary: '#161226',
      secondary: '#535A6B',
    },
    divider: royaleTokens.surface.outline,
  },
  shape: {
    borderRadius: royaleTokens.radius.control,
  },
  shadows,
  typography: {
    fontFamily: royaleTokens.typography.fontFamilySans,
    h1: {
      fontSize: 'clamp(3rem, 6vw, 4.75rem)',
      fontWeight: 800,
      lineHeight: 1.05,
      letterSpacing: '-0.03em',
    },
    h2: {
      fontSize: 'clamp(2.25rem, 4vw, 3.25rem)',
      fontWeight: 800,
      lineHeight: 1.1,
      letterSpacing: '-0.02em',
    },
    h3: {
      fontSize: 'clamp(1.9rem, 3vw, 2.5rem)',
      fontWeight: 700,
      lineHeight: 1.16,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontSize: '1.875rem',
      fontWeight: 700,
      lineHeight: 1.22,
    },
    h5: {
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h6: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    subtitle1: {
      fontSize: '1.125rem',
      lineHeight: 1.55,
      fontWeight: 600,
    },
    subtitle2: {
      fontSize: '1rem',
      lineHeight: 1.5,
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.55,
      fontWeight: 400,
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
      letterSpacing: 0,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.35,
      fontWeight: 500,
    },
    overline: {
      fontSize: '0.75rem',
      lineHeight: 1.35,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: {
          height: '100%',
        },
        body: {
          minHeight: '100%',
          backgroundColor: royaleTokens.surface.canvas,
          color: '#161226',
        },
        'a:not(.MuiButton-root):not(.MuiButtonBase-root)': {
          color: 'inherit',
          textDecorationColor: alpha('#5B3DF5', 0.4),
          textDecorationThickness: 1,
          textUnderlineOffset: '0.16em',
        },
        'a:not(.MuiButton-root):not(.MuiButtonBase-root):hover': {
          textDecorationColor: alpha('#5B3DF5', 0.82),
        },
        '*:focus-visible': {
          outline: `3px solid ${alpha('#5B3DF5', 0.45)}`,
          outlineOffset: 2,
          borderRadius: 8,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 50,
          borderRadius: royaleTokens.radius.control,
          paddingInline: 28,
          paddingBlock: 13,
          lineHeight: 1.2,
          '&.MuiButton-containedPrimary': {
            color: '#FFFFFF',
          },
        },
        sizeLarge: {
          minHeight: 56,
          paddingInline: 34,
          paddingBlock: 15,
        },
        text: {
          paddingInline: 22,
          paddingBlock: 11,
        },
        outlined: {
          borderColor: royaleTokens.surface.outline,
          paddingInline: 28,
          paddingBlock: 13,
        },
        contained: {
          paddingInline: 30,
          paddingBlock: 13,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: royaleTokens.radius.card,
          border: `1px solid ${royaleTokens.surface.outlineSoft}`,
          backgroundImage: 'none',
          boxShadow: shadows[1],
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          overflow: 'hidden',
        },
        rounded: {
          borderRadius: royaleTokens.radius.panel,
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 26,
          '&:last-child': {
            paddingBottom: 26,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: royaleTokens.radius.pill,
          fontWeight: 600,
          minHeight: 32,
          height: 'auto',
        },
        label: {
          paddingInline: 12,
          paddingBlock: 4,
        },
        sizeSmall: {
          minHeight: 28,
          '& .MuiChip-label': {
            paddingInline: 10,
            paddingBlock: 2,
          },
        },
        outlined: {
          borderColor: royaleTokens.surface.outline,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: royaleTokens.surface.outline,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 56,
          borderRadius: royaleTokens.radius.control,
          backgroundColor: alpha('#FFFFFF', 0.88),
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: royaleTokens.surface.outline,
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#5B3DF5', 0.34),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderWidth: 2,
            borderColor: '#5B3DF5',
          },
        },
        input: {
          paddingBlock: 16,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default theme;
