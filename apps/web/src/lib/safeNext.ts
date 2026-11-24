/**
 * Where to send someone after signing in. Only paths on this site are allowed, so a crafted link
 * (`?next=https://evil.example` or `?next=//evil.example`) can't send a member to another website.
 */
export function safeNext(next: string | null | undefined, fallback = '/') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
