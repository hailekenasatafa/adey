// ADEY — expires stale campaign requests (response window elapsed).
// Schedule hourly. Uses the SECURITY DEFINER function so audit rows + notifications fire.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization') ?? '';
  const secret = Deno.env.get('PUSH_WORKER_SECRET');
  if (secret && auth !== `Bearer ${secret}` && auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await sb.rpc('expire_stale_requests');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ expired: data });
});
