import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import localFont from 'next/font/local';
import { Footer, Nav } from '@/components/Nav';

/** Plus Jakarta Sans for the interface; Noto Sans Ethiopic for Amharic text. Both self-hosted (SIL OFL, see ./fonts). */
const jakarta = localFont({ src: './fonts/PlusJakartaSans-latin.woff2', weight: '200 800', variable: '--font-jakarta', display: 'swap' });
const ethiopic = localFont({ src: './fonts/NotoSansEthiopic.woff2', weight: '100 900', variable: '--font-ethiopic', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: { default: 'ADEY — Connecting Communities. Growing Businesses.', template: '%s · ADEY' },
  description: 'Discover trusted Habesha businesses, shop verified Ethiopian sellers, and grow with AdConnect — advertising on screens inside community businesses.',
  applicationName: 'ADEY',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { siteName: 'ADEY', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#174B3A' };

/** Applies the saved light/dark choice (src/lib/theme.ts, key `adey.theme`) before first paint. */
const themeBoot = "try{var t=localStorage.getItem('adey.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${jakarta.variable} ${ethiopic.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBoot }} /></head>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 btn btn-primary btn-sm">Skip to content</a>
        <Providers>
          <Nav />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
