// ADEY — shared HTTP helpers for edge functions called from the app and the website.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-adey-client',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

/** Error body shape the shared API client reads: { error: "message for the member" }. */
export function fail(message: string, status = 400): Response {
  return json({ error: message }, status);
}

/** Answers CORS preflight and rejects anything that is not a POST. Returns null when the request should proceed. */
export function guard(req: Request): Response | null {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed', 405);
  return null;
}

export async function readJson<T extends Record<string, unknown>>(req: Request): Promise<T> {
  try {
    const body = await req.json();
    return (body && typeof body === 'object' ? body : {}) as T;
  } catch {
    return {} as T;
  }
}

/** Constant-time comparison for secrets and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** Public website origin (payment return pages, onboarding return links). */
export function siteUrl(): string {
  return (Deno.env.get('SITE_URL') ?? 'https://adeyconnect.com').replace(/\/$/, '');
}
