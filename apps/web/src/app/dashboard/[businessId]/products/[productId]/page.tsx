'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, certificationLabels, certificationRequestSchema, formatMoney, friendlyError, variantSchema, type ProductVariant } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { Badge } from '@/components/ui';
import { CertificationBadge, CountrySelect } from '@/components/commerce';
import { fmtDate } from '@/lib/media';
import { centsToDollars, dollarsToCents, uploadFile } from '@/lib/upload';
import { ErrorNote, Field, ListSkeleton, NoAccess, errMsg, toInt, usePerms } from '@/components/seller/common';

const REASONS = [['restock', 'Restock (new stock arrived)'], ['adjustment', 'Adjustment'], ['correction', 'Correction (count was wrong)'], ['damage', 'Damaged or lost'], ['return', 'Return']] as const;
const STATUS_TONE = { approved: 'success', rejected: 'danger', needs_info: 'warning', withdrawn: 'neutral', submitted: 'info', in_review: 'info' } as const;
const OPEN = ['submitted', 'in_review', 'needs_info'];

export default function ProductPage() {
  const { businessId, productId } = useParams<{ businessId: string; productId: string }>();
  const { can, loading } = usePerms(businessId);
  const p = useQuery({ queryKey: ['product', productId], queryFn: () => api.market.product(productId) });
  if (p.isLoading || loading) return <ListSkeleton />;
  const prod = p.data;
  if (p.error || !prod || prod.business_id !== businessId) return <div><Link href={`/dashboard/${businessId}/products`} className="text-sm font-semibold text-forest">← Products</Link><p role="alert" className="mt-4 text-sm text-danger">{p.error ? friendlyError(p.error) : 'Product not found.'}</p></div>;
  return (
    <div className="space-y-4">
      <Link href={`/dashboard/${businessId}/products`} className="text-sm font-semibold text-forest">← Products</Link>
      <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{prod.name}</h1>{prod.is_authentic && <CertificationBadge />}</div>
      {(can('inventory.manage') || can('catalog.manage')) ? <><Stock businessId={businessId} productId={productId} product={prod} /><Variants businessId={businessId} productId={productId} /></> : <NoAccess what="Stock and options" />}
      {can('catalog.manage') ? <Authenticity businessId={businessId} productId={productId} isAuthentic={prod.is_authentic} product={prod} /> : null}
    </div>
  );
}

