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
import { AdeyFlower } from '@/components/ui';

function SignInInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(sp.get('error') === 'link' ? 'That link is invalid or expired. Sign in or request a new one.' : null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema) });
  return (
    <div className="container-x max-w-md py-16">
      <AdeyFlower size={44} />
      <h1 className="mt-4 text-3xl font-bold">Welcome back</h1>
      <p className="text-text-muted">One account for shopping, your business, advertising, and your screens.</p>
      <form onSubmit={handleSubmit(async (v) => { setError(null); try { await api.auth.signIn(v.email, v.password); router.push(sp.get('next') ?? '/'); router.refresh(); } catch (e) { setError(friendlyError(e)); } })} className="mt-8 space-y-4">
        <div><label className="label">Email</label><input {...register('email')} type="email" autoComplete="email" className="input" />{formState.errors.email && <p className="text-sm text-danger">{formState.errors.email.message}</p>}</div>
        <div><label className="label">Password</label><input {...register('password')} type="password" autoComplete="current-password" className="input" />{formState.errors.password && <p className="text-sm text-danger">{formState.errors.password.message}</p>}</div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={formState.isSubmitting}>Sign in</button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-2 text-sm"><Link href="/auth/forgot" className="font-semibold text-forest">Forgot password?</Link><p className="text-text-muted">New to Adey? <Link href="/auth/sign-up" className="font-semibold text-forest">Create an account</Link></p></div>
    </div>
  );
}

export default function SignIn() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><SignInInner /></Suspense>;
}
