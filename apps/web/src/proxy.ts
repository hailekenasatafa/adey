import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@adey/shared';

/**
 * Refreshes the Supabase session cookie on every request and performs an
 * optimistic redirect for signed-out users hitting account areas.
 * Authorization itself is enforced by RLS — never here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder', {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const protectedPrefix = ['/dashboard', '/messages', '/admin', '/campaigns', '/requests', '/bookings', '/saved', '/account'];
  if (!user && protectedPrefix.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/sign-in';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
