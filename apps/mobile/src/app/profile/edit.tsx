import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { friendlyError, profileSchema } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { pickImages, uploadFile } from '@/lib/upload';
import { Avatar, Button, Chip, FormInput, Header, Screen, Text } from '@/components/ui';

type Form = z.infer<typeof profileSchema>;

export default function EditProfile() {
  const { user, profile, refresh } = useAuth();
  const qc = useQueryClient();
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, watch, setValue } = useForm<Form>({ resolver: zodResolver(profileSchema), defaultValues: { display_name: profile?.display_name ?? '', phone: profile?.phone ?? '', locale: (profile?.locale as 'en' | 'am') ?? 'en' } });
  const locale = watch('locale');

  const save = useMutation({
    mutationFn: (v: Form) => api.profile.update({ display_name: v.display_name, phone: v.phone || null, locale: v.locale, avatar_url: avatar }),
    onSuccess: async () => { await refresh(); qc.invalidateQueries({ queryKey: ['profile'] }); router.back(); },
    onError: (e) => setError(friendlyError(e)),
  });

  const changeAvatar = async () => {
    try {
      const [file] = await pickImages();
      if (!file || !user) return;
      setUploading(true);
      const path = await uploadFile('avatars', user.id, file, 'image');
      setAvatar(api.storage.publicUrl('avatars', path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen header={<Header title="Edit profile" />} keyboard>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Pressable onPress={changeAvatar} accessibilityRole="button" accessibilityLabel="Change photo">
          <Avatar url={avatar} name={profile?.display_name} size={96} />
        </Pressable>
        <Button title={uploading ? 'Uploading…' : 'Change photo'} variant="ghost" size="sm" loading={uploading} onPress={changeAvatar} />
      </View>
      <FormInput control={control} name="display_name" label="Name" autoCapitalize="words" />
      <FormInput control={control} name="phone" label="Phone" keyboardType="phone-pad" hint="Shared with businesses only when you include it in a message." />
      <Text variant="label" style={{ marginBottom: 8 }}>App language</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        <Chip label="English" selected={locale === 'en'} onPress={() => setValue('locale', 'en')} />
        <Chip label="አማርኛ (Amharic)" selected={locale === 'am'} onPress={() => setValue('locale', 'am')} />
      </View>
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
      <Button title="Save changes" size="lg" fullWidth loading={save.isPending} onPress={() => handleSubmit((v) => save.mutate(v))()} />
    </Screen>
  );
}
