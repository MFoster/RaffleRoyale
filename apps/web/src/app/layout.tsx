import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import AppThemeProvider from '@/components/AppThemeProvider';
import './globals.css';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
