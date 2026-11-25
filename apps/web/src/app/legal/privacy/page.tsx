import { notFound } from 'next/navigation';
import { LEGAL_PAGES_PUBLISHED } from '@adey/shared';
import { serverApi } from '@/lib/supabase/server';
import { LegalDraft } from '@/components/LegalDraft';

export const metadata = { title: 'Privacy Policy' };

export default async function Privacy() {
  if (!LEGAL_PAGES_PUBLISHED) notFound(); // offline until a lawyer has reviewed it
  const api = await serverApi();
  const app = await api.settings.get<{ support_email?: string }>('app').catch(() => undefined);
  const email = app?.support_email ?? 'support@adeyconnect.com';
  return (
    <LegalDraft title="Privacy Policy" updated="November 24, 2026">
      <h2>What we collect</h2>
      <p>Account details (name, email, and optional phone and photo); business listings you create; messages you send; reviews; saved businesses; deals you claim, when you claimed them and whether they were used; events you post or plan to attend; reports you send; notification preferences and device push tokens; and usage events such as page views and contact clicks, tied to your account or, if you are signed out, to a random id stored in your browser.</p>
      <h2>How we use it</h2>
      <p>To run Adey Connect: show listings, deliver messages and notifications, keep deal codes working, moderate reports and keep members safe. Businesses see totals about their own page (views, contact clicks, deals claimed). Badges such as “Trending” are worked out from how many different visitors viewed a page, never from who they are.</p>
      <h2>What businesses and other members see</h2>
      <p>Reviews you post are public with your display name. A business sees the messages you send it, and your display name when you claim or use one of its deals. If you make your profile private in Settings, others see “Adey Connect member” instead of your name and photo.</p>
      <h2>Location</h2>
      <p>The mobile app uses your location only when you allow it, to sort and filter nearby results. It is not stored on our servers.</p>
      <h2>Verification documents</h2>
      <p>Stored encrypted at rest in a private bucket, readable only by you and the Adey Connect staff reviewing your request. Never shown to other members.</p>
      <h2>Where data lives</h2>
      <p>Adey Connect’s database and files are hosted by Supabase (AWS, US East). The website is hosted by Netlify. Push notifications are delivered through Expo’s push service. Adey Connect does not sell your data and does not show third-party ads.</p>
      <h2>Your choices</h2>
      <p>Edit your profile, make it private, switch off personalised recommendations (usage events are then not linked to your account), choose which notifications you get, download a copy of your data, and delete your account from Settings in the app or on the website. Deletion requests are completed within 30 days, except for records we must keep by law.</p>
      <h2>Contact</h2>
      <p><a className="font-semibold text-forest" href={`mailto:${email}`}>{email}</a></p>
    </LegalDraft>
  );
}
