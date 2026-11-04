'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { friendlyError, passwordSchema } from '@adey/shared';
import { api } from '@/lib/supabase/client';

/** Landing page for recovery links (also used by the mobile app's reset emails). */
export default function Reset() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="container-x max-w-md py-16">
      <h1 className="text-3xl font-bold">Choose a new password</h1>
      <form onSubmit={async (e) => { e.preventDefault(); const r = passwordSchema.safeParse(pw); if (!r.success) return setError(r.error.issues[0].message); try { await api.auth.updatePassword(pw); router.push('/'); router.refresh(); } catch (err) { setError(friendlyError(err)); } }} className="mt-6 space-y-4">
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="input" placeholder="At least 8 characters" />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full">Update password</button>
      </form>
      <p className="mt-4 text-xs text-text-muted">Opened this from the mobile app? After updating, return to the app and sign in with the new password.</p>
    </div>
  );
}
