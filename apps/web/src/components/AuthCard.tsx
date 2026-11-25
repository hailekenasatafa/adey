'use client';
import { LEGAL_PAGES_PUBLISHED } from '@adey/shared';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { SUPABASE_KEY, SUPABASE_URL, supabase } from '@/lib/supabase/client';
import { safeNext } from '@/lib/safeNext';
import { AdeyFlower } from './ui';

/** The centred card every sign-in / sign-up / password page sits in. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="container-x flex justify-center py-10 sm:py-16">
      <div className="w-full max-w-[440px]">
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm sm:p-9">
          <AdeyFlower size={40} />
          <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-text-muted">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Whether Google sign-in is switched on in Supabase (Authentication > Providers > Google).
 * Reads Supabase Auth's public settings, so the button appears by itself once it is enabled: no redeploy needed.
 */
function useGoogleEnabled() {
  const q = useQuery({
    queryKey: ['auth-providers'],
    queryFn: async () => {
      const r = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
      if (!r.ok) return false;
      const j = (await r.json()) as { external?: { google?: boolean } };
      return !!j.external?.google;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return q.data === true;
}

/** Google's standard "G" mark, as Google's sign-in branding guidelines require on the button. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** "Continue with Google" plus the "or" divider. Renders nothing until Google is enabled in Supabase. */
export function GoogleSignIn({ next, terms = false }: { next?: string | null; terms?: boolean }) {
  const enabled = useGoogleEnabled();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;
  const go = async () => {
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}` },
    });
    if (e) { setBusy(false); setError('Google sign-in could not start. Try again, or use your email below.'); }
  };
  return (
    <>
      <button type="button" onClick={go} disabled={busy}
        className="btn w-full border border-border-strong bg-surface text-text hover:bg-surface-muted">
        {busy ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <GoogleMark />}
        Continue with Google
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {terms && LEGAL_PAGES_PUBLISHED && <p className="mt-2 text-center text-xs text-text-muted">By continuing with Google you agree to Adey Connect’s <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>}
      <div className="my-6 flex items-center gap-3 text-xs text-text-muted" role="separator" aria-label="or">
        <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
