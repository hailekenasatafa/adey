import type { MetadataRoute } from 'next';

/** Web app manifest: lets Chrome, Edge and Safari install Adey Connect as an app on Windows, Mac and Linux. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Adey Connect',
    short_name: 'Adey Connect',
    description: 'Find Habesha-owned businesses near you, see their menus and photos, claim their deals and find community events.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#174B3A',
    lang: 'en-US',
    dir: 'ltr',
    categories: ['business', 'lifestyle', 'shopping'],
    icons: [
      { src: '/app-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Find businesses', url: '/market', icons: [{ src: '/app-icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Deals', url: '/deals', icons: [{ src: '/app-icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Events', url: '/events', icons: [{ src: '/app-icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
