export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-text-muted">Draft for legal review — replace before public launch.</p>
      <div className="mt-6 space-y-4 text-text-muted">
        <p><b className="text-text">What we collect.</b> Account details (name, email, optional phone and photo), business listings you create, messages and offers you send, saved items, notification preferences, device push tokens, and usage events (page views, contact clicks) tied to your account or an anonymous session.</p>
        <p><b className="text-text">Location.</b> The mobile app uses your location only when you allow it, to sort and filter nearby results. It is not stored on our servers.</p>
        <p><b className="text-text">Verification documents.</b> Stored encrypted at rest in a private bucket, accessible only to you and Adey staff reviewing your request. Never shown to other members.</p>
        <p><b className="text-text">Where data lives.</b> Supabase (AWS us-east-1). Push notifications are delivered through Expo's push service.</p>
        <p><b className="text-text">Your choices.</b> Edit your profile, control notifications, delete saved items, and request account deletion from the app or website. Deletion requests are processed within 30 days, subject to retaining records required for active bookings and financial audit.</p>
        <p><b className="text-text">Contact.</b> support@adey.app</p>
      </div>
    </div>
  );
}
