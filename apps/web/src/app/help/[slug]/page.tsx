import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { helpCategoryLabels } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/media';
import { Paragraphs } from '@/components/community/common';

type Props = { params: Promise<{ slug: string }> };
const load = async (slug: string) => (await serverApi()).support.article(slug).catch(() => null);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).slug);
  return a ? { title: a.title, description: a.summary ?? undefined } : { title: 'Help article' };
}

export default async function HelpArticle({ params }: Props) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  const related = (await (await serverApi()).support.articles(a.category).catch(() => [])).filter((r) => r.slug !== a.slug).slice(0, 5);
  return (
    <div className="container-x max-w-3xl pb-16">
      <nav aria-label="Breadcrumb" className="mt-6 text-sm text-text-muted"><Link href="/help" className="hover:underline">Help centre</Link> / <span>{helpCategoryLabels[a.category] ?? 'More help'}</span></nav>
      <article className="mt-4">
        <h1 className="text-3xl font-bold">{a.title}</h1>
        {a.summary && <p className="mt-2 text-lg text-text-muted">{a.summary}</p>}
        <Paragraphs text={a.body} className="mt-6 leading-relaxed" />
        <p className="mt-6 text-xs text-text-muted">Last updated {fmtDate(a.updated_at)}</p>
      </article>
      <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 p-5"><div><p className="font-semibold">Still need help?</p><p className="text-sm text-text-muted">Ask the assistant. A person can join the conversation if needed.</p></div><Link href="/support" className="btn btn-primary btn-sm">Ask the assistant</Link></div>
      {related.length > 0 && <section className="mt-10"><h2 className="text-lg font-bold">Related articles</h2><ul className="mt-3 space-y-2">{related.map((r) => <li key={r.slug}><Link href={`/help/${r.slug}`} className="card block p-3 text-sm hover:shadow-md"><b>{r.title}</b>{r.summary && <span className="block text-text-muted">{r.summary}</span>}</Link></li>)}</ul></section>}
    </div>
  );
}
