'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Bell, CircleUser, Menu, MessageCircle, Monitor, Moon, Search, ShoppingCart, Sun, type LucideIcon } from 'lucide-react';
import { AdeyFlower } from './ui';
import { useAuth } from './Providers';
import { SiteSearch, SiteSearchFallback, type SiteSearchHandle } from './SiteSearch';
import { api, supabase } from '@/lib/supabase/client';
import { useCart, useCommerce } from '@/lib/commerce';
import { setTheme, useTheme, type ThemeChoice } from '@/lib/theme';
import { useAdconnect, useAppSettings } from '@/lib/settings';
import { sectionIcons } from '@/lib/icons';
import { mediaUrlFromPath } from '@/lib/media';

const sections: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/market', label: 'Market', icon: sectionIcons.market },
  { href: '/deals', label: 'Deals', icon: sectionIcons.deals },
  { href: '/events', label: 'Events', icon: sectionIcons.events },
  { href: '/adconnect', label: 'AdConnect', icon: sectionIcons.adconnect },
];
/** [link, shown only when online checkout is on, shown only when AdConnect campaigns are on] */
const ACCOUNT: { href: string; label: string; checkout?: boolean; campaigns?: boolean }[] = [
  { href: '/deals/mine', label: 'My deals' }, { href: '/saved', label: 'Saved' },
  { href: '/orders', label: 'Orders', checkout: true }, { href: '/rewards', label: 'Rewards', checkout: true }, { href: '/account/addresses', label: 'Addresses', checkout: true },
  { href: '/campaigns', label: 'My campaigns', campaigns: true }, { href: '/account', label: 'Account settings' },
];

/** Pages that are about finding things show the search bar; account, owner and admin tools don't. */
const NO_SEARCH = ['/auth', '/dashboard', '/account', '/admin', '/messages', '/notifications', '/checkout', '/cart', '/orders', '/campaigns', '/bookings', '/requests', '/support', '/rewards', '/help', '/legal', '/inquiry', '/saved', '/deals/mine', '/events/new', '/events/mine', '/verification'];
const showsSearch = (path: string) => !NO_SEARCH.some((p) => path === p || path.startsWith(p + '/')) && !/^\/events\/[^/]+\/edit/.test(path);

const item = 'flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-surface-muted';

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

