'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AdeyFlower } from './ui';
import { useAuth } from './Providers';
import { api, supabase } from '@/lib/supabase/client';
import { useCart, useCommerce } from '@/lib/commerce';
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme';
import { useAdconnect, useAppSettings } from '@/lib/settings';

const links = [
  { href: '/market', label: 'Adey Market' },
  { href: '/deals', label: 'Deals' },
  { href: '/events', label: 'Events' },
  { href: '/adconnect', label: 'AdConnect' },
];
/** [link, shown only when online checkout is on, shown only when AdConnect campaigns are on] */
const ACCOUNT: { href: string; label: string; checkout?: boolean; campaigns?: boolean }[] = [
  { href: '/deals/mine', label: 'My deals' }, { href: '/saved', label: 'Saved' }, { href: '/messages', label: 'Messages' },
  { href: '/orders', label: 'Orders', checkout: true }, { href: '/rewards', label: 'Rewards', checkout: true }, { href: '/account/addresses', label: 'Addresses', checkout: true },
  { href: '/account', label: 'Settings' }, { href: '/campaigns', label: 'My campaigns', campaigns: true }, { href: '/help', label: 'Help' },
];
const item = 'block rounded-[10px] px-3 py-2 text-sm hover:bg-surface-muted';

/** Close a popover on Escape or a click outside it. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open, close]);
  return ref;
}

const Count = ({ n }: { n: number }) => (n > 0 ? <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-[color:var(--on-danger)]">{n > 99 ? '99+' : n}</span> : null);

export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  const opts: [ThemeChoice, string][] = [['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '💻 System']];
  return (
    <div role="radiogroup" aria-label="Colour theme" className={`flex rounded-[10px] bg-surface-muted p-0.5 text-xs ${className}`}>
      {opts.map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={theme === v} onClick={() => setTheme(v)} className={`flex-1 rounded-[8px] px-2 py-1.5 font-semibold ${theme === v ? 'bg-surface text-text shadow-sm' : 'text-text-muted'}`}>{l}</button>)}
    </div>
  );
}

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { session, profile, businesses, isStaff } = useAuth();
  const { checkoutEnabled } = useCommerce();
  const { campaignsEnabled } = useAdconnect();
  const accountLinks = ACCOUNT.filter((l) => (!l.checkout || checkoutEnabled) && (!l.campaigns || campaignsEnabled));
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setMenu(false); setMobile(false); }
  const menuRef = useDismiss(menu, () => setMenu(false));
  const mobileRef = useDismiss(mobile, () => setMobile(false));
  const unread = useQuery({ queryKey: ['unread', session?.user.id], queryFn: () => api.notifications.unread(), enabled: !!session, refetchInterval: 60_000 });
  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); };
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-2">
        <div className="flex items-center gap-1" ref={mobileRef}>
          <button className="btn btn-ghost btn-sm md:hidden" aria-label="Menu" aria-expanded={mobile} aria-controls="mobile-nav" onClick={() => setMobile((o) => !o)}>{mobile ? '✕' : '☰'}</button>
          <Link href="/" className="flex items-center gap-2" aria-label="Adey home">
            <AdeyFlower size={30} />
            <span className="text-lg font-bold tracking-[0.25em]">ADEY</span>
            <span className="ethiopic text-sm text-text-muted hidden sm:inline">አደይ</span>
          </Link>
          {mobile && (
            <nav id="mobile-nav" aria-label="Main" className="card absolute left-2 right-2 top-16 space-y-1 p-2 shadow-lg md:hidden">
              {links.map((l) => <Link key={l.href} href={l.href} className={`${item} font-semibold ${path.startsWith(l.href) ? 'text-forest' : ''}`}>{l.label}</Link>)}
              <hr className="border-border" />
              {session ? (
                <>
                  <Link href="/dashboard" className={item}>{businesses.length ? 'Dashboard' : 'List your business'}</Link>
                  {isStaff && <Link href="/admin" className={item}>Admin</Link>}
                  {accountLinks.map((l) => <Link key={l.href} href={l.href} className={item}>{l.label}</Link>)}
                  <button onClick={signOut} className={`${item} w-full text-left`}>Sign out</button>
                </>
              ) : (
                <>
                  <Link href="/auth/sign-in" className={item}>Sign in</Link>
                  <Link href="/auth/sign-up" className={item}>Get started</Link>
                  <Link href="/help" className={item}>Help</Link>
                </>
              )}
              <ThemeToggle className="mt-1" />
            </nav>
          )}
        </div>
        <nav aria-label="Main" className="hidden md:flex items-center gap-1">
          {links.map((l) => <Link key={l.href} href={l.href} aria-current={path.startsWith(l.href) ? 'page' : undefined} className={`rounded-[10px] px-3 py-2 text-sm font-semibold transition hover:bg-surface-muted ${path.startsWith(l.href) ? 'text-forest' : 'text-text'}`}>{l.label}</Link>)}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/search" className="btn btn-ghost btn-sm" aria-label="Search">🔍</Link>
          {session ? (
            <>
              {checkoutEnabled && <Link href="/cart" className="btn btn-ghost btn-sm relative" aria-label={`Cart${cart.data?.count ? `, ${cart.data.count} items` : ''}`}>🛒<Count n={cart.data?.count ?? 0} /></Link>}
              <Link href="/messages" className="btn btn-ghost btn-sm relative hidden sm:inline-flex" aria-label={`Messages${unread.data?.messages ? `, ${unread.data.messages} unread` : ''}`}>💬<Count n={unread.data?.messages ?? 0} /></Link>
              <Link href="/notifications" className="btn btn-ghost btn-sm relative" aria-label={`Notifications${unread.data?.notifications ? `, ${unread.data.notifications} unread` : ''}`}>🔔<Count n={unread.data?.notifications ?? 0} /></Link>
              <Link href="/dashboard" className="btn btn-secondary btn-sm hidden md:inline-flex">{businesses.length ? 'Dashboard' : 'List business'}</Link>
              {isStaff && <Link href="/admin" className="btn btn-outline btn-sm hidden md:inline-flex">Admin</Link>}
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenu((o) => !o)} className="h-9 w-9 rounded-full bg-forest-soft text-forest font-bold grid place-items-center" aria-label="Account menu" aria-expanded={menu} aria-haspopup="menu">{(profile?.display_name ?? session.user.email ?? '?').slice(0, 1).toUpperCase()}</button>
                {menu && (
                  <div role="menu" className="card absolute right-0 top-11 w-60 p-2 shadow-lg">
                    <p className="px-3 py-2 text-sm font-semibold truncate">{profile?.display_name ?? session.user.email}</p>
                    {accountLinks.map((l) => <Link key={l.href} role="menuitem" href={l.href} className={item}>{l.label}</Link>)}
                    <div className="px-1 py-2"><ThemeToggle /></div>
                    <button role="menuitem" onClick={signOut} className={`${item} w-full text-left`}>Sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/sign-in" className="btn btn-ghost btn-sm hidden sm:inline-flex">Sign in</Link>
              <Link href="/auth/sign-up" className="btn btn-primary btn-sm">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const app = useAppSettings();
  const support = app?.support_email ?? 'support@adey.app';
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="container-x grid gap-8 py-12 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2"><AdeyFlower size={28} /><span className="font-bold tracking-[0.25em]">ADEY</span><span className="ethiopic text-text-muted">አደይ</span></div>
          <p className="mt-3 max-w-sm text-sm text-text-muted">Connecting Communities. Growing Businesses. Find Habesha-owned businesses, see their menus and photos, and claim their deals. Listing a business is free.</p>
          <div className="mt-4 max-w-xs"><p className="mb-1 text-xs font-semibold text-text-muted">Theme</p><ThemeToggle /></div>
        </div>
        <div className="text-sm"><p className="font-semibold">Marketplace</p><ul className="mt-2 space-y-1 text-text-muted"><li><Link href="/market">Find businesses</Link></li><li><Link href="/deals">Deals</Link></li><li><Link href="/events">Events</Link></li><li><Link href="/adconnect">AdConnect</Link></li><li><Link href="/dashboard/new">List your business — free</Link></li><li><Link href="/market?market=et">Ethiopian Market</Link></li></ul></div>
        <div className="text-sm"><p className="font-semibold">Company</p><ul className="mt-2 space-y-1 text-text-muted"><li><Link href="/help">Help centre</Link></li><li><Link href="/verification">How verification works</Link></li><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/privacy">Privacy</Link></li><li><a href={`mailto:${support}`}>{support}</a></li></ul></div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-text-muted">© {new Date().getFullYear()} Adey. Apps for iPhone and Android are on the way.</div>
    </footer>
  );
}
