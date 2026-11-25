import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { friendlyError } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, Chip, Input, Text } from '@/components/ui';

type Target = 'business' | 'review' | 'deal' | 'event' | 'product' | 'screen' | 'message' | 'user' | 'conversation';
const REASONS = ['Fake or misleading', 'Scam or spam', 'Offensive, hateful or harassing', 'Wrong or outdated information', 'Something else'];

/** "Report" link that opens a short form; reports go to the Adey moderation queue (App Store guideline 1.2). */
export function ReportButton({ targetType, targetId, label = 'Report' }: { targetType: Target; targetId: string; label?: string }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const send = useMutation({
    mutationFn: () => api.messaging.report({ reporter_id: user!.id, target_type: targetType, target_id: targetId, reason: details.trim() ? `${reason}: ${details.trim()}` : reason }),
  });
  return (
    <>
      <Pressable onPress={() => (user ? (send.reset(), setOpen(true)) : router.push('/(auth)/sign-in'))} accessibilityRole="button" hitSlop={8}>
        <Text variant="caption" color="muted" style={{ textDecorationLine: 'underline' }}>⚑ {label}</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20, gap: 12 }}>
          {send.isSuccess ? (
            <>
              <Text variant="heading">Thanks for telling us</Text>
              <Text color="muted">The Adey Connect team will review this. We may hide it or contact the people involved.</Text>
              <Button title="Done" onPress={() => setOpen(false)} />
            </>
          ) : (
            <>
              <Text variant="heading">What’s wrong?</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {REASONS.map((r) => <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />)}
              </View>
              <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1500} />
              {send.error && <Text color="danger" variant="caption">{friendlyError(send.error)}</Text>}
              <Button title="Send report" loading={send.isPending} onPress={() => send.mutate()} />
              <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
            </>
          )}
        </ScrollView>
      </Modal>
    </>
  );
}