const Count = ({ n }: { n: number }) => (n > 0 ? <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-background bg-danger px-1 text-[10px] font-bold leading-none text-[color:var(--on-danger)]">{n > 99 ? '99+' : n}</span> : null);
const Pill = ({ n }: { n: number }) => (n > 0 ? <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-[color:var(--on-danger)]">{n > 99 ? '99+' : n}</span> : null);

const THEMES: [ThemeChoice, string, LucideIcon][] = [['light', 'Light', Sun], ['dark', 'Dark', Moon], ['system', 'System', Monitor]];

/** Light / Dark / System, as icons with labels for screen readers and tooltips. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const theme = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex rounded-full border border-border bg-surface-muted p-0.5 ${className}`}>
      {THEMES.map(([v, label, Icon]) => (
        <button key={v} type="button" role="radio" aria-checked={theme === v} aria-label={label} title={label} onClick={() => setTheme(v)}
          className={`grid h-8 w-9 place-items-center rounded-full transition ${theme === v ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'}`}>
          <Icon aria-hidden className="h-4 w-4" />
        </button>
      ))}
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
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) { setLastPath(path); setMenu(false); }
  const menuRef = useDismiss(menu, () => setMenu(false));
  const unread = useQuery({ queryKey: ['unread', session?.user.id], queryFn: () => api.notifications.unread(), enabled: !!session, refetchInterval: 60_000 });
  const signOut = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh(); };

  const search = showsSearch(path);
  // Airbnb-style: the big search row tucks into a compact pill once you scroll (desktop).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 72);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const compact = search && scrolled;
  // On the home page the header starts see-through, over the hero's breathing background.
  const overHero = path === '/' && !scrolled;
  const searchRef = useRef<SiteSearchHandle>(null);
  const expand = () => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => searchRef.current?.focus(), 350); };

  const owner = businesses.length > 0;
  const initial = (profile?.display_name ?? session?.user.email ?? '?').slice(0, 1).toUpperCase();
  const avatar = mediaUrlFromPath('avatars', profile?.avatar_url);

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 ${overHero ? 'border-transparent bg-transparent' : `bg-background/95 backdrop-blur ${compact || !search ? 'border-border shadow-sm' : 'border-transparent'}`}`}>
        <div className="container-x flex h-16 items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Adey Connect home">
            <AdeyFlower size={30} />
            <span className="text-[17px] font-bold tracking-[0.16em]">ADEY CONNECT</span>
            <span className="ethiopic hidden text-sm text-text-muted sm:inline">አደይ</span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            {compact ? (
              <button type="button" onClick={expand} className="flex h-11 w-full max-w-md items-center gap-3 rounded-full border border-border bg-surface pl-5 pr-1.5 text-sm shadow-sm transition hover:shadow-md">
                <span className="flex-1 truncate text-left font-semibold">Search Adey Connect</span>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-[color:var(--on-forest)]"><Search aria-hidden className="h-4 w-4" strokeWidth={2.25} /></span>
              </button>
            ) : (
              <nav aria-label="Main" className="flex items-center gap-1">
                {sections.map(({ href, label, icon: Icon }) => {
                  const on = path === href || path.startsWith(href + '/');
                  return (
                    <Link key={href} href={href} aria-current={on ? 'page' : undefined}
                      className={`group relative flex h-16 items-center gap-2 px-3.5 text-sm font-semibold transition ${on ? 'text-text' : 'text-text-muted hover:text-text'}`}>
                      <Icon aria-hidden className={`h-[18px] w-[18px] ${on ? 'text-forest' : ''}`} />
                      {label}
                      <span aria-hidden className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-text transition ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-20'}`} />
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
            <Link href={owner ? '/dashboard' : '/dashboard/new'} className="hidden h-10 items-center rounded-full px-4 text-sm font-semibold transition hover:bg-surface-muted lg:flex">
              {owner ? 'Dashboard' : 'List your business'}
            </Link>
            {session && checkoutEnabled && <Link href="/cart" className="btn-icon" aria-label={`Cart${cart.data?.count ? `, ${cart.data.count} items` : ''}`}><ShoppingCart aria-hidden className="h-5 w-5" /><Count n={cart.data?.count ?? 0} /></Link>}
            {session && <Link href="/messages" className="btn-icon max-sm:!hidden" aria-label={`Messages${unread.data?.messages ? `, ${unread.data.messages} unread` : ''}`}><MessageCircle aria-hidden className="h-5 w-5" /><Count n={unread.data?.messages ?? 0} /></Link>}
            {session && <Link href="/notifications" className="btn-icon" aria-label={`Notifications${unread.data?.notifications ? `, ${unread.data.notifications} unread` : ''}`}><Bell aria-hidden className="h-5 w-5" /><Count n={unread.data?.notifications ?? 0} /></Link>}

            <div className="relative z-50 ml-1" ref={menuRef}>
              <button type="button" onClick={() => setMenu((o) => !o)} aria-label="Menu" aria-expanded={menu} aria-haspopup="menu"
                className={`flex h-11 items-center gap-2.5 rounded-full border border-border bg-surface pl-3.5 pr-1.5 transition hover:shadow-md ${menu ? 'shadow-md' : ''}`}>
                <Menu aria-hidden className="h-4 w-4" />
                {session ? (
                  avatar ? <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-bold text-[color:var(--on-forest)]">{initial}</span>
                ) : <CircleUser aria-hidden className="h-8 w-8 text-text-muted" strokeWidth={1.5} />}
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 top-[calc(100%+8px)] w-72 max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-[20px] border border-border bg-surface-raised p-2 shadow-lg">
                  <nav aria-label="Sections" className="border-b border-border pb-2 md:hidden">
                    {sections.map(({ href, label, icon: Icon }) => (
                      <Link key={href} role="menuitem" href={href} className={`${item} !justify-start font-semibold`}><Icon aria-hidden className="h-[18px] w-[18px] text-text-muted" />{label}</Link>
                    ))}
                  </nav>
                  {session ? (
                    <>
                      <p className="truncate px-3 pb-1 pt-2.5 text-sm font-semibold">{profile?.display_name ?? session.user.email}</p>
                      <Link role="menuitem" href="/messages" className={`${item} sm:hidden`}>Messages<Pill n={unread.data?.messages ?? 0} /></Link>
                      <Link role="menuitem" href="/notifications" className={item}>Notifications<Pill n={unread.data?.notifications ?? 0} /></Link>
                      {accountLinks.map((l) => <Link key={l.href} role="menuitem" href={l.href} className={item}>{l.label}</Link>)}
                      <div className="my-1.5 border-t border-border" />
                      <Link role="menuitem" href={owner ? '/dashboard' : '/dashboard/new'} className={item}>{owner ? 'Business dashboard' : 'List your business'}</Link>
                      {isStaff && <Link role="menuitem" href="/admin" className={item}>Admin</Link>}
                      <Link role="menuitem" href="/help" className={item}>Help centre</Link>
                    </>
                  ) : (
                    <>
                      <Link role="menuitem" href={`/auth/sign-in${path.startsWith('/auth') ? '' : `?next=${encodeURIComponent(path)}`}`} className={`${item} mt-1 font-semibold`}>Sign in</Link>
                      <Link role="menuitem" href="/auth/sign-up" className={item}>Create an account</Link>
                      <div className="my-1.5 border-t border-border" />
                      <Link role="menuitem" href="/dashboard/new" className={item}>List your business</Link>
                      <Link role="menuitem" href="/help" className={item}>Help centre</Link>
                    </>
                  )}
                  <div className="my-1.5 border-t border-border" />
                  <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">Appearance<ThemeToggle /></div>
                  {session && <><div className="my-1.5 border-t border-border" /><button role="menuitem" type="button" onClick={signOut} className={item}>Sign out</button></>}
                </div>
              )}
            </div>
          </div>
        </div>

        {search && (
          <div className={`container-x pb-3 transition-[opacity] md:pb-4 ${compact ? 'md:hidden' : ''}`}>
            <Suspense fallback={<SiteSearchFallback />}><SiteSearch ref={searchRef} /></Suspense>
          </div>
        )}
      </header>
      {/* Reserves the header's height (it is fixed so that tucking the search away never moves the page). */}
      <div aria-hidden className={search ? 'h-[124px] md:h-[144px]' : 'h-16'} />
    </>
  );
}

