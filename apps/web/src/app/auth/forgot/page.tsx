'use client';
import { useState } from 'react';
import { friendlyError } from '@adey/shared';
import Link from 'next/link';
import { api, SITE_URL } from '@/lib/supabase/client';
import { AuthCard } from '@/components/AuthCard';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | string>('idle');
  return (
    <AuthCard title="Reset your password" subtitle="Enter the email you signed up with and we’ll send you a reset link." footer={<Link href="/auth/sign-in" className="font-semibold text-text underline underline-offset-4">Back to sign in</Link>}>
      {state === 'sent' ? <p className="text-success">If an account exists for that email, a reset link is on its way.</p> : (
        <form onSubmit={async (e) => { e.preventDefault(); try { await api.auth.resetPassword(email, `${SITE_URL}/auth/callback?type=recovery`); setState('sent'); } catch (err) { setState(friendlyError(err)); } }} className="space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" aria-label="Email" autoComplete="email" />
          {state !== 'idle' && state !== 'sent' && <p className="text-sm text-danger">{state}</p>}
          <button className="btn btn-primary w-full">Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}
