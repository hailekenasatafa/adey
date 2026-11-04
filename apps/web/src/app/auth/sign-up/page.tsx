'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, signUpSchema } from '@adey/shared';
import { api, SITE_URL } from '@/lib/supabase/client';
import { AdeyFlower } from '@/components/ui';

export default function SignUp() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema) });
  if (sent) return <div className="container-x max-w-md py-16"><AdeyFlower size={44} /><h1 className="mt-4 text-3xl font-bold">Verify your email</h1><p className="mt-2 text-text-muted">We sent a confirmation link to <b>{sent}</b>. Open it to finish creating your account.</p><button onClick={() => api.auth.resendVerification(sent)} className="btn btn-ghost mt-4">Resend email</button></div>;
  return (
    <div className="container-x max-w-md py-16">
      <AdeyFlower size={44} />
      <h1 className="mt-4 text-3xl font-bold">Create your account</h1>
      <p className="text-text-muted">Browse without an account; sign up to save, message, list a business, or advertise.</p>
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { const r = await api.auth.signUp(v.email, v.password, v.displayName, `${SITE_URL}/auth/callback`); if (r.session) { router.push('/'); router.refresh(); } else setSent(v.email); } catch (e) { setError(friendlyError(e)); } })} className="mt-8 space-y-4">
        <div><label className="label">Your name</label><input {...register('displayName')} className="input" />{formState.errors.displayName && <p className="text-sm text-danger">{formState.errors.displayName.message}</p>}</div>
        <div><label className="label">Email</label><input {...register('email')} type="email" className="input" />{formState.errors.email && <p className="text-sm text-danger">{formState.errors.email.message}</p>}</div>
        <div><label className="label">Password</label><input {...register('password')} type="password" autoComplete="new-password" className="input" />{formState.errors.password && <p className="text-sm text-danger">{formState.errors.password.message}</p>}</div>
        <div><label className="label">Confirm password</label><input {...register('confirmPassword')} type="password" className="input" />{formState.errors.confirmPassword && <p className="text-sm text-danger">{formState.errors.confirmPassword.message}</p>}</div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={formState.isSubmitting}>Create account</button>
        <p className="text-center text-xs text-text-muted">By continuing you agree to Adey's <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
      <p className="mt-6 text-center text-sm text-text-muted">Already have an account? <Link href="/auth/sign-in" className="font-semibold text-forest">Sign in</Link></p>
    </div>
  );
}
