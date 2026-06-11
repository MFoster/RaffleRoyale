import type { Metadata } from 'next';
import AppThemeProvider from '@/components/AppThemeProvider';
import AppWithOnboarding from '@/components/AppWithOnboarding';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Raffle Royale',
    template: '%s | Raffle Royale',
  },
  description:
    'A peer-to-peer raffling marketplace for premium collectibles, streetwear, and gaming gear.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppThemeProvider>
          <AppWithOnboarding>{children}</AppWithOnboarding>
        </AppThemeProvider>
      </body>
    </html>
  );
}
