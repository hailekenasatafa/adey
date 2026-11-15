// ADEY — expires stale campaign requests (response window elapsed).
// Schedule hourly. Uses the SECURITY DEFINER function so audit rows + notifications fire.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { isAuthorizedWorker, unauthorized } from '../_shared/worker-auth.ts';

Deno.serve(async (req) => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (!(await isAuthorizedWorker(req, sb))) return unauthorized();
  const { data, error } = await sb.rpc('expire_stale_requests');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return Response.json({ expired: data });
});
