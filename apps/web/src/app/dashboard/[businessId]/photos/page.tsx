'use client';
import { ImagePlus, Store, X } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { mediaUrlFromPath } from '@/lib/media';
import { uploadFile } from '@/lib/upload';

export default function Photos() {
  const { businessId } = useParams<{ businessId: string }>();
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId) });
  const inv = () => { qc.invalidateQueries({ queryKey: ['business', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); refresh(); };
  const setImage = async (field: 'logo_url' | 'cover_url', file: File) => { setBusy(true); setError(null); try { const path = await uploadFile('business-media', `${businessId}/${field === 'logo_url' ? 'logo' : 'cover'}`, file, 'image'); await api.owner.update(businessId, { [field]: path }); inv(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  const addGallery = async (files: FileList) => { setBusy(true); setError(null); try { const base = b.data?.photos?.length ?? 0; let i = 0; for (const f of Array.from(files)) { const path = await uploadFile('business-media', `${businessId}/gallery`, f, 'image'); await api.owner.addPhoto({ business_id: businessId, storage_path: path, sort_order: base + i++ }); } inv(); } catch (e) { setError(friendlyError(e)); } finally { setBusy(false); } };
  const remove = useMutation({ mutationFn: (id: string) => api.owner.removePhoto(id), onSuccess: inv });
  const d = b.data;
  return (
    <div>
      <h1 className="text-2xl font-bold">Logo, cover & photos</h1>
      <p className="text-text-muted text-sm">JPG, PNG or WebP up to 10 MB. Covers show as squares, so a square photo looks best.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-[160px_220px]">
        <label className="card relative grid aspect-square cursor-pointer place-items-center overflow-hidden">{d?.logo_url ? <img src={mediaUrlFromPath('business-media', d.logo_url)!} alt="" className="h-full w-full object-cover" /> : <Store aria-hidden className="h-8 w-8 text-text-muted" strokeWidth={1.5} />}<span className="absolute bottom-2 left-2 badge badge-neutral">Logo</span><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setImage('logo_url', e.target.files[0])} /></label>
        <label className="card relative grid aspect-square cursor-pointer place-items-center overflow-hidden">{d?.cover_url ? <img src={mediaUrlFromPath('business-media', d.cover_url)!} alt="" className="h-full w-full object-cover" /> : <ImagePlus aria-hidden className="h-8 w-8 text-text-muted" strokeWidth={1.5} />}<span className="absolute bottom-2 left-2 badge badge-neutral">Cover photo</span><input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && setImage('cover_url', e.target.files[0])} /></label>
      </div>
      <div className="mt-8 flex items-center justify-between"><h2 className="font-semibold">Gallery ({d?.photos?.length ?? 0})</h2><label className="btn btn-primary btn-sm cursor-pointer">{busy ? 'Uploading…' : '+ Add photos'}<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addGallery(e.target.files)} /></label></div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">{[...(d?.photos ?? [])].sort((a, c) => a.sort_order - c.sort_order).map((p) => <div key={p.id} className="relative aspect-square overflow-hidden rounded-[14px] bg-surface-muted"><img src={mediaUrlFromPath('business-media', p.storage_path)!} alt="" className="h-full w-full object-cover" /><button onClick={() => remove.mutate(p.id)} className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-surface text-danger" aria-label="Remove"><X aria-hidden className="h-4 w-4" /></button></div>)}</div>
    </div>
  );
}
