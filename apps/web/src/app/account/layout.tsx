'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: [string, string][] = [['/account', 'Profile'], ['/account/addresses', 'Addresses'], ['/account/privacy', 'Privacy'], ['/account/security', 'Security']];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Account</h1>
      <nav aria-label="Account sections" className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`chip shrink-0 ${path === href ? 'chip-on' : ''}`}>{label}</Link>)}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
