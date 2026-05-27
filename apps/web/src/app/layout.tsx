import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raffle Royale MVP",
  description:
    "Prototype raffle marketplace for signup, listing raffles, and ticket purchases.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
