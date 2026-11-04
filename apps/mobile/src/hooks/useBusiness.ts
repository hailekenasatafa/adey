import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';

/** Loads a business the current user manages (owner/manager/staff) and its membership role. */
export function useManagedBusiness(businessId: string | undefined) {
  const { businesses } = useAuth();
  const membership = businesses.find((b) => b.id === businessId);
  const business = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId!), enabled: !!businessId });
  const canManage = !!membership && (membership.role === 'owner' || membership.role === 'manager');
  return { membership, business, canManage, isOwner: membership?.role === 'owner' };
}
