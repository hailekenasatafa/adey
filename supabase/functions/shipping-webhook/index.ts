// ADEY — carrier tracking webhook (Shippo "track_updated"). Deploy with JWT verification OFF.
//
// Shippo does not sign its requests; the endpoint URL carries a secret token instead (their documented approach):
//   https://<project-ref>.supabase.co/functions/v1/shipping-webhook?token=<SHIPPO_WEBHOOK_TOKEN>
// Use a long random value (32+ characters) and register the URL in Shippo for the "track_updated" event.
//
// Labels bought through shipping-label are tracked automatically. Every carrier scan lands here and
// moves the shipment and, through the database, the order: first scan -> shipped, delivery scan ->
// delivered (which starts the buyer's confirmation window before the seller is paid).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { safeEqual } from '../_shared/http.ts';
import { serviceClient } from '../_shared/clients.ts';

type TrackingStatus = {
  status?: string; status_details?: string; status_date?: string;
  substatus?: { code?: string } | null;
  location?: { city?: string; state?: string; country?: string } | null;
};
type Payload = { event?: string; data?: { tracking_number?: string; carrier?: string; eta?: string | null; tracking_status?: TrackingStatus | null } };
type ShipmentStatus = 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'exception' | 'returned';

const FINAL = ['delivered', 'returned', 'cancelled'];
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mapStatus(t: TrackingStatus): ShipmentStatus | null {
  switch ((t.status ?? '').toUpperCase()) {
    case 'PRE_TRANSIT': return 'label_created';
    case 'TRANSIT': return t.substatus?.code === 'out_for_delivery' ? 'out_for_delivery' : 'in_transit';
    case 'DELIVERED': return 'delivered';
    case 'RETURNED': return 'returned';
    case 'FAILURE': return 'exception';
    default: return null; // UNKNOWN: the carrier has nothing to report yet
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return respond({ error: 'method not allowed' }, 405);
  const expected = Deno.env.get('SHIPPO_WEBHOOK_TOKEN') ?? '';
  const given = new URL(req.url).searchParams.get('token') ?? '';
  if (expected.length < 24 || !safeEqual(given, expected)) return respond({ error: 'unauthorized' }, 401);

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return respond({ error: 'invalid payload' }, 400);
  }
  const data = payload.data;
  const number = typeof data?.tracking_number === 'string' ? data.tracking_number.trim() : '';
  if (payload.event !== 'track_updated' || !number || !data?.tracking_status) return respond({ received: true, ignored: true });
  const status = mapStatus(data.tracking_status);
  if (!status) return respond({ received: true, ignored: true });

  const admin = serviceClient();
  const { data: current } = await admin.from('shipments').select('status,events').eq('tracking_number', number)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!current) return respond({ received: true, matched: false });

  const occurredAt = data.tracking_status.status_date ?? null;
  const events = Array.isArray(current.events) ? (current.events as Record<string, unknown>[]) : [];
  const last = events[events.length - 1];
  // carriers repeat scans, and deliver them late and out of order
  if (last && last.status === status && (last.occurred_at ?? null) === occurredAt) return respond({ received: true, duplicate: true });
  if (FINAL.includes(current.status as string) && current.status !== status) return respond({ received: true, ignored: true });

  const place = data.tracking_status.location;
  const event = {
    message: (data.tracking_status.status_details ?? '').slice(0, 300) || null,
    location: [place?.city, place?.state, place?.country].filter(Boolean).join(', ') || null,
    carrier: data.carrier ?? null,
    occurred_at: occurredAt,
  };
  const eta = typeof data.eta === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data.eta) ? data.eta.slice(0, 10) : null;
  const { data: matched, error } = await admin.rpc('shipment_tracking_update', { p_tracking_number: number, p_status: status, p_event: event, p_eta: eta });
  if (error) {
    console.error('tracking update failed', number, error.message);
    return respond({ error: 'could not record the update' }, 500); // the carrier service retries
  }
  return respond({ received: true, matched: matched === true });
});
