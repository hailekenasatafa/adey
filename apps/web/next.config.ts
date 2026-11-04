import type { NextConfig } from 'next';

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co').hostname;
  } catch {
    return 'placeholder.supabase.co';
  }
})();

const nextConfig: NextConfig = {
  // Marketplace pages are personalised (auth cookies, location) and read live data,
  // so we use the dynamic rendering model rather than Cache Components.
  transpilePackages: ['@adey/shared'],
  images: { remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] },
  turbopack: {
    rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } },
  },
  async redirects() {
    return [{ source: '/home', destination: '/', permanent: true }];
  },
};

export default nextConfig;
