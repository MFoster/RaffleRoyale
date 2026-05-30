import type { Metadata } from 'next';
import AppThemeProvider from '@/components/AppThemeProvider';
import './globals.css';
import "./globals.css";

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
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
