'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge, Empty } from '@/components/ui';
import { mediaUrlFromPath, timeAgo } from '@/lib/media';

export default function Messages() {
  const { session, businesses } = useAuth();
  const q = useQuery({ queryKey: ['conversations', session?.user.id], queryFn: () => api.messaging.conversations(), enabled: !!session, refetchInterval: 30_000 });
  const mine = new Set(businesses.map((b) => b.id));
  return (
    <div className="container-x max-w-3xl pb-16">
      <h1 className="mt-8 text-3xl font-bold">Messages</h1>
      <div className="mt-6 card divide-y divide-border">
        {q.isLoading ? <div className="skeleton m-4 h-16" /> : !q.data?.length ? <div className="p-6"><Empty title="No conversations yet" body="Contact a business or request a quote to start one." /></div> : q.data.map((c) => {
          const me = c.participants.find((p) => p.user_id === session?.user.id);
          const unread = !!c.last_message_at && (!me?.last_read_at || new Date(c.last_message_at) > new Date(me.last_read_at));
          const asBiz = c.business_id && mine.has(c.business_id);
          const other = c.participants.find((p) => p.user_id !== session?.user.id);
          const title = asBiz ? other?.profile?.display_name ?? 'Customer' : c.business?.name ?? other?.profile?.display_name ?? 'Conversation';
          const avatar = asBiz ? other?.profile?.avatar_url : mediaUrlFromPath('business-media', c.business?.logo_url) ?? other?.profile?.avatar_url;
          return (
            <Link key={c.id} href={`/messages/${c.id}`} className="flex gap-3 p-4 hover:bg-surface-muted">
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-forest-soft font-bold text-forest">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : title[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className={`truncate ${unread ? 'font-bold' : 'font-semibold'}`}>{title}</p>{c.last_message_at && <span className="text-xs text-text-muted">{timeAgo(c.last_message_at)}</span>}</div>
                <p className={`truncate text-sm ${unread ? '' : 'text-text-muted'}`}>{c.last_message_preview ?? 'No messages yet'}</p>
                <div className="mt-1 flex gap-1">{asBiz && <Badge tone="primary">Inbox: {c.business?.name}</Badge>}{c.context_type !== 'general' && <Badge tone="neutral">{c.context_type.replace('_', ' ')}</Badge>}{unread && <Badge tone="accent">New</Badge>}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
