'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@adey/shared';
import { createAdeyApi } from '@adey/shared';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder';

export const supabase = createBrowserClient<Database>(url, key);
export const api = createAdeyApi(supabase);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
