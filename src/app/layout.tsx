import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'A-Antique',
  description: 'Objects found in Edmonton and Toronto, one at a time.',
};

export const viewport: Viewport = { viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
