// ADEY — Supabase clients for edge functions.
//   serviceClient(): our backend identity (bypasses RLS). Used only for the backend-only RPCs
//                    (checkout_mark_paid, refund_mark, shipment_record_label …) and bookkeeping.
//   userFromRequest(): the signed-in member's own identity. Everything read or done "as the member"
//                    goes through this client so row-level security decides what they may see.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const url = () => Deno.env.get('SUPABASE_URL')!;

export function serviceClient(): SupabaseClient {
  return createClient(url(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Caller = { user: { id: string; email: string | null }; userClient: SupabaseClient };

/** Validates the bearer token and returns a client that acts as that member. Null when not signed in. */
export async function userFromRequest(req: Request): Promise<Caller | null> {
  const header = req.headers.get('authorization') ?? '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!publicKey) {
    console.error('No public API key in the function environment (SUPABASE_ANON_KEY)');
    return null;
  }
  const userClient = createClient(url(), publicKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(header.slice(7).trim());
  if (error || !data.user) return null;
  return { user: { id: data.user.id, email: data.user.email ?? null }, userClient };
}

/** A platform_settings value (admin-controlled switches). */
export async function setting<T>(sb: SupabaseClient, key: string): Promise<T | null> {
  const { data } = await sb.from('platform_settings').select('value').eq('key', key).maybeSingle();
  return (data?.value as T | undefined) ?? null;
}

/** Unwraps an RPC result, throwing the database's own message (they are written for people). */
export function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}
