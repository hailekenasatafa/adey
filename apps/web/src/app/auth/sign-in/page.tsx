'use client';
import { Suspense } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, signInSchema } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { AuthCard, GoogleSignIn } from '@/components/AuthCard';
import { safeNext } from '@/lib/safeNext';

function SignInInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = safeNext(sp.get('next'));
  const [error, setError] = useState<string | null>(
    sp.get('error') === 'link' ? 'That link is invalid or expired. Sign in or request a new one.'
      : sp.get('error') === 'oauth' ? 'Google sign-in didn’t finish. Try again, or sign in with your email.' : null,
  );
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema) });
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to save businesses, claim deals and message owners."
      footer={<>New to Adey? <Link href={`/auth/sign-up${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-text underline underline-offset-4">Create an account</Link></>}>
      <GoogleSignIn next={next} />
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { await api.auth.signIn(v.email, v.password); router.push(next); router.refresh(); } catch (e) { setError(friendlyError(e)); } })} className="space-y-4" noValidate>
        <div><label htmlFor="si-email" className="label">Email</label><input id="si-email" {...register('email')} type="email" autoComplete="email" className="input" />{formState.errors.email && <p className="mt-1 text-sm text-danger">{formState.errors.email.message}</p>}</div>
        <div>
          <div className="flex items-baseline justify-between"><label htmlFor="si-password" className="label">Password</label><Link href="/auth/forgot" className="text-sm font-semibold text-text-muted underline-offset-4 hover:text-text hover:underline">Forgot password?</Link></div>
          <input id="si-password" {...register('password')} type="password" autoComplete="current-password" className="input" />{formState.errors.password && <p className="mt-1 text-sm text-danger">{formState.errors.password.message}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={formState.isSubmitting}>Sign in</button>
      </form>
    </AuthCard>
  );
}

export default function SignIn() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><SignInInner /></Suspense>;
}
