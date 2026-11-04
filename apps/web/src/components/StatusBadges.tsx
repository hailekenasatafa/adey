import { requestStatusLabels, type Enums } from '@adey/shared';
import { Badge } from './ui';

export function RequestStatus({ status, lastOfferBy, viewer }: { status: Enums<'request_status'>; lastOfferBy?: Enums<'offer_party'>; viewer?: Enums<'offer_party'> }) {
  const mine = (status === 'pending' || status === 'countered') && lastOfferBy && viewer && lastOfferBy !== viewer;
  return <Badge tone={status === 'accepted' ? 'success' : mine ? 'warning' : status === 'countered' ? 'info' : status === 'declined' || status === 'expired' ? 'danger' : 'neutral'}>{mine ? 'Your response needed' : status === 'countered' ? 'Counteroffer sent' : status === 'pending' ? 'Awaiting owner' : requestStatusLabels[status]}</Badge>;
}
export function BookingStatus({ status }: { status: Enums<'booking_status'> }) {
  return <Badge tone={status === 'completed' ? 'success' : status === 'in_progress' ? 'info' : status === 'confirmed' ? 'primary' : status === 'disputed' ? 'danger' : 'neutral'}>{status.replace('_', ' ')}</Badge>;
}
export function PaymentStatus({ status, monetized }: { status: Enums<'payment_status'>; monetized: boolean }) {
  if (!monetized || status === 'not_required') return <Badge tone="neutral">Settled directly (free mode)</Badge>;
  return <Badge tone={status === 'paid' ? 'success' : status === 'failed' ? 'danger' : 'warning'}>Payment: {status}</Badge>;
}
export function DeliveryStatus({ status }: { status: Enums<'delivery_status'> }) {
  return <Badge tone={status === 'completed' ? 'success' : status === 'running' ? 'info' : status === 'awaiting_creative' ? 'warning' : 'neutral'}>Delivery: {status.replace('_', ' ')}</Badge>;
}
