import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useManagedBusiness } from '@/hooks/useBusiness';
import { pickImages, uploadFile } from '@/lib/upload';
import { cover } from '@/components/cards';
import { Button, Card, Header, Loading, Screen, Text } from '@/components/ui';

export default function Photos() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { colors, radius } = useTheme();
  const qc = useQueryClient();
  const { business, canManage } = useManagedBusiness(businessId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['business', businessId] }); qc.invalidateQueries({ queryKey: ['overview', businessId] }); qc.invalidateQueries({ queryKey: ['my-businesses'] }); };

  const setImage = async (field: 'logo_url' | 'cover_url') => {
    try {
      const [file] = await pickImages();
      if (!file) return;
      setBusy(field); setError(null);
      const path = await uploadFile('business-media', `${businessId}/${field === 'logo_url' ? 'logo' : 'cover'}`, file, 'image');
      await api.owner.update(businessId!, { [field]: path });
      invalidate();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  };

  const addPhotos = async () => {
    try {
      const files = await pickImages({ multiple: true });
      if (!files.length) return;
      setBusy('gallery'); setError(null);
      const existing = business.data?.photos?.length ?? 0;
      for (const [i, f] of files.entries()) {
        const path = await uploadFile('business-media', `${businessId}/gallery`, f, 'image');
        await api.owner.addPhoto({ business_id: businessId!, storage_path: path, sort_order: existing + i });
      }
      invalidate();
    } catch (e) { setError(friendlyError(e)); } finally { setBusy(null); }
  };

  const remove = useMutation({ mutationFn: (id: string) => api.owner.removePhoto(id), onSuccess: invalidate, onError: (e) => setError(friendlyError(e)) });

  if (business.isLoading) return <Screen header={<Header title="Photos" />}><Loading /></Screen>;
  const b = business.data!;
  const photos = [...(b.photos ?? [])].sort((a, c) => a.sort_order - c.sort_order);

  return (
    <Screen header={<Header title="Logo, cover & photos" />}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={() => canManage && setImage('logo_url')} style={[styles.tile, { flex: 1, aspectRatio: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg }]} accessibilityRole="button" accessibilityLabel="Change logo">
          {b.logo_url ? <Image source={{ uri: cover('business-media', b.logo_url)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="storefront-outline" size={28} color={colors.textMuted} />}
          <Label text={busy === 'logo_url' ? 'Uploading…' : 'Logo'} />
        </Pressable>
        <Pressable onPress={() => canManage && setImage('cover_url')} style={[styles.tile, { flex: 2, aspectRatio: 2, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg }]} accessibilityRole="button" accessibilityLabel="Change cover photo">
          {b.cover_url ? <Image source={{ uri: cover('business-media', b.cover_url)! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="image-outline" size={28} color={colors.textMuted} />}
          <Label text={busy === 'cover_url' ? 'Uploading…' : 'Cover photo'} />
        </Pressable>
      </View>
      <Text variant="caption" color="muted" style={{ marginTop: 8 }}>JPG, PNG or WebP up to 10 MB. The cover appears on your card; the logo next to your name.</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
        <Text variant="subheading">Gallery ({photos.length})</Text>
        {canManage && <Button title="Add photos" size="sm" icon="add" loading={busy === 'gallery'} onPress={addPhotos} />}
      </View>
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 8 }}>{error}</Text>}
      <View style={styles.grid}>
        {photos.map((p) => (
          <View key={p.id} style={[styles.photo, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}>
            <Image source={{ uri: cover('business-media', p.storage_path)! }} style={StyleSheet.absoluteFill} contentFit="cover" />
            {canManage && (
              <Pressable onPress={() => remove.mutate(p.id)} style={[styles.del, { backgroundColor: colors.surface }]} accessibilityLabel="Remove photo"><Ionicons name="trash-outline" size={16} color={colors.danger} /></Pressable>
            )}
          </View>
        ))}
        {photos.length === 0 && <Card style={{ width: '100%' }}><Text color="muted">No gallery photos yet. Interiors, dishes, products, and your team build trust.</Text></Card>}
      </View>
    </Screen>
  );
}

function Label({ text }: { text: string }) {
  return <View style={styles.label}><Text variant="caption" style={{ color: '#fff', fontWeight: '600' }}>{text}</Text></View>;
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  label: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(32,37,34,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photo: { width: '31%', aspectRatio: 1, overflow: 'hidden' },
  del: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
