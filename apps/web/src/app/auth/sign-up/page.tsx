'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, signUpSchema } from '@adey/shared';
import { api, SITE_URL } from '@/lib/supabase/client';
import { AuthCard, GoogleSignIn } from '@/components/AuthCard';
import { safeNext } from '@/lib/safeNext';

function SignUpInner() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signUpSchema>>({ resolver: zodResolver(signUpSchema) });
  if (sent) return <AuthCard title="Check your email" subtitle={<>We sent a confirmation link to <b className="text-text">{sent}</b>. Open it to finish creating your account.</>}><button onClick={() => api.auth.resendVerification(sent)} className="btn btn-outline w-full">Resend email</button></AuthCard>;
  return (
    <AuthCard title="Create your account" subtitle="Browse without an account. Sign up to save, message, list a business or advertise."
      footer={<>Already have an account? <Link href={`/auth/sign-in${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-text underline underline-offset-4">Sign in</Link></>}>
      <GoogleSignIn next={next} />
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { const r = await api.auth.signUp(v.email, v.password, v.displayName, `${SITE_URL}/auth/callback`); if (r.session) { router.push(next); router.refresh(); } else setSent(v.email); } catch (e) { setError(friendlyError(e)); } })} className="space-y-4" noValidate>
        <div><label className="label">Your name</label><input {...register('displayName')} className="input" />{formState.errors.displayName && <p className="text-sm text-danger">{formState.errors.displayName.message}</p>}</div>
        <div><label className="label">Email</label><input {...register('email')} type="email" className="input" />{formState.errors.email && <p className="text-sm text-danger">{formState.errors.email.message}</p>}</div>
        <div><label className="label">Password</label><input {...register('password')} type="password" autoComplete="new-password" className="input" />{formState.errors.password && <p className="text-sm text-danger">{formState.errors.password.message}</p>}</div>
        <div><label className="label">Confirm password</label><input {...register('confirmPassword')} type="password" className="input" />{formState.errors.confirmPassword && <p className="text-sm text-danger">{formState.errors.confirmPassword.message}</p>}</div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={formState.isSubmitting}>Create account</button>
        <p className="text-center text-xs text-text-muted">By creating an account you agree to Adey's <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
      </form>
      <p className="mt-4 text-center text-xs text-text-muted">Continuing with Google also means you agree to Adey’s <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.</p>
    </AuthCard>
  );
}

export default function SignUp() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><SignUpInner /></Suspense>;
}
