'use client';
import { useQuery } from '@tanstack/react-query';
import type { BusinessDeal } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { DealCard } from './DealCard';

/** Active deals on a business page. Server-rendered for everyone, then refreshed with the viewer's own claims. */
export function BusinessDeals({ business, initial }: { business: { id: string; slug: string; name: string; place: string | null }; initial: BusinessDeal[] }) {
  const { session } = useAuth();
  const q = useQuery({ queryKey: ['business-deals', business.id, session?.user.id ?? 'guest'], queryFn: () => api.deals.forBusiness(business.id), enabled: !!session, staleTime: 30_000 });
  const deals = q.data ?? initial;
  if (!deals.length) return null;
  return (
    <section id="deals" className="mt-10 scroll-mt-24" aria-labelledby="deals-h">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><h2 id="deals-h" className="text-xl font-bold">Deals</h2><p className="text-sm text-text-muted">Claim on Adey, then show your code at {business.name}. Free to claim.</p></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {deals.map((d) => (
          <DealCard key={d.id} deal={{ id: d.id, title: d.title, description: d.description, terms: d.terms, image_path: d.image_path, claims_count: d.claims_count, my_claim: d.my_claim, business }} />
        ))}
      </div>
    </section>
  );
}
