'use client';
import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { friendlyError } from '@adey/shared';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';

/** Signed-in pages: skeleton while loading, sign-in prompt (and redirect) for guests, children otherwise. */
export function SignedIn({ children, what = 'this page' }: { children: React.ReactNode; what?: string }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !session) router.replace(`/auth/sign-in?next=${encodeURIComponent(path)}`); }, [loading, session, router, path]);
  if (loading) return <div className="container-x py-10"><div className="skeleton h-40" /></div>;
  if (!session) return <div className="container-x py-10"><Empty title={`Sign in to see ${what}`} action={<Link href={`/auth/sign-in?next=${encodeURIComponent(path)}`} className="btn btn-primary btn-sm">Sign in</Link>} /></div>;
  return <>{children}</>;
}

export function ErrorLine({ error, retry }: { error: unknown; retry?: () => void }) {
  return <p role="alert" className="text-sm text-danger">{friendlyError(error)}{retry && <button type="button" className="btn btn-ghost btn-sm ml-2" onClick={retry}>Try again</button>}</p>;
}

export function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2 text-sm">
      <span><span className="font-medium">{label}</span>{hint && <span className="block text-xs text-text-muted">{hint}</span>}</span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--forest)]" />
    </label>
  );
}

/** Splits plain article / message text into paragraphs. Never rendered as HTML. */
export function Paragraphs({ text, className = '' }: { text: string; className?: string }) {
  return <div className={`space-y-3 ${className}`}>{text.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}</div>;
}
