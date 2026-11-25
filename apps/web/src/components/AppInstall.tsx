'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { Download } from 'lucide-react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
declare global { interface Window { __adeyInstall?: InstallPrompt | null } }

/** Phones get the store apps instead, so installing the website is offered on computers only. */
const isPhoneOrTablet = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const CHANGED = 'adey-install-change';

/** The browser's install offer, kept on window by the inline script in layout.tsx so an early offer isn't lost. */
function subscribe(onChange: () => void) {
  if (isPhoneOrTablet()) return () => undefined;
  const onPrompt = (e: Event) => { e.preventDefault(); window.__adeyInstall = e as InstallPrompt; onChange(); };
  const onInstalled = () => { window.__adeyInstall = null; onChange(); };
  window.addEventListener('beforeinstallprompt', onPrompt);
  window.addEventListener('appinstalled', onInstalled);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
    window.removeEventListener(CHANGED, onChange);
  };
}
const getSnapshot = () => (isPhoneOrTablet() ? null : window.__adeyInstall ?? null);
const getServerSnapshot = () => null;

/** Registers the service worker, which only serves an offline page when there is no connection. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}

/**
 * "Install on this computer": shown only when the browser can install the site as an app
 * (Chrome and Edge on Windows, Mac and Linux). Safari users can use File, Add to Dock.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const prompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!prompt) return null;
  const install = async () => {
    await prompt.prompt();
    await prompt.userChoice.catch(() => null);
    window.__adeyInstall = null;
    window.dispatchEvent(new Event(CHANGED));
  };
  return (
    <button type="button" onClick={install} className={className}>
      <Download aria-hidden className="h-4 w-4" />Install on this computer
    </button>
  );
}