export function Footer() {
  const app = useAppSettings();
  const support = app?.support_email ?? 'support@adeyconnect.com';
  const col = 'space-y-2.5 text-sm text-text-muted [&_a:hover]:text-text [&_a:hover]:underline [&_a]:underline-offset-4';
  return (
    <footer className="mt-24 border-t border-border bg-surface-muted/60">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2"><AdeyFlower size={28} /><span className="font-bold tracking-[0.16em]">ADEY CONNECT</span><span className="ethiopic text-text-muted">አደይ</span></div>
          <p className="mt-4 max-w-sm text-sm text-text-muted">Find Habesha-owned businesses, see their menus and photos, and claim their deals. Listing a business is free.</p>
        </div>
        <nav aria-label="Marketplace"><h2 className="mb-4 text-sm font-semibold">Marketplace</h2><ul className={col}><li><Link href="/market">Find businesses</Link></li><li><Link href="/deals">Deals</Link></li><li><Link href="/events">Events</Link></li><li><Link href="/adconnect">AdConnect</Link></li><li><Link href="/dashboard/new">List your business for free</Link></li><li><Link href="/market?market=et">Ethiopian Market</Link></li></ul></nav>
        <nav aria-label="Company"><h2 className="mb-4 text-sm font-semibold">Support</h2><ul className={col}><li><Link href="/help">Help centre</Link></li><li><Link href="/verification">How verification works</Link></li><li><Link href="/legal/terms">Terms</Link></li><li><Link href="/legal/privacy">Privacy</Link></li><li><a href={`mailto:${support}`}>{support}</a></li></ul></nav>
      </div>
      <div className="border-t border-border">
        <div className="container-x flex flex-col-reverse items-center justify-between gap-4 py-5 text-sm text-text-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Adey Connect. Apps for iPhone and Android are on the way.</p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
