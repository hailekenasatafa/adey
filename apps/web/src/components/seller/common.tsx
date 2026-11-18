'use client';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

/** Permissions the signed-in member holds in this business (from my_access). The database enforces them too. */
export function usePerms(businessId: string) {
  const { session } = useAuth();
  const q = useQuery({ queryKey: ['access', session?.user.id], queryFn: () => api.account.access(), enabled: !!session, staleTime: 60_000 });
  const perms = q.data?.businesses.find((b) => b.business_id === businessId)?.permissions ?? [];
  return { can: (p: string) => perms.includes(p), loading: q.isLoading || (!q.data && !!session) };
}

export function useSellerOverview(businessId: string) {
  return useQuery({ queryKey: ['seller-overview', businessId], queryFn: () => api.seller.overview(businessId), staleTime: 30_000 });
}

/** Message for a form error: first zod issue, otherwise a friendly API error. */
export function errMsg(e: unknown) {
  if (e instanceof Error && 'issues' in e) {
    const i = (e as unknown as { issues: { message: string; path: (string | number)[] }[] }).issues[0];
    if (!i) return 'Check the form and try again.';
    return /^(Invalid|Too |Expected|Number|String)/.test(i.message) && i.path.length ? `${String(i.path[0]).replace(/_/g, ' ')}: ${i.message}` : i.message;
  }
  return friendlyError(e);
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}<span className="block">{children}</span></label>{hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}</div>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="mt-2 text-sm text-danger">{typeof error === 'string' ? error : friendlyError(error)}</p>;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton h-16" />)}</div>;
}

export function NoAccess({ what }: { what: string }) {
  return <div className="card mt-4 p-6 text-sm text-text-muted">{what} is managed by the business owner. Ask them to give you access, or sign in with the owner account.</div>;
}

/** Explains the two switches that gate paid orders: seller verification and the platform checkout switch. */
export function SellingNotice({ businessId }: { businessId: string }) {
  const o = useSellerOverview(businessId);
  const d = o.data;
  if (!d) return null;
  return (
    <>
      {!d.business.selling_enabled && <div className="card mt-4 border-warning/40 bg-warning/5 p-4 text-sm">Listing on Adey is free. You can take paid orders after your <Link href={`/dashboard/${businessId}/kyc`} className="font-semibold text-forest underline">seller verification</Link> is approved.</div>}
      {!d.checkout_enabled && <div className="card mt-4 p-4 text-sm text-text-muted">Online ordering is not open yet on Adey. You can prepare now — add delivery prices, payout details and products — and orders start once it opens.</div>}
    </>
  );
}

export const fileExt = (f: File) => (f.type === 'application/pdf' ? 'pdf' : f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg');

export const toInt = (s: string) => (s.trim() === '' ? null : Number.isFinite(Number(s)) ? Math.trunc(Number(s)) : NaN);
