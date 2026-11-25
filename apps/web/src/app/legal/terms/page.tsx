import { serverApi } from '@/lib/supabase/server';
import { LegalDraft } from '@/components/LegalDraft';

export const metadata = { title: 'Terms of Service' };

export default async function Terms() {
  const api = await serverApi();
  const app = await api.settings.get<{ support_email?: string }>('app').catch(() => undefined);
  const email = app?.support_email ?? 'support@adeyconnect.com';
  return (
    <LegalDraft title="Terms of Service" updated="November 24, 2026">
      <h2>1. What Adey is</h2>
      <p>Adey is a directory of Habesha-owned businesses. Members can find businesses, see their photos, menus, services and prices, message them, review them, claim their deals, see community events and find advertising screens. Adey is not a party to any purchase, service, deal or advertising arrangement between members and businesses.</p>
      <h2>2. Payments and fees</h2>
      <p>Adey does not process payments today. When you buy something, book a service, use a deal or advertise on a screen, you pay the business directly, and refunds, deposits and disputes about payment are between you and the business. Adey charges businesses no fees. If Adey offers online checkout or paid features in the future, it will explain them, and any fees, before they apply to you.</p>
      <h2>3. Business listings</h2>
      <p>Only the owner of a business, or someone the owner has authorised, may list it. The business is responsible for everything on its listing — name, photos, menu, prices, hours, deals and contact details — and must keep it accurate. Listing is free. Adey may hide or remove a listing, deal or photo that is misleading, unlawful or breaks these terms.</p>
      <h2>4. Deals</h2>
      <p>Deals are offered by businesses, not by Adey. The business sets each deal’s conditions and is responsible for honouring it. Claiming a deal is free and each member can claim a deal once. A code is for your own use and has no cash value. A business can pause or end a deal at any time; an ended deal can no longer be used. If a business does not honour a valid code, tell us with Report.</p>
      <h2>5. Community events</h2>
      <p>Events are posted by members, by businesses and from public holiday calendars. The organiser is responsible for the event — its accuracy, tickets, safety, permits and any changes or cancellations. Adey reviews events submitted by members before they appear (verified businesses can publish their own), but Adey does not organise, host or endorse events. Check the details with the organiser before you go.</p>
      <h2>6. AdConnect (advertising screens)</h2>
      <p>AdConnect helps advertisers find TV screens in businesses and contact the screen owners. The advertiser and the owner agree the dates, price, content and payment between themselves; Adey is not a party to that agreement and takes no commission. Visitor numbers are the owner’s own estimates, not verified figures. Ads must be lawful and must not be misleading.</p>
      <h2>7. Reviews, messages and other content</h2>
      <p>Be honest and respectful. Each member can review a business once, and a business cannot review itself. Do not post fake reviews, spam, harassment, hate, sexual content or anything unlawful. You keep ownership of what you post, and you allow Adey to show it on Adey. Use Report on a listing, review, deal, event or message to tell us about a problem, and block anyone who harasses you.</p>
      <h2>8. Verification badges</h2>
      <p>A badge means Adey reviewed documents the business submitted for that check. It is not a guarantee of quality or of every claim the business makes, and Adey can remove it.</p>
      <h2>9. Ethiopian Market</h2>
      <p>Cross-border checkout and delivery are not available. Sellers in Ethiopia arrange orders directly with buyers and are responsible for any import or export rules.</p>
      <h2>10. Suspension and your account</h2>
      <p>Adey may suspend accounts, listings, deals or events that break these terms. You can stop using Adey at any time and delete your account from Settings.</p>
      <h2>11. Contact</h2>
      <p>Questions about these terms: <a className="font-semibold text-forest" href={`mailto:${email}`}>{email}</a>.</p>
    </LegalDraft>
  );
}
