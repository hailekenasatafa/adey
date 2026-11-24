'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@adey/shared';
import { createAdeyApi } from '@adey/shared';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder';

export const supabase = createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
export const api = createAdeyApi(supabase);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
