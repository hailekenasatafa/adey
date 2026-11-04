import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { api } from './supabase';
import type { Enums, Json } from '@adey/shared';

const sessionId = Crypto.randomUUID();

/** Fire-and-forget analytics; never blocks UI, never throws. */
export function track(event: Enums<'analytics_event'>, opts: { businessId?: string | null; targetType?: string; targetId?: string; meta?: Record<string, unknown> } = {}) {
  api.market
    .track({
      p_event: event,
      p_business_id: opts.businessId ?? undefined,
      p_target_type: opts.targetType,
      p_target_id: opts.targetId,
      p_session_id: sessionId,
      p_platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      p_meta: (opts.meta ?? {}) as Json,
    })
    .catch(() => {});
}
