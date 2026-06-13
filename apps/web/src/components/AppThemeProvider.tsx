'use client';

import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import theme from '@/theme';
import AppToastProvider from './AppToastProvider';

type AppThemeProviderProps = {
  children: ReactNode;
};

export default function AppThemeProvider({
  children,
}: AppThemeProviderProps) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppToastProvider>{children}</AppToastProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
