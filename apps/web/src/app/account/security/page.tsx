'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { emailSchema, friendlyError, passwordSchema } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

type Msg = { ok: boolean; text: string } | null;
const Status = ({ m }: { m: Msg }) => (m ? <p role={m.ok ? 'status' : 'alert'} className={`text-sm ${m.ok ? 'text-success' : 'text-danger'}`}>{m.text}</p> : null);

export default function Security() {
  const { session } = useAuth();
  const router = useRouter();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [email, setEmail] = useState(''); const [emMsg, setEmMsg] = useState<Msg>(null);
  const changePw = useMutation({
    mutationFn: async () => {
      const r = passwordSchema.safeParse(pw);
      if (!r.success) throw new Error(r.error.issues[0].message);
      if (pw !== pw2) throw new Error('Passwords do not match');
      await api.auth.updatePassword(pw);
    },
    onSuccess: () => { setPw(''); setPw2(''); setPwMsg({ ok: true, text: 'Password updated.' }); },
    onError: (e) => setPwMsg({ ok: false, text: friendlyError(e) }),
  });
  const changeEmail = useMutation({
    mutationFn: async () => {
      const r = emailSchema.safeParse(email);
      if (!r.success) throw new Error(r.error.issues[0].message);
      await api.account.changeEmail(r.data, `${window.location.origin}/auth/callback`);
    },
    onSuccess: () => { setEmail(''); setEmMsg({ ok: true, text: 'We sent a confirmation email. Your address changes once you confirm it (you may need to confirm from both the old and the new address).' }); },
    onError: (e) => setEmMsg({ ok: false, text: friendlyError(e) }),
  });
  const out = useMutation({ mutationFn: () => api.account.signOutEverywhere(), onSuccess: () => { router.push('/'); router.refresh(); } });
  if (!session) return null;
  return (
    <div className="space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); setPwMsg(null); changePw.mutate(); }} className="card space-y-3 p-5" aria-labelledby="pw-h">
        <h2 id="pw-h" className="font-semibold">Change password</h2>
        <div><label htmlFor="sec-pw" className="label">New password</label><input id="sec-pw" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /><p className="mt-1 text-xs text-text-muted">At least 8 characters.</p></div>
        <div><label htmlFor="sec-pw2" className="label">Confirm new password</label><input id="sec-pw2" type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
        <Status m={pwMsg} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={changePw.isPending}>{changePw.isPending ? 'Saving…' : 'Update password'}</button>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); setEmMsg(null); changeEmail.mutate(); }} className="card space-y-3 p-5" aria-labelledby="em-h">
        <h2 id="em-h" className="font-semibold">Change email</h2>
        <p className="text-sm text-text-muted">Current email: {session.user.email}. We send a confirmation email before the change takes effect.</p>
        <div><label htmlFor="sec-em" className="label">New email</label><input id="sec-em" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <Status m={emMsg} />
        <button type="submit" className="btn btn-primary btn-sm" disabled={changeEmail.isPending}>{changeEmail.isPending ? 'Sending…' : 'Send confirmation'}</button>
      </form>

      <section className="card p-5" aria-labelledby="so-h">
        <h2 id="so-h" className="font-semibold">Sign out on all devices</h2>
        <p className="mt-1 text-sm text-text-muted">Ends every session, including this one. Use it if you lost a device or think someone else has access.</p>
        <button className="btn btn-outline btn-sm mt-3" disabled={out.isPending} onClick={() => confirm('Sign out everywhere?') && out.mutate()}>{out.isPending ? 'Signing out…' : 'Sign out everywhere'}</button>
        {out.error && <p role="alert" className="mt-2 text-sm text-danger">{friendlyError(out.error)}</p>}
      </section>
    </div>
  );
}
