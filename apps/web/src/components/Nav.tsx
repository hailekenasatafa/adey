'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdeyFlower } from './ui';
import { useAuth } from './Providers';
import { api, supabase } from '@/lib/supabase/client';

const links = [
  { href: '/market', label: 'Adey Market' },
  { href: '/adconnect', label: 'AdConnect' },
  { href: '/verification', label: 'Verification' },
];

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { session, profile, businesses, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const unread = useQuery({ queryKey: ['unread', session?.user.id], queryFn: () => api.notifications.unread(), enabled: !!session, refetchInterval: 60_000 });
  const badge = (unread.data?.messages ?? 0) + (unread.data?.notifications ?? 0);
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Adey home">
          <AdeyFlower size={30} />
          <span className="text-lg font-bold tracking-[0.25em]">ADEY</span>
          <span className="ethiopic text-sm text-text-muted hidden sm:inline">አደይ</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => <Link key={l.href} href={l.href} className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition hover:bg-surface-muted ${path.startsWith(l.href) ? 'text-forest' : 'text-text'}`}>{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/search" className="btn btn-ghost btn-sm" aria-label="Search">🔍</Link>
          {session ? (
            <>
              <Link href="/messages" className="btn btn-ghost btn-sm relative" aria-label="Messages">💬{badge > 0 && <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">{badge}</span>}</Link>
              <Link href="/dashboard" className="btn btn-secondary btn-sm">{businesses.length ? 'Dashboard' : 'List business'}</Link>
              {isStaff && <Link href="/admin" className="btn btn-outline btn-sm">Admin</Link>}
              <button onClick={() => setOpen((o) => !o)} className="h-9 w-9 rounded-full bg-forest-soft text-forest font-bold grid place-items-center" aria-label="Account menu">{(profile?.display_name ?? session.user.email ?? '?').slice(0, 1).toUpperCase()}</button>
              {open && (
                <div className="absolute right-4 top-14 card p-2 w-56 shadow-lg" onMouseLeave={() => setOpen(false)}>
                  <p className="px-3 py-2 text-sm font-semibold truncate">{profile?.display_name ?? session.user.email}</p>
                  <Link href="/account" className="block rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted">Account & notifications</Link>
                  <Link href="/saved" className="block rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted">Saved</Link>
                  <Link href="/campaigns" className="block rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted">My campaigns</Link>
                  <button onClick={async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); }} className="block w-full text-left rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted">Sign out</button>
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link href="/auth/sign-up" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2"><AdeyFlower size={28} /><span className="font-bold tracking-[0.25em]">ADEY</span><span className="ethiopic text-text-muted">አደይ</span></div>
          <p className="mt-3 max-w-sm text-sm text-text-muted">Connecting Communities. Growing Businesses. The marketplace for Habesha businesses, Ethiopian sellers, and community advertising.</p>
        </div>
        <div className="text-sm"><p className="font-semibold">Marketplace</p><ul className="mt-2 space-y-1 text-text-muted"><li><Link href="/market?market=us">US Market</Link></li><li><Link href="/market?market=et">Ethiopian Market</Link></li><li><Link href="/adconnect">AdConnect</Link></li><li><Link href="/dashboard">List your business</Link></li></ul></div>
        <div className="text-sm"><p className="font-semibold">Company</p><ul className="mt-2 space-y-1 text-text-muted"><li><Link href="/verification">How verification works</Link></li><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/privacy">Privacy</Link></li><li><a href="mailto:support@adey.app">support@adey.app</a></li></ul></div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-text-muted">© {new Date().getFullYear()} Adey. Get the app on iOS and Android.</div>
    </footer>
  );
}
