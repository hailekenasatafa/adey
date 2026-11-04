import React from 'react';
import { requestStatusLabels, type Enums } from '@adey/shared';
import { Badge } from '@/components/ui';

export function RequestStatusBadge({ status, lastOfferBy, viewer }: { status: Enums<'request_status'>; lastOfferBy?: Enums<'offer_party'>; viewer?: Enums<'offer_party'> }) {
  const waitingOnMe = (status === 'pending' || status === 'countered') && lastOfferBy && viewer && lastOfferBy !== viewer;
  const label = waitingOnMe ? 'Your response needed' : status === 'countered' ? 'Counteroffer sent' : status === 'pending' ? 'Awaiting owner' : requestStatusLabels[status];
  const tone = status === 'accepted' ? 'success' : waitingOnMe ? 'warning' : status === 'countered' ? 'info' : status === 'pending' ? 'neutral' : status === 'declined' || status === 'expired' ? 'danger' : 'neutral';
  return <Badge label={label} tone={tone} />;
}

export function BookingStatusBadge({ status }: { status: Enums<'booking_status'> }) {
  const tone = status === 'completed' ? 'success' : status === 'in_progress' ? 'info' : status === 'confirmed' ? 'primary' : status === 'disputed' ? 'danger' : 'neutral';
  return <Badge label={status.replace('_', ' ')} tone={tone} />;
}

export function PaymentStatusBadge({ status, monetized }: { status: Enums<'payment_status'>; monetized: boolean }) {
  if (!monetized || status === 'not_required') return <Badge label="Settled directly (free mode)" tone="neutral" />;
  return <Badge label={`Payment: ${status}`} tone={status === 'paid' ? 'success' : status === 'failed' ? 'danger' : 'warning'} />;
}

export function DeliveryStatusBadge({ status }: { status: Enums<'delivery_status'> }) {
  const tone = status === 'completed' ? 'success' : status === 'running' ? 'info' : status === 'awaiting_creative' ? 'warning' : 'neutral';
  return <Badge label={`Delivery: ${status.replace('_', ' ')}`} tone={tone} />;
}

export function CampaignStatusBadge({ status }: { status: Enums<'campaign_status'> }) {
  const tone = status === 'active' ? 'success' : status === 'submitted' ? 'info' : status === 'completed' ? 'primary' : status === 'cancelled' ? 'danger' : 'neutral';
  return <Badge label={status} tone={tone} />;
}
