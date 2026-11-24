'use client';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

type Target = 'business' | 'review' | 'deal' | 'event' | 'product' | 'screen' | 'message' | 'user' | 'conversation';
const REASONS = ['Fake or misleading', 'Scam or spam', 'Offensive, hateful or harassing', 'Wrong or outdated information', 'Something else'];

/** "Report" link that opens a short form; reports go to the Adey moderation queue. */
export function ReportButton({ targetType, targetId, label = 'Report', className = '' }: { targetType: Target; targetId: string; label?: string; className?: string }) {
  const { session } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => api.messaging.report({ reporter_id: session!.user.id, target_type: targetType, target_id: targetId, reason: details.trim() ? `${reason}: ${details.trim()}` : reason }),
    onError: (e) => setError(friendlyError(e)),
  });
  const cls = `text-xs font-semibold text-text-muted underline-offset-4 hover:text-danger hover:underline ${className}`;
  if (!session) return <Link href={`/auth/sign-in?next=${encodeURIComponent(path)}`} className={cls}><Flag aria-hidden className="h-3.5 w-3.5" />{label}</Link>;
  return (
    <>
      <button type="button" onClick={() => { setOpen(true); send.reset(); setError(null); }} className={cls}><Flag aria-hidden className="h-3.5 w-3.5" />{label}</button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Report">
          <div className="card w-full max-w-md p-5">
            {send.isSuccess ? (
              <>
                <h2 className="text-lg font-bold">Thanks for telling us</h2>
                <p className="mt-2 text-sm text-text-muted">The Adey team will review this. We may hide it or contact the people involved.</p>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-primary btn-sm mt-4" autoFocus>Done</button>
              </>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
                <h2 className="text-lg font-bold">What's wrong?</h2>
                <fieldset className="mt-3 space-y-1.5">
                  <legend className="sr-only">Reason</legend>
                  {REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm"><input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="h-4 w-4 accent-[var(--forest)]" />{r}</label>
                  ))}
                </fieldset>
                <label className="label mt-3" htmlFor="report-details">Details (optional)</label>
                <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1500} className="input min-h-20" />
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button className="btn btn-primary btn-sm" disabled={send.isPending}>{send.isPending ? 'Sending…' : 'Send report'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
