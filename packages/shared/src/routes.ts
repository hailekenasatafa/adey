/**
 * Where a notification should take the member.
 *
 * The database stores an in-app path in `notification.data.route`. Most paths are the same on the
 * website and in the app. A few older notification types (inquiries, verification requests, AdConnect
 * requests and bookings, AdConnect disputes) use paths that need the business id or differ between the
 * two, so they are translated here. Returns null when there is nowhere sensible to go.
 */
export function notificationRoute(data: unknown, platform: 'web' | 'app'): string | null {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  // an absolute in-app path only: never a protocol-relative or external URL
  const route = typeof d.route === 'string' && /^\/(?!\/)/.test(d.route) ? d.route : null;
  if (!route) return null;
  const business = typeof d.business_id === 'string' && /^[0-9a-f-]{36}$/i.test(d.business_id) ? d.business_id : null;

  if (/^\/dashboard\/inquiries\/[^/]+$/.test(route)) return business ? `/dashboard/${business}/inquiries` : null;
  const verification = route.match(/^\/dashboard\/verification\/([^/]+)$/);
  if (verification) {
    if (!business) return null;
    return platform === 'app' ? `/dashboard/${business}/verification/${verification[1]}` : `/dashboard/${business}/verification`;
  }
  if (platform === 'web') {
    const request = route.match(/^\/adconnect\/requests\/([^/]+)$/);
    if (request) return `/requests/${request[1]}`;
    const booking = route.match(/^\/adconnect\/bookings\/([^/]+)$/);
    if (booking) return `/bookings/${booking[1]}`;
    if (/^\/admin\/disputes\/[^/]+$/.test(route)) return '/admin/disputes';
  }
  return route;
}
