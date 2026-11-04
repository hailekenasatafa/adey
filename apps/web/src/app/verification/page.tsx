import Link from 'next/link';
import { badgeLabels } from '@adey/shared';

export const metadata = { title: 'How verification works' };

export default function VerificationInfo() {
  const rows: [keyof typeof badgeLabels, string, string][] = [
    ['identity', 'The owner is a real, identifiable person.', 'Government photo ID, reviewed by Adey staff and never shown publicly.'],
    ['business', 'The business is registered.', 'Business license, registration, or tax document.'],
    ['location', 'The physical location exists as described.', 'Lease or utility bill plus a storefront photo; staff may inspect in person.'],
    ['fulfillment', 'A track record of completed bookings or orders.', 'Earned automatically on review of booking history with no unresolved disputes.'],
  ];
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-bold">How verification works</h1>
      <p className="mt-3 text-text-muted">Badges on Adey are never self-declared. A badge appears only when Adey staff approve a verification request, and it is removed if revoked. Customers and advertisers can filter to verified businesses only.</p>
      <div className="mt-8 space-y-3">{rows.map(([k, what, docs]) => <div key={k} className="card p-5"><p className="font-semibold text-success">✓ {badgeLabels[k]}</p><p className="mt-1">{what}</p><p className="text-sm text-text-muted">{docs}</p></div>)}</div>
      <p className="mt-8 text-sm text-text-muted">Documents are stored in a private bucket readable only by you and the staff reviewing your request, and are retained only as long as needed to decide and audit the request.</p>
      <Link href="/dashboard" className="btn btn-primary mt-6">Verify my business</Link>
    </div>
  );
}
