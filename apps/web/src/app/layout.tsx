import React from 'react';
import './globals.css';

export const metadata = {
  title: 'Lunar Dungeon: Party Clash',
  description: "AAYANSH'26 Lunar Dungeon: Party Clash Arena",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
