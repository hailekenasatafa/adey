import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safeNext';

/**
 * Finishes every Supabase Auth redirect: Google sign-in, email confirmation, magic links and
 * password-reset codes. `next` must be a path on this site (see safeNext).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  const type = url.searchParams.get('type');
  // Google (or the member) stopped the sign-in, e.g. they pressed Cancel on Google's screen.
  if (url.searchParams.get('error')) {
    return NextResponse.redirect(new URL(`/auth/sign-in?error=oauth&next=${encodeURIComponent(next)}`, url.origin));
  }
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/auth/reset' : next, url.origin));
  }
  return NextResponse.redirect(new URL('/auth/sign-in?error=link', url.origin));
}
