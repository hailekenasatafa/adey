'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { friendlyError, passwordSchema } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { AuthCard } from '@/components/AuthCard';

/** Landing page for recovery links (also used by the mobile app's reset emails). */
export default function Reset() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={async (e) => { e.preventDefault(); const r = passwordSchema.safeParse(pw); if (!r.success) return setError(r.error.issues[0].message); try { await api.auth.updatePassword(pw); router.push('/'); router.refresh(); } catch (err) { setError(friendlyError(err)); } }} className="space-y-4">
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="input" placeholder="At least 8 characters" aria-label="New password" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full">Update password</button>
      </form>
      <p className="mt-4 text-xs text-text-muted">Opened this from the mobile app? After updating, return to the app and sign in with the new password.</p>
    </AuthCard>
  );
}
