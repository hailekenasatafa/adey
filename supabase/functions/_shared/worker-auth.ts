// ADEY — shared authorization for scheduled worker functions.
// Fails closed: a request is accepted only when its bearer token is
//   1. the optional PUSH_WORKER_SECRET function secret, or
//   2. the project's service role key, or
//   3. the Vault secret 'adey_worker_secret' (what pg_cron sends), checked via RPC.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export async function isAuthorizedWorker(req: Request, sb: SupabaseClient): Promise<boolean> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return false;
  const token = header.slice(7).trim();
  if (token.length < 32) return false;
  const envSecret = Deno.env.get('PUSH_WORKER_SECRET');
  if (envSecret && token === envSecret) return true;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return true;
  const { data, error } = await sb.rpc('verify_worker_secret', { p_secret: token });
  if (error) {
    console.error('verify_worker_secret failed', error.message);
    return false;
  }
  return data === true;
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
}
