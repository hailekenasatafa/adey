'use client';
import Link from 'next/link';
import { useAdconnect } from '@/lib/settings';
import { Empty } from '@/components/ui';

/**
 * Shows the AdConnect campaign / request / booking pages only while Adey has them switched on
 * (platform setting adconnect.campaigns_enabled). The pages and their data are kept, just not offered.
 */
export function CampaignsGate({ children, inline = false }: { children: React.ReactNode; inline?: boolean }) {
  const { campaignsEnabled, loading } = useAdconnect();
  const wrap = inline ? 'py-4' : 'container-x max-w-xl py-16';
  if (loading) return <div className={wrap}><div className="skeleton h-24" /></div>;
  if (!campaignsEnabled) {
    return (
      <div className={wrap}>
        <Empty title="Contact screen owners directly"
          body="AdConnect connects advertisers with screen owners. Find a screen, then use Contact screen owner to agree dates, price and payment between yourselves. Adey's campaign and booking tools are switched off."
          action={<Link href="/adconnect" className="btn btn-primary btn-sm">Browse screens</Link>} />
      </div>
    );
  }
  return <>{children}</>;
}
