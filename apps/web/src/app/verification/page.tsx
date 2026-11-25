import { BadgeCheck, Flower2 } from 'lucide-react';
import Link from 'next/link';
import { badgeLabels, trustTierLabels } from '@adey/shared';

export const metadata = { title: 'How verification works', description: 'How Adey Connect verifies businesses and sellers, the Authentic Habesha product badge, seller trust tiers and verified-purchase reviews.' };

const levels: [keyof typeof badgeLabels, string, string][] = [
  ['identity', 'The owner is a real, identifiable person.', 'Government photo ID, reviewed by Adey Connect staff and never shown publicly.'],
  ['business', 'The business is registered.', 'Business license, registration, or tax document.'],
  ['location', 'The physical location exists as described.', 'Lease or utility bill plus a storefront photo; staff may inspect in person.'],
  ['fulfillment', 'A track record of completed bookings or orders.', 'Earned on review of booking and order history with no unresolved disputes.'],
];

export default function VerificationInfo() {
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-bold">How verification works</h1>
      <p className="mt-3 text-text-muted">Trust marks on Adey Connect are never self-declared. Each one appears only after Adey Connect checks it, and it is removed if it stops being true. Customers can filter to verified businesses and authentic products.</p>

      <h2 className="mt-10 text-xl font-bold">Sellers are verified before they sell</h2>
      <p className="mt-2 text-text-muted">A business can list products and take enquiries straight away, but it can take paid orders only after seller verification is approved. The seller gives their legal details and a government ID, and registered companies add a registration number and a licence or tax document. Adey Connect staff review the application. Payments are held by Adey Connect until the buyer confirms delivery.</p>

      <h2 className="mt-10 text-xl font-bold">Verification badges</h2>
      <div className="mt-4 space-y-3">{levels.map(([k, what, docs]) => <div key={k} className="card p-5"><p className="flex items-center gap-1.5 font-semibold text-success"><BadgeCheck aria-hidden className="h-5 w-5" />{badgeLabels[k]}</p><p className="mt-1">{what}</p><p className="text-sm text-text-muted">{docs}</p></div>)}</div>
      <p className="mt-4 text-sm text-text-muted">Documents are stored in a private bucket readable only by you and the staff reviewing your request, and are kept only as long as needed to decide and audit the request.</p>

      <h2 className="mt-10 text-xl font-bold">The Authentic Habesha badge</h2>
      <div className="card mt-4 space-y-2 p-5">
        <p className="flex items-center gap-1.5 font-semibold"><Flower2 aria-hidden className="h-5 w-5 text-gold-deep" />Authentic Habesha</p>
        <p>This badge appears on individual products that the Adey Connect team has reviewed. The seller explains where and how the item is made, who made it and what it is made of, and provides supporting evidence.</p>
        <p className="text-sm text-text-muted">The badge belongs to the listing exactly as it was reviewed. If the seller later changes the name, description, photos or origin details, the badge is paused until the listing is checked again. Buyers can also rate cultural authenticity in their reviews.</p>
      </div>

      <h2 className="mt-10 text-xl font-bold">Seller trust tiers</h2>
      <div className="card mt-4 space-y-2 p-5">
        <p>Verified sellers can earn a higher tier, shown next to their name: <b>{trustTierLabels.verified}</b>, <b>{trustTierLabels.trusted}</b> and <b>{trustTierLabels.top}</b>.</p>
        <p className="text-sm text-text-muted">Tiers are worked out automatically from completed orders, review scores and a low rate of upheld problem reports. Sellers cannot buy, request or award themselves a tier, and a tier can go down as well as up.</p>
      </div>

      <h2 className="mt-10 text-xl font-bold">Verified-purchase reviews</h2>
      <div className="card mt-4 space-y-2 p-5">
        <p>Only buyers whose order was delivered can review a product, so every product review is a verified purchase.</p>
        <p className="text-sm text-text-muted">A review has an overall score plus separate scores for cultural authenticity and for service. Sellers can reply publicly but cannot change or remove a review. Reviews that break the rules can be reported.</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2"><Link href="/dashboard" className="btn btn-primary">Verify my business</Link><Link href="/help" className="btn btn-outline">Read the help centre</Link></div>
    </div>
  );
}
