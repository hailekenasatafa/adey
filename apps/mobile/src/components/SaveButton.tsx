import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import type { Enums } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { track } from '@/lib/analytics';

export function useSaved() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['saved', user?.id], queryFn: () => api.saved.list(), enabled: !!user, staleTime: 60_000 });
}

export function SaveButton({ targetType, targetId, size = 20, businessId }: { targetType: Enums<'saved_target'>; targetId: string; size?: number; businessId?: string | null }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const qc = useQueryClient();
  const saved = useSaved();
  const isSaved = !!saved.data?.some((s) => s.target_type === targetType && s.target_id === targetId);
  const toggle = useMutation({
    mutationFn: () => api.saved.toggle(targetType, targetId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['saved', user?.id] });
      const prev = saved.data ?? [];
      qc.setQueryData(['saved', user?.id], isSaved ? prev.filter((s) => !(s.target_type === targetType && s.target_id === targetId)) : [{ user_id: user!.id, target_type: targetType, target_id: targetId, created_at: new Date().toISOString() }, ...prev]);
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(['saved', user?.id], ctx.prev),
    onSuccess: (nowSaved) => {
      if (nowSaved) track('save', { businessId, targetType, targetId });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['saved', user?.id] }),
  });
  return (
    <Pressable
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Remove from saved' : 'Save'}
      onPress={() => {
        if (!user) return router.push('/(auth)/sign-in');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle.mutate();
      }}
      style={[styles.btn, { backgroundColor: colors.surface + 'E6' }]}
    >
      <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={size} color={isSaved ? colors.danger : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' } });
