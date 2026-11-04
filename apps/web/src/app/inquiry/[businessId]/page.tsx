'use client';
import { Suspense } from 'react';
import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { friendlyError, inquirySchema, type InquiryInput } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';

function InquiryPageInner() {
  const { businessId } = useParams<{ businessId: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const biz = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm<InquiryInput>({ resolver: zodResolver(inquirySchema), defaultValues: { type: (sp.get('type') as 'contact' | 'quote') ?? 'contact', subject: '', message: '', contact_phone: '', product_id: sp.get('productId'), service_id: sp.get('serviceId') } });
  const kind = watch('type');
  const send = useMutation({
    mutationFn: (v: InquiryInput) => api.market.createInquiry({ business_id: businessId, from_user_id: session!.user.id, type: v.type, subject: v.subject || null, message: v.message, contact_phone: v.contact_phone || null, product_id: v.product_id ?? null, service_id: v.service_id ?? null }),
    onSuccess: (inq) => router.push(inq.conversation_id ? `/messages/${inq.conversation_id}` : `/business/${biz.data?.slug}`),
    onError: (e) => setError(friendlyError(e)),
  });
  if (!session) return <div className="container-x py-16"><p>Please <a className="text-forest underline" href={`/auth/sign-in?next=/inquiry/${businessId}`}>sign in</a> to contact this business.</p></div>;
  return (
    <div className="container-x max-w-xl py-10">
      <h1 className="text-2xl font-bold">{kind === 'quote' ? 'Request a quote' : 'Contact'} {biz.data?.name ?? ''}</h1>
      <div className="mt-4 flex gap-2"><button type="button" onClick={() => setValue('type', 'contact')} className={`chip ${kind === 'contact' ? 'chip-on' : ''}`}>Message</button><button type="button" onClick={() => setValue('type', 'quote')} className={`chip ${kind === 'quote' ? 'chip-on' : ''}`}>Request quote</button></div>
      <form onSubmit={handleSubmit((v) => send.mutate(v))} className="mt-6 space-y-4">
        <div><label className="label">Subject (optional)</label><input {...register('subject')} className="input" /></div>
        <div><label className="label">{kind === 'quote' ? 'What do you need a quote for?' : 'Your message'}</label><textarea {...register('message')} className="input min-h-32" />{formState.errors.message && <p className="text-sm text-danger">{formState.errors.message.message}</p>}</div>
        <div><label className="label">Phone (optional)</label><input {...register('contact_phone')} className="input" /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn btn-primary w-full" disabled={send.isPending}>{kind === 'quote' ? 'Send quote request' : 'Send message'}</button>
        <p className="text-center text-xs text-text-muted">Your message starts a conversation in Messages; the business is notified immediately (app and web).</p>
      </form>
    </div>
  );
}

export default function InquiryPage() {
  return <Suspense fallback={<div className="container-x py-10"><div className="skeleton h-24" /></div>}><InquiryPageInner /></Suspense>;
}
