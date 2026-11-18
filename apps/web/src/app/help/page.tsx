import Link from 'next/link';
import { serverApi } from '@/lib/supabase/server';
import { HelpBrowser, type HelpItem } from '@/components/community/HelpBrowser';

export const metadata = { title: 'Help centre', description: 'Answers about orders, delivery, payments, refunds, selling, badges, rewards and your account.' };
export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  const api = await serverApi();
  const articles: HelpItem[] = await api.support.articles().catch(() => []);
  return (
    <div className="container-x max-w-4xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Help centre</h1>
      <p className="mt-1 text-text-muted">Find answers fast, or ask our automated assistant. You can always reach a person.</p>
      <HelpBrowser articles={articles} />
      <div className="card mt-10 flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold">Still need help?</p><p className="text-sm text-text-muted">Ask the assistant. It can hand your conversation to the Adey support team.</p></div><Link href="/support" className="btn btn-primary btn-sm">Ask the assistant</Link></div>
    </div>
  );
}
