'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/Providers';
import { Empty } from '@/components/ui';

const NAV = [['/admin', 'Verifications'], ['/admin/reports', 'Reports'], ['/admin/disputes', 'Disputes'], ['/admin/businesses', 'Businesses'], ['/admin/settings', 'Settings & flags']];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isStaff, loading } = useAuth();
  const path = usePathname();
  if (loading) return <div className="container-x py-10"><div className="skeleton h-24" /></div>;
  if (!isStaff) return <div className="container-x py-16"><Empty title="Staff only" body="Your account doesn't have moderation permissions." /></div>;
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">Administration</h1><span className="badge badge-danger">Staff</span></div>
      <nav className="mt-4 flex flex-wrap gap-2">{NAV.map(([h, l]) => <Link key={h} href={h} className={`chip ${path === h ? 'chip-on' : ''}`}>{l}</Link>)}</nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
