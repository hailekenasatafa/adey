import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

/** Handles email confirmation / magic links / password-reset codes from Supabase Auth. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  const type = url.searchParams.get('type');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(type === 'recovery' ? '/auth/reset' : next, url.origin));
  }
  return NextResponse.redirect(new URL('/auth/sign-in?error=link', url.origin));
}
