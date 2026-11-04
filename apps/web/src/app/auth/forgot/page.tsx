'use client';
import { useState } from 'react';
import { friendlyError } from '@adey/shared';
import { api, SITE_URL } from '@/lib/supabase/client';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | string>('idle');
  return (
    <div className="container-x max-w-md py-16">
      <h1 className="text-3xl font-bold">Reset your password</h1>
      {state === 'sent' ? <p className="mt-4 text-success">If an account exists for that email, a reset link is on its way.</p> : (
        <form onSubmit={async (e) => { e.preventDefault(); try { await api.auth.resetPassword(email, `${SITE_URL}/auth/callback?type=recovery`); setState('sent'); } catch (err) { setState(friendlyError(err)); } }} className="mt-6 space-y-4">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" />
          {state !== 'idle' && state !== 'sent' && <p className="text-sm text-danger">{state}</p>}
          <button className="btn btn-primary w-full">Send reset link</button>
        </form>
      )}
    </div>
  );
}
