/** Shared frame for the legal pages while they are drafts awaiting a lawyer's review. */
export function LegalDraft({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-text-muted">Last updated {updated}</p>
      <div className="mt-4 rounded-[14px] border border-warning/40 bg-warning/10 p-4 text-sm" role="note">
        <b>Draft — not yet reviewed by a lawyer.</b> This page describes how Adey works today in plain language. It will be replaced by a reviewed version before Adey’s apps launch in the app stores.
      </div>
      <div className="mt-6 space-y-5 text-text-muted [&_b]:text-text [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-text">{children}</div>
    </div>
  );
}
