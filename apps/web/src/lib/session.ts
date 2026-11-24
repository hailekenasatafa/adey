'use client';
/**
 * A random, anonymous id for this browser, used only to count distinct visitors in analytics
 * (for example the "Trending" badge). It is not linked to a person and holds no personal data.
 */
const KEY = 'adey.sid';
export function anonymousSessionId(): string | undefined {
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) { id = crypto.randomUUID(); window.localStorage.setItem(KEY, id); }
    return id;
  } catch {
    return undefined;
  }
}
