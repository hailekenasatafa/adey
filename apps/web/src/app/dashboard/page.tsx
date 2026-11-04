'use client';
import Link from 'next/link';
import { useAuth } from '@/components/Providers';
import { Badge, Empty, VerificationBadges } from '@/components/ui';
import { mediaUrlFromPath } from '@/lib/media';

export default function DashboardHome() {
  const { businesses, loading } = useAuth();
  return (
    <div className="container-x pb-16">
      <div className="mt-8 flex items-center justify-between"><h1 className="text-3xl font-bold">My businesses</h1><Link href="/dashboard/new" className="btn btn-primary btn-sm">+ Add business</Link></div>
      <p className="text-text-muted">Manage listings, products, screens, campaigns, and verification. Everything here is shared with the Adey app.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? <div className="skeleton h-28" /> : businesses.length === 0 ? <div className="sm:col-span-3"><Empty title="List your first business" body="It's free. Your business starts as a draft; publish when the profile looks right. Listing also unlocks AdConnect as an advertiser or screen owner." action={<Link href="/dashboard/new" className="btn btn-primary">Create business profile</Link>} /></div> : businesses.map((b) => (
          <Link key={b.id} href={`/dashboard/${b.id}`} className="card flex items-center gap-4 p-4 hover:shadow-md">
            <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-[14px] bg-forest-soft text-forest font-bold">{b.logo_url ? <img src={mediaUrlFromPath('business-media', b.logo_url)!} alt="" className="h-full w-full object-cover" /> : b.name[0]}</div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.name}</p>
              <div className="mt-1 flex flex-wrap gap-1"><Badge tone={b.status === 'published' ? 'success' : b.status === 'suspended' ? 'danger' : 'warning'}>{b.status}</Badge><Badge tone="neutral">{b.market === 'us' ? 'US' : 'Ethiopian'} Market</Badge><Badge tone="neutral">{b.role}</Badge>{(b.screen_count ?? 0) > 0 && <Badge tone="accent">{b.screen_count} screen{b.screen_count === 1 ? '' : 's'}</Badge>}</div>
              <div className="mt-1"><VerificationBadges badges={b.badges} compact /></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
