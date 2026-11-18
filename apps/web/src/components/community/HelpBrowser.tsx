'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { helpCategoryLabels } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { Badge, Empty } from '@/components/ui';
import { ErrorLine } from './common';

export type HelpItem = { slug: string; title: string; summary: string | null; category: string; audience: string };
const AUD: Record<string, string> = { buyers: 'For buyers', sellers: 'For sellers' };

function Row({ a }: { a: HelpItem }) {
  return (
    <li><Link href={`/help/${a.slug}`} className="card block p-4 transition hover:shadow-md">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{a.title}</h3>{AUD[a.audience] && <Badge>{AUD[a.audience]}</Badge>}</div>
      {a.summary && <p className="mt-1 text-sm text-text-muted">{a.summary}</p>}
    </Link></li>
  );
}

export function HelpBrowser({ articles }: { articles: HelpItem[] }) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(text.trim()), 300); return () => clearTimeout(t); }, [text]);
  const searching = term.length >= 2;
  const res = useQuery({ queryKey: ['help-search', term], queryFn: () => api.support.searchHelp(term), enabled: searching });
  const groups = Object.entries(helpCategoryLabels).map(([k, label]) => [k, label, articles.filter((a) => a.category === k)] as const).filter(([, , rows]) => rows.length);
  return (
    <div>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="mt-6">
        <label htmlFor="help-q" className="sr-only">Search the help centre</label>
        <input id="help-q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search for an answer, e.g. refund, shipping, rewards" className="input" />
      </form>
      {searching ? (
        <section className="mt-6" aria-live="polite">
          <h2 className="text-lg font-bold">Results for “{term}”</h2>
          <ul className="mt-3 space-y-3">
            {res.isLoading ? <li><div className="skeleton h-20" /></li>
              : res.error ? <li><ErrorLine error={res.error} retry={() => res.refetch()} /></li>
              : !res.data?.length ? <li><Empty title="No matching articles" body="Try other words, or ask the assistant." action={<Link href="/support" className="btn btn-primary btn-sm">Ask the assistant</Link>} /></li>
              : res.data.map((a) => <Row key={a.slug} a={{ ...a, audience: 'all' }} />)}
          </ul>
        </section>
      ) : !groups.length ? <div className="mt-6"><Empty title="No articles yet" body="Help articles will appear here." /></div>
        : groups.map(([k, label, rows]) => (
          <section key={k} className="mt-8" aria-labelledby={`h-${k}`}>
            <h2 id={`h-${k}`} className="text-xl font-bold">{label}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{rows.map((a) => <Row key={a.slug} a={a} />)}</ul>
          </section>
        ))}
    </div>
  );
}
