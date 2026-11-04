import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Footer, Nav } from '@/components/Nav';

export const metadata: Metadata = {
  title: { default: 'ADEY — Connecting Communities. Growing Businesses.', template: '%s · ADEY' },
  description: 'Discover trusted Habesha businesses, shop verified Ethiopian sellers, and grow with AdConnect — advertising on screens inside community businesses.',
  applicationName: 'ADEY',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { siteName: 'ADEY', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#174B3A' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