function Stock({ businessId, productId, product }: { businessId: string; productId: string; product: { track_inventory: boolean; stock_quantity: number; low_stock_threshold: number } }) {
  const qc = useQueryClient();
  const variants = useQuery({ queryKey: ['variants', productId], queryFn: () => api.seller.variants(productId) });
  const moves = useQuery({ queryKey: ['movements', productId], queryFn: () => api.seller.inventoryMovements(productId) });
  const [f, setF] = useState({ variant: '', delta: '', reason: 'restock', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasVariants = !!variants.data?.length;
  const adjust = async () => {
    setErr(null); const delta = toInt(f.delta);
    if (delta == null || Number.isNaN(delta) || delta === 0) return setErr('Enter how many to add (or a negative number to remove).');
    if (hasVariants && !f.variant) return setErr('Choose which option.');
    setBusy(true);
    try { await api.seller.adjustInventory(productId, delta, f.reason as 'restock', f.note.trim() || undefined, f.variant || undefined); setF({ ...f, delta: '', note: '' }); for (const k of [['product', productId], ['variants', productId], ['movements', productId], ['products', businessId], ['seller-overview', businessId]]) qc.invalidateQueries({ queryKey: k }); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const name = (id: string | null) => (id ? variants.data?.find((v) => v.id === id)?.title ?? 'Option' : null);
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Stock</h2>
      {!product.track_inventory && !hasVariants ? <p className="text-sm text-text-muted">Stock tracking is off for this product. Turn on "Track stock" when editing it to count stock and stop overselling.</p> : (
        <>
          {!hasVariants && <p className="text-sm"><b>{product.stock_quantity}</b> in stock{product.stock_quantity <= product.low_stock_threshold && <span className="ml-2 text-warning">— running low</span>}</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            {hasVariants && <Field label="Option"><select value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })} className="input"><option value="">Choose…</option>{variants.data!.map((v) => <option key={v.id} value={v.id}>{v.title} ({v.stock_quantity})</option>)}</select></Field>}
            <Field label="Change (+ add / − remove)"><input type="number" value={f.delta} onChange={(e) => setF({ ...f, delta: e.target.value })} className="input" /></Field>
            <Field label="Reason"><select value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className="input">{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Note (optional)"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className="input" /></Field>
          </div>
          <ErrorNote error={err} /><button onClick={adjust} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Update stock'}</button>
        </>
      )}
      <h3 className="pt-2 text-sm font-semibold">History</h3>
      {moves.isLoading ? <div className="skeleton h-12" /> : moves.error ? <ErrorNote error={moves.error} /> : !moves.data?.length ? <p className="text-sm text-text-muted">No stock changes yet.</p> : (
        <ul className="divide-y divide-border text-sm">{moves.data.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span><b className={m.delta < 0 ? 'text-danger' : 'text-success'}>{m.delta > 0 ? '+' : ''}{m.delta}</b> <span className="capitalize">{m.reason.replace(/_/g, ' ')}</span>{name(m.variant_id) ? ` · ${name(m.variant_id)}` : ''}{m.note ? ` — ${m.note}` : ''}</span><span className="text-text-muted">now {m.balance_after} · {fmtDate(m.created_at)}</span></li>)}</ul>
      )}
    </div>
  );
}

type VForm = { id?: string; title: string; sku: string; price: string; alt_price: string; stock: string; weight: string; is_active: boolean };
function Variants({ businessId, productId }: { businessId: string; productId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['variants', productId], queryFn: () => api.seller.variants(productId) });
  const [edit, setEdit] = useState<VForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = () => { for (const k of ['variants', 'movements']) qc.invalidateQueries({ queryKey: [k, productId] }); qc.invalidateQueries({ queryKey: ['products', businessId] }); };
  const open = (v?: ProductVariant) => { setErr(null); setEdit(v ? { id: v.id, title: v.title, sku: v.sku ?? '', price: centsToDollars(v.price_cents), alt_price: centsToDollars(v.alt_price_cents), stock: String(v.stock_quantity), weight: v.weight_grams?.toString() ?? '', is_active: v.is_active } : { title: '', sku: '', price: '', alt_price: '', stock: '0', weight: '', is_active: true }); };
  const save = async () => {
    if (!edit) return; setBusy(true); setErr(null);
    try {
      const w = toInt(edit.weight);
      const p = variantSchema.parse({ title: edit.title, sku: edit.sku, price_cents: dollarsToCents(edit.price), alt_price_cents: dollarsToCents(edit.alt_price), stock_quantity: Number(edit.stock || 0), weight_grams: w != null && !Number.isNaN(w) ? w : null, is_active: edit.is_active });
      await api.seller.saveVariant({ ...(edit.id ? { id: edit.id } : {}), ...(blankToNull(p) as typeof p), sku: p.sku || null, business_id: businessId, product_id: productId });
      setEdit(null); inv();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = async (v: ProductVariant) => { if (!confirm(`Delete "${v.title}"?`)) return; try { await api.seller.deleteVariant(v.id); inv(); } catch (e) { setErr(errMsg(e)); } };
  return (
    <div className="card space-y-3 p-5">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Options (size, colour…)</h2><button onClick={() => open()} className="btn btn-secondary btn-sm">+ Add option</button></div>
      <p className="text-xs text-text-muted">With options, buyers must pick one and stock is kept per option. An option without its own price uses the product price.</p>
      {edit && (
        <div className="space-y-3 rounded-[12px] bg-surface-muted p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Option name"><input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="input" placeholder="Medium" /></Field>
            <Field label="SKU (optional)"><input value={edit.sku} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} className="input" /></Field>
            <Field label="Weight (grams)"><input type="number" min={1} value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} className="input" /></Field>
            <Field label="Price (optional)"><input value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} className="input" inputMode="decimal" /></Field>
            <Field label="Second-currency price (optional)"><input value={edit.alt_price} onChange={(e) => setEdit({ ...edit, alt_price: e.target.value })} className="input" inputMode="decimal" /></Field>
            {edit.id ? <div className="text-sm"><span className="label">Stock</span><p>{edit.stock} — change it with "Update stock" above.</p></div> : <Field label="Starting stock"><input type="number" min={0} value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} className="input" /></Field>}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--forest)]" />Available to buyers</label>
          <div className="flex gap-2"><button onClick={() => setEdit(null)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save option'}</button></div>
        </div>
      )}
      <ErrorNote error={err} />
      {q.isLoading ? <div className="skeleton h-12" /> : q.error ? <ErrorNote error={q.error} /> : !q.data?.length ? <p className="text-sm text-text-muted">No options. The product is sold as a single item.</p> : (
        <ul className="divide-y divide-border text-sm">{q.data.map((v) => <li key={v.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1"><b>{v.title}</b>{v.sku ? ` · ${v.sku}` : ''}<span className="block text-xs text-text-muted">{v.price_cents != null ? formatMoney(v.price_cents) : 'Product price'} · {v.stock_quantity} in stock</span></span>{!v.is_active && <Badge tone="neutral">Hidden</Badge>}<button onClick={() => open(v)} className="btn btn-ghost btn-sm">Edit</button><button onClick={() => remove(v)} className="btn btn-ghost btn-sm text-danger">Delete</button></li>)}</ul>
      )}
    </div>
  );
}

type PInfo = { origin_country: string | null; origin_region: string | null; materials: string | null };
function Authenticity({ businessId, productId, isAuthentic, product }: { businessId: string; productId: string; isAuthentic: boolean; product: PInfo }) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['certs', businessId], queryFn: () => api.seller.certificationRequests(businessId) });
  const mine = (q.data ?? []).filter((r) => r.product_id === productId);
  const open = mine.find((r) => OPEN.includes(r.status));
  const approved = mine.find((r) => r.status === 'approved');
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ type: 'authentic_habesha', statement: '', maker_name: '', origin_country: product.origin_country ?? '', origin_region: product.origin_region ?? '', materials: product.materials ?? '', technique: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = () => { qc.invalidateQueries({ queryKey: ['certs', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const submit = async () => {
    if (!session) return; setBusy(true); setErr(null);
    try {
      const p = certificationRequestSchema.parse({ ...f, origin_country: f.origin_country || null });
      const evidence: string[] = []; for (const file of files) evidence.push(await uploadFile('verification-docs', `${businessId}/cert`, file, 'document'));
      const c = blankToNull(p) as typeof p;
      await api.seller.requestCertification({ product_id: productId, business_id: businessId, type: p.type, statement: p.statement, maker_name: c.maker_name || null, origin_country: p.origin_country ?? null, origin_region: p.origin_region || null, materials: p.materials || null, technique: p.technique || null, evidence_paths: evidence, submitted_by: session.user.id });
      setShow(false); setFiles([]); inv();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const act = async (fn: () => PromiseLike<unknown>) => { setErr(null); try { await fn(); inv(); } catch (e) { setErr(errMsg(e)); } };
  const paused = !!approved && !isAuthentic;
  return (
    <div className="card space-y-3 p-5">
      <h2 className="font-semibold">Authenticity badge</h2>
      <p className="text-xs text-text-muted">Adey checks your statement and evidence before a badge appears on the listing. Evidence is kept private.</p>
      {isAuthentic && <p className="text-sm"><CertificationBadge /> <span className="ml-1">is showing on this listing.</span></p>}
      {paused && <div className="rounded-[10px] bg-warning/10 p-3 text-sm"><b>The badge is paused.</b> It pauses when the name, description, photos, materials or origin change after approval. Ask for a re-check to bring it back.<div className="mt-2"><button onClick={() => { setF((x) => ({ ...x, type: approved!.type, statement: approved!.statement, maker_name: approved!.maker_name ?? '', technique: approved!.technique ?? '' })); setShow(true); }} className="btn btn-primary btn-sm">Request a re-check</button></div></div>}
      {q.isLoading ? <div className="skeleton h-12" /> : q.error ? <ErrorNote error={q.error} /> : mine.map((r) => (
        <div key={r.id} className="rounded-[10px] border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><b>{certificationLabels[r.type]}</b><Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? 'neutral'}>{r.status.replace(/_/g, ' ')}</Badge><span className="text-xs text-text-muted">{fmtDate(r.created_at)}</span></div>
          {r.admin_notes && (r.status === 'needs_info' || r.status === 'rejected') && <p className="mt-1"><b>Reviewer:</b> {r.admin_notes}</p>}
          <div className="mt-2 flex gap-2">
            {r.status === 'needs_info' && <button onClick={() => act(() => api.sb.from('product_certification_requests').update({ status: 'submitted' }).eq('id', r.id).then((x) => { if (x.error) throw x.error; }))} className="btn btn-primary btn-sm">Resubmit</button>}
            {OPEN.includes(r.status) && <button onClick={() => confirm('Withdraw this request?') && act(() => api.seller.withdrawCertification(r.id))} className="btn btn-ghost btn-sm">Withdraw</button>}
          </div>
        </div>))}
      {!mine.length && !q.isLoading && <p className="text-sm text-text-muted">No requests yet.</p>}
      {!open && !show && !paused && <button onClick={() => setShow(true)} className="btn btn-secondary btn-sm">Request a badge</button>}
      {show && (
        <div className="space-y-3 rounded-[12px] bg-surface-muted p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Badge"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className="input">{Object.entries(certificationLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <Field label="Maker (person or workshop)"><input value={f.maker_name} onChange={(e) => setF({ ...f, maker_name: e.target.value })} className="input" /></Field>
            <Field label="Made in"><CountrySelect allowEmpty value={f.origin_country} onChange={(v) => setF({ ...f, origin_country: v })} /></Field>
            <Field label="Region"><input value={f.origin_region} onChange={(e) => setF({ ...f, origin_region: e.target.value })} className="input" /></Field>
            <Field label="Materials"><input value={f.materials} onChange={(e) => setF({ ...f, materials: e.target.value })} className="input" /></Field>
            <Field label="Technique"><input value={f.technique} onChange={(e) => setF({ ...f, technique: e.target.value })} className="input" /></Field>
            <Field label="What makes it authentic?" className="sm:col-span-2"><textarea value={f.statement} onChange={(e) => setF({ ...f, statement: e.target.value })} className="input min-h-24" /></Field>
          </div>
          <div><label className="btn btn-secondary btn-sm cursor-pointer">+ Add evidence (photos, receipts, certificates)<input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { setFiles((x) => [...x, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} /></label>
            <ul className="mt-1 text-sm">{files.map((x, i) => <li key={i}>📎 {x.name} <button aria-label={`Remove ${x.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="text-text-muted">✕</button></li>)}</ul></div>
          <div className="flex gap-2"><button onClick={() => setShow(false)} className="btn btn-ghost btn-sm">Cancel</button><button onClick={submit} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Sending…' : 'Send for review'}</button></div>
        </div>
      )}
      <ErrorNote error={err} />
    </div>
  );
}
