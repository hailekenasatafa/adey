import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { blankToNull, certificationLabels, certificationRequestSchema, formatMoney, parseMoneyToCents, variantSchema, type CertificationType, type ProductVariant } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { pickDocument, pickImages, uploadFile, type PickedFile } from '@/lib/upload';
import { Badge, Button, Card, Input, Skeleton, Text } from '@/components/ui';
import { CertificationBadge } from '@/components/commerce';
import { ChipRow, CountryField, ErrorNote, SwitchRow, centsToText, errMsg, fmtDate, toInt } from './common';

const REASONS = [['restock', 'Restock'], ['adjustment', 'Adjustment'], ['correction', 'Correction'], ['damage', 'Damaged / lost'], ['return', 'Return']] as const;
const STATUS_TONE = { approved: 'success', rejected: 'danger', needs_info: 'warning', withdrawn: 'neutral', submitted: 'info', in_review: 'info' } as const;
const OPEN = ['submitted', 'in_review', 'needs_info'];

export function Stock({ businessId, productId, product }: { businessId: string; productId: string; product: { track_inventory: boolean; stock_quantity: number; low_stock_threshold: number } }) {
  const qc = useQueryClient();
  const variants = useQuery({ queryKey: ['variants', productId], queryFn: () => api.seller.variants(productId) });
  const moves = useQuery({ queryKey: ['movements', productId], queryFn: () => api.seller.inventoryMovements(productId) });
  const [f, setF] = useState({ variant: '', delta: '', reason: 'restock', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasVariants = !!variants.data?.length;
  const adjust = async () => {
    setErr(null);
    const delta = toInt(f.delta);
    if (delta == null || Number.isNaN(delta) || delta === 0) return setErr('Enter how many to add (or a negative number to remove).');
    if (hasVariants && !f.variant) return setErr('Choose which option.');
    setBusy(true);
    try {
      await api.seller.adjustInventory(productId, delta, f.reason as 'restock', f.note.trim() || undefined, f.variant || undefined);
      setF({ ...f, delta: '', note: '' });
      for (const k of [['product', productId], ['variants', productId], ['movements', productId], ['products', businessId], ['seller-overview', businessId]]) qc.invalidateQueries({ queryKey: k });
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const name = (id: string | null) => (id ? variants.data?.find((v) => v.id === id)?.title ?? 'Option' : null);
  return (
    <Card>
      <Text variant="subheading">Stock</Text>
      {!product.track_inventory && !hasVariants ? <Text variant="caption" color="muted" style={{ marginTop: 6 }}>Stock tracking is off for this product. Turn on "Track stock" in the details above to count stock and stop overselling.</Text> : (
        <View style={{ marginTop: 8 }}>
          {!hasVariants && <Text style={{ marginBottom: 8 }}><Text variant="bodyStrong">{product.stock_quantity}</Text> in stock{product.stock_quantity <= product.low_stock_threshold ? <Text color="warning"> · running low</Text> : null}</Text>}
          {hasVariants && <ChipRow label="Option" value={f.variant} onChange={(variant) => setF((x) => ({ ...x, variant }))} options={variants.data!.map((v) => ({ value: v.id, label: `${v.title} (${v.stock_quantity})` }))} />}
          <Input label="Change (+ add, - remove)" value={f.delta} onChangeText={(delta) => setF((x) => ({ ...x, delta }))} keyboardType="numbers-and-punctuation" />
          <ChipRow label="Reason" value={f.reason} onChange={(reason) => setF((x) => ({ ...x, reason }))} options={REASONS.map(([value, label]) => ({ value, label }))} />
          <Input label="Note (optional)" value={f.note} onChangeText={(note) => setF((x) => ({ ...x, note }))} />
          <ErrorNote error={err} />
          <Button title="Update stock" loading={busy} onPress={adjust} />
        </View>
      )}
      <Text variant="label" style={{ marginTop: 16, marginBottom: 6 }}>History</Text>
      {moves.isLoading ? <Skeleton height={40} /> : moves.error ? <ErrorNote error={moves.error} /> : !moves.data?.length ? <Text variant="caption" color="muted">No stock changes yet.</Text> : moves.data.map((m) => (
        <View key={m.id} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
          <Text variant="caption"><Text variant="label" color={m.delta < 0 ? 'danger' : 'success'}>{m.delta > 0 ? '+' : ''}{m.delta}</Text> <Text variant="caption" style={{ textTransform: 'capitalize' }}>{m.reason.replace(/_/g, ' ')}</Text>{name(m.variant_id) ? ` · ${name(m.variant_id)}` : ''}{m.note ? `: ${m.note}` : ''}</Text>
          <Text variant="caption" color="muted">now {m.balance_after} · {fmtDate(m.created_at)}</Text>
        </View>
      ))}
    </Card>
  );
}

type VForm = { id?: string; title: string; sku: string; price: string; alt_price: string; stock: string; weight: string; is_active: boolean };
export function Variants({ businessId, productId }: { businessId: string; productId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['variants', productId], queryFn: () => api.seller.variants(productId) });
  const [edit, setEdit] = useState<VForm | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = () => { for (const k of ['variants', 'movements']) qc.invalidateQueries({ queryKey: [k, productId] }); qc.invalidateQueries({ queryKey: ['products', businessId] }); };
  const open = (v?: ProductVariant) => { setErr(null); setEdit(v ? { id: v.id, title: v.title, sku: v.sku ?? '', price: centsToText(v.price_cents), alt_price: centsToText(v.alt_price_cents), stock: String(v.stock_quantity), weight: v.weight_grams?.toString() ?? '', is_active: v.is_active } : { title: '', sku: '', price: '', alt_price: '', stock: '0', weight: '', is_active: true }); };
  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr(null);
    try {
      const w = toInt(edit.weight);
      const p = variantSchema.parse({ title: edit.title, sku: edit.sku, price_cents: parseMoneyToCents(edit.price), alt_price_cents: parseMoneyToCents(edit.alt_price), stock_quantity: Number(edit.stock || 0), weight_grams: w != null && !Number.isNaN(w) ? w : null, is_active: edit.is_active });
      await api.seller.saveVariant({ ...(edit.id ? { id: edit.id } : {}), ...(blankToNull(p) as typeof p), sku: p.sku || null, business_id: businessId, product_id: productId });
      setEdit(null); inv();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const remove = (v: ProductVariant) => Alert.alert(`Delete "${v.title}"?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.seller.deleteVariant(v.id); inv(); } catch (e) { setErr(errMsg(e)); } } }]);
  const s = (patch: Partial<VForm>) => setEdit((x) => (x ? { ...x, ...patch } : x));
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="subheading">Options (size, colour…)</Text>
        <Button title="Add" size="sm" icon="add" variant="secondary" onPress={() => open()} />
      </View>
      <Text variant="caption" color="muted" style={{ marginVertical: 8 }}>With options, buyers must pick one and stock is kept per option. An option without its own price uses the product price.</Text>
      {edit && (
        <View style={{ marginBottom: 10 }}>
          <Input label="Option name" value={edit.title} onChangeText={(title) => s({ title })} placeholder="Medium" />
          <Input label="SKU (optional)" value={edit.sku} onChangeText={(sku) => s({ sku })} autoCapitalize="characters" />
          <Input label="Weight (grams)" value={edit.weight} onChangeText={(weight) => s({ weight })} keyboardType="number-pad" />
          <Input label="Price (optional)" value={edit.price} onChangeText={(price) => s({ price })} keyboardType="decimal-pad" />
          <Input label="Second-currency price (optional)" value={edit.alt_price} onChangeText={(alt_price) => s({ alt_price })} keyboardType="decimal-pad" />
          {edit.id ? <Text variant="caption" color="muted" style={{ marginBottom: 12 }}>Stock: {edit.stock}. Change it with "Update stock" above.</Text> : <Input label="Starting stock" value={edit.stock} onChangeText={(stock) => s({ stock })} keyboardType="number-pad" />}
          <SwitchRow label="Available to buyers" value={edit.is_active} onChange={(is_active) => s({ is_active })} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setEdit(null)} />
            <Button title="Save option" style={{ flex: 1 }} loading={busy} onPress={save} />
          </View>
        </View>
      )}
      <ErrorNote error={err} />
      {q.isLoading ? <Skeleton height={40} /> : q.error ? <ErrorNote error={q.error} /> : !q.data?.length ? <Text variant="caption" color="muted">No options. The product is sold as a single item.</Text> : q.data.map((v) => (
        <View key={v.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.2)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text variant="bodyStrong">{v.title}</Text>{!v.is_active && <Badge label="Hidden" />}</View>
          <Text variant="caption" color="muted">{v.sku ? `${v.sku} · ` : ''}{v.price_cents != null ? formatMoney(v.price_cents) : 'Product price'} · {v.stock_quantity} in stock</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button title="Edit" size="sm" variant="outline" onPress={() => open(v)} />
            <Button title="Delete" size="sm" variant="ghost" onPress={() => remove(v)} />
          </View>
        </View>
      ))}
    </Card>
  );
}

type PInfo = { origin_country: string | null; origin_region: string | null; materials: string | null };
export function Authenticity({ businessId, productId, isAuthentic, product }: { businessId: string; productId: string; isAuthentic: boolean; product: PInfo }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['certs', businessId], queryFn: () => api.seller.certificationRequests(businessId) });
  const mine = (q.data ?? []).filter((r) => r.product_id === productId);
  const open = mine.find((r) => OPEN.includes(r.status));
  const approved = mine.find((r) => r.status === 'approved');
  const [show, setShow] = useState(false);
  const [f, setF] = useState({ type: 'authentic_habesha' as CertificationType, statement: '', maker_name: '', origin_country: product.origin_country ?? '', origin_region: product.origin_region ?? '', materials: product.materials ?? '', technique: '' });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inv = () => { qc.invalidateQueries({ queryKey: ['certs', businessId] }); qc.invalidateQueries({ queryKey: ['seller-overview', businessId] }); };
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const addFile = async (photo: boolean) => { try { const x = photo ? (await pickImages())[0] : await pickDocument(); if (x) setFiles((l) => [...l, x]); } catch (e) { setErr(errMsg(e)); } };
  const submit = async () => {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const p = certificationRequestSchema.parse({ ...f, origin_country: f.origin_country || null });
      const evidence: string[] = [];
      for (const file of files) evidence.push(await uploadFile('verification-docs', `${businessId}/cert`, file, 'document'));
      const c = blankToNull(p) as typeof p;
      await api.seller.requestCertification({ product_id: productId, business_id: businessId, type: p.type, statement: p.statement, maker_name: c.maker_name || null, origin_country: p.origin_country ?? null, origin_region: p.origin_region || null, materials: p.materials || null, technique: p.technique || null, evidence_paths: evidence, submitted_by: user.id });
      setShow(false); setFiles([]); inv();
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const act = async (fn: () => PromiseLike<unknown>) => { setErr(null); try { await fn(); inv(); } catch (e) { setErr(errMsg(e)); } };
  const paused = !!approved && !isAuthentic;
  return (
    <Card>
      <Text variant="subheading">Authenticity badge</Text>
      <Text variant="caption" color="muted" style={{ marginVertical: 6 }}>Adey checks your statement and evidence before a badge appears on the listing. Evidence is kept private.</Text>
      {isAuthentic && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}><CertificationBadge /><Text variant="caption">is showing on this listing.</Text></View>}
      {paused && (
        <View style={{ backgroundColor: colors.warning + '1A', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <Text variant="caption"><Text variant="label">The badge is paused. </Text>It pauses when the name, description, photos, materials or origin change after approval. Ask for a re-check to bring it back.</Text>
          <Button title="Request a re-check" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => { set({ type: approved!.type, statement: approved!.statement, maker_name: approved!.maker_name ?? '', technique: approved!.technique ?? '' }); setShow(true); }} />
        </View>
      )}
      {q.isLoading ? <Skeleton height={40} /> : q.error ? <ErrorNote error={q.error} /> : mine.map((r) => (
        <View key={r.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong">{certificationLabels[r.type]}</Text>
            <Badge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? 'neutral'} label={r.status.replace(/_/g, ' ')} />
            <Text variant="caption" color="muted">{fmtDate(r.created_at)}</Text>
          </View>
          {r.admin_notes && (r.status === 'needs_info' || r.status === 'rejected') && <Text variant="caption" style={{ marginTop: 4 }}><Text variant="label">Reviewer: </Text>{r.admin_notes}</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {r.status === 'needs_info' && <Button title="Resubmit" size="sm" onPress={() => act(() => api.sb.from('product_certification_requests').update({ status: 'submitted' }).eq('id', r.id).then((x) => { if (x.error) throw x.error; }))} />}
            {OPEN.includes(r.status) && <Button title="Withdraw" size="sm" variant="ghost" onPress={() => Alert.alert('Withdraw this request?', undefined, [{ text: 'Keep', style: 'cancel' }, { text: 'Withdraw', style: 'destructive', onPress: () => act(() => api.seller.withdrawCertification(r.id)) }])} />}
          </View>
        </View>
      ))}
      {!mine.length && !q.isLoading && <Text variant="caption" color="muted">No requests yet.</Text>}
      {!open && !show && !paused && <Button title="Request a badge" variant="secondary" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setShow(true)} />}
      {show && (
        <View style={{ marginTop: 10 }}>
          <ChipRow label="Badge" value={f.type} onChange={(type) => set({ type })} options={(Object.keys(certificationLabels) as CertificationType[]).map((k) => ({ value: k, label: certificationLabels[k] }))} />
          <Input label="Maker (person or workshop)" value={f.maker_name} onChangeText={(maker_name) => set({ maker_name })} />
          <CountryField label="Made in" allowEmpty value={f.origin_country} onChange={(origin_country) => set({ origin_country })} />
          <Input label="Region" value={f.origin_region} onChangeText={(origin_region) => set({ origin_region })} />
          <Input label="Materials" value={f.materials} onChangeText={(materials) => set({ materials })} />
          <Input label="Technique" value={f.technique} onChangeText={(technique) => set({ technique })} />
          <Input label="What makes it authentic?" value={f.statement} onChangeText={(statement) => set({ statement })} multiline />
          <Text variant="label" style={{ marginBottom: 6 }}>Evidence (photos, receipts, certificates)</Text>
          {files.map((x, i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 }}><Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>{x.name}</Text><Button title="Remove" size="sm" variant="ghost" onPress={() => setFiles((l) => l.filter((_, j) => j !== i))} /></View>)}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Button title="Add file" size="sm" variant="secondary" icon="document-attach-outline" onPress={() => addFile(false)} />
            <Button title="Add photo" size="sm" variant="secondary" icon="camera-outline" onPress={() => addFile(true)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setShow(false)} />
            <Button title="Send for review" style={{ flex: 1 }} loading={busy} onPress={submit} />
          </View>
        </View>
      )}
      <ErrorNote error={err} />
    </Card>
  );
}
