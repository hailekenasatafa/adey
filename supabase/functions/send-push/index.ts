// ADEY — push delivery worker.
// Drains unpushed rows from public.notifications, sends them through the Expo
// Push API, and marks invalid/expired device tokens so they are never retried.
// Invoke on a schedule (pg_cron -> pg_net, or Supabase Scheduled Functions) or
// from a database webhook on notifications INSERT.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isAuthorizedWorker, unauthorized } from '../_shared/worker-auth.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH = 100;

type NotificationRow = { id: string; user_id: string; title: string; body: string | null; data: Record<string, unknown>; type: string };
type TokenRow = { id: string; user_id: string; token: string };
type ExpoTicket = { status: 'ok' | 'error'; id?: string; message?: string; details?: { error?: string } };

Deno.serve(async (req) => {
  // Protect the endpoint (fails closed): see _shared/worker-auth.ts.
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (!(await isAuthorizedWorker(req, sb))) return unauthorized();

  const { data: pending, error } = await sb.from('notifications').select('id,user_id,title,body,data,type').is('pushed_at', null).order('created_at').limit(BATCH);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!pending?.length) return Response.json({ sent: 0 });

  const userIds = [...new Set((pending as NotificationRow[]).map((n) => n.user_id))];
  const { data: tokens } = await sb.from('push_tokens').select('id,user_id,token').in('user_id', userIds).eq('is_valid', true);
  const { data: profiles } = await sb.from('profiles').select('id,notification_prefs').in('id', userIds);
  const pushAllowed = new Map((profiles ?? []).map((p: { id: string; notification_prefs: Record<string, boolean> }) => [p.id, p.notification_prefs?.push !== false]));
  const byUser = new Map<string, TokenRow[]>();
  for (const t of (tokens ?? []) as TokenRow[]) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), t]);

  const messages: { to: string; title: string; body: string; data: Record<string, unknown>; sound: 'default'; channelId: 'default'; _nid: string; _tid: string }[] = [];
  for (const n of pending as NotificationRow[]) {
    if (!pushAllowed.get(n.user_id)) continue;
    for (const t of byUser.get(n.user_id) ?? []) {
      messages.push({ to: t.token, title: n.title, body: n.body ?? '', data: { ...n.data, notification_id: n.id, type: n.type }, sound: 'default', channelId: 'default', _nid: n.id, _tid: t.id });
    }
  }

  let sent = 0;
  const invalidTokenIds: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(Deno.env.get('EXPO_ACCESS_TOKEN') ? { authorization: `Bearer ${Deno.env.get('EXPO_ACCESS_TOKEN')}` } : {}) },
      body: JSON.stringify(chunk.map(({ _nid: _n, _tid: _t, ...m }) => m)),
    });
    if (!res.ok) {
      console.error('expo push failed', res.status, await res.text());
      continue;
    }
    const { data: tickets } = (await res.json()) as { data: ExpoTicket[] };
    tickets.forEach((t, idx) => {
      if (t.status === 'ok') sent++;
      else if (t.details?.error === 'DeviceNotRegistered' || t.details?.error === 'InvalidCredentials') invalidTokenIds.push(chunk[idx]._tid);
      else console.warn('push ticket error', t.message, t.details);
    });
  }

  if (invalidTokenIds.length) {
    await sb.from('push_tokens').update({ is_valid: false, invalid_reason: 'DeviceNotRegistered' }).in('id', invalidTokenIds);
  }
  // Mark all drained notifications as pushed (even those with no device: in-app inbox still shows them).
  await sb.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', (pending as NotificationRow[]).map((n) => n.id));

  return Response.json({ drained: pending.length, sent, invalidated: invalidTokenIds.length });
});
