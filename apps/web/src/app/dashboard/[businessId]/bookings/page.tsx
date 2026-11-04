'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { formatMoney } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { BookingStatus, DeliveryStatus, PaymentStatus } from '@/components/StatusBadges';
import { fmtRange } from '@/lib/media';

export default function Bookings() {
  const { businessId } = useParams<{ businessId: string }>();
  const q = useQuery({ queryKey: ['bookings', businessId], queryFn: () => api.adconnect.bookings(businessId) });
  return (
    <div>
      <h1 className="text-2xl font-bold">Bookings</h1>
      <div className="mt-4 space-y-3">{q.isLoading ? <div className="skeleton h-24" /> : !q.data?.length ? <Empty title="No bookings yet" body="Accepted advertising requests become bookings and appear here for both parties." /> : q.data.map((b) => { const asOwner = b.screen_business_id === businessId; const other = asOwner ? b.advertiser : b.screenOwner; return (
        <Link key={b.id} href={`/bookings/${b.id}`} className="card block p-4 hover:shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{other?.name}</p><p className="text-xs text-text-muted">{b.campaign?.name} · {b.screen?.title} · {fmtRange(b.start_date, b.end_date)}</p></div><p className="text-xl font-bold text-forest">{formatMoney(asOwner ? b.net_to_owner_cents : b.agreed_price_cents, b.currency)}</p></div>
          <div className="mt-2 flex flex-wrap gap-1"><BookingStatus status={b.status} /><DeliveryStatus status={b.delivery_status} /><PaymentStatus status={b.payment_status} monetized={b.monetized} /><Badge tone="neutral">{asOwner ? 'You host' : 'You advertise'}</Badge></div>
        </Link>
      ); })}</div>
    </div>
  );
}
