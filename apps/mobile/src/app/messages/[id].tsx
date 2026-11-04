import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type Message } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { pickImages, uploadFile } from '@/lib/upload';
import { Badge, Button, Header, IconButton, Loading, Text } from '@/components/ui';

type Attachment = { path: string; type: string; name: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, businesses } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const conv = useQuery({ queryKey: ['conversation', id], queryFn: () => api.messaging.conversation(id!), enabled: !!id });
  const msgs = useInfiniteQuery({
    queryKey: ['messages', id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.messaging.messages(id!, { limit: 50, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length === 50 ? all.length * 50 : undefined),
    enabled: !!id,
  });

  // Realtime: append new messages; mark read.
  useEffect(() => {
    if (!id) return;
    api.messaging.markRead(id).catch(() => {});
    const ch = api.messaging.subscribe(id, (m) => {
      qc.setQueryData<{ pages: Message[][]; pageParams: unknown[] }>(['messages', id], (old) => {
        if (!old) return old;
        if (old.pages.some((p) => p.some((x) => x.id === m.id))) return old;
        return { ...old, pages: [[m, ...old.pages[0]], ...old.pages.slice(1)] };
      });
      api.messaging.markRead(id).catch(() => {});
      qc.invalidateQueries({ queryKey: ['unread'] });
    });
    return () => { ch.unsubscribe(); qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['unread'] }); };
  }, [id, qc]);

  const items = useMemo(() => msgs.data?.pages.flat() ?? [], [msgs.data]);
  const myBizId = conv.data?.business_id && businesses.some((b) => b.id === conv.data!.business_id) ? conv.data.business_id : null;
  const otherUserId = conv.data?.participants.find((p) => p.user_id !== user?.id)?.user_id;

  const send = useMutation({
    mutationFn: (payload: { body?: string; attachments?: Attachment[] }) => api.messaging.send({ conversation_id: id!, sender_id: user!.id, sender_business_id: myBizId, body: payload.body ?? null, attachments: (payload.attachments ?? []) as unknown as Message['attachments'] }),
    onSuccess: (m) => {
      setText('');
      qc.setQueryData<{ pages: Message[][]; pageParams: unknown[] }>(['messages', id], (old) => (old && !old.pages[0].some((x) => x.id === m.id) ? { ...old, pages: [[m, ...old.pages[0]], ...old.pages.slice(1)] } : old));
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const attach = async () => {
    try {
      const [file] = await pickImages();
      if (!file || !user) return;
      setSending(true);
      const path = await uploadFile('message-attachments', `${id}/${user.id}`, file, 'image');
      await send.mutateAsync({ attachments: [{ path, type: file.mimeType, name: file.name }] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const title = myBizId ? conv.data?.participants.find((p) => p.user_id !== user?.id) ? 'Customer' : 'Conversation' : conv.data?.business?.name ?? 'Conversation';

  const moreActions = () => {
    Alert.alert('Conversation', undefined, [
      conv.data?.business?.slug ? { text: 'View business', onPress: () => router.push(`/business/${conv.data!.business!.slug}`) } : undefined,
      otherUserId ? { text: 'Block this user', style: 'destructive', onPress: () => api.messaging.block(otherUserId, user!.id).then(() => router.back()).catch((e) => setError(friendlyError(e))) } : undefined,
      { text: 'Report conversation', style: 'destructive', onPress: () => api.messaging.report({ reporter_id: user!.id, target_type: 'conversation', target_id: id!, reason: 'Reported from mobile chat' }).then(() => Alert.alert('Thanks', 'Our moderators will review this conversation.')).catch((e) => setError(friendlyError(e))) },
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean) as { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header title={title} subtitle={conv.data?.context_type !== 'general' ? conv.data?.context_type.replace('_', ' ') : undefined} right={<IconButton icon="ellipsis-horizontal" accessibilityLabel="More" onPress={moreActions} />} />
      {myBizId && <View style={{ paddingHorizontal: 16, paddingTop: 8 }}><Badge label={`Replying as ${businesses.find((b) => b.id === myBizId)?.name}`} tone="primary" /></View>}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={items}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 6 }}
          onEndReached={() => msgs.hasNextPage && !msgs.isFetchingNextPage && msgs.fetchNextPage()}
          renderItem={({ item: m }) => {
            const mine = m.sender_id === user?.id;
            const atts = (Array.isArray(m.attachments) ? m.attachments : []) as unknown as Attachment[];
            return (
              <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                <View style={[styles.bubble, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderBottomRightRadius: mine ? 4 : radius.lg, borderBottomLeftRadius: mine ? radius.lg : 4 }]}>
                  {atts.map((a) => (
                    <AttachmentView key={a.path} a={a} />
                  ))}
                  {m.body && <Text style={{ color: mine ? colors.onPrimary : colors.text }}>{m.body}</Text>}
                </View>
                <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
            );
          }}
          ListEmptyComponent={msgs.isLoading ? <Loading /> : <Text color="muted" center style={{ marginTop: 20 }}>Say hello 👋</Text>}
        />
        {error && <Text color="danger" variant="caption" style={{ paddingHorizontal: 16 }}>{error}</Text>}
        <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
          <Pressable onPress={attach} hitSlop={8} accessibilityLabel="Attach image" style={styles.attach}><Ionicons name="image-outline" size={24} color={colors.primary} /></Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="Message…" placeholderTextColor={colors.textMuted} multiline maxLength={4000} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]} accessibilityLabel="Message" />
          <Button title="Send" size="sm" loading={send.isPending || sending} disabled={!text.trim()} onPress={() => send.mutate({ body: text.trim() })} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function AttachmentView({ a }: { a: Attachment }) {
  const url = useQuery({ queryKey: ['signed', a.path], queryFn: () => api.storage.signedUrl('message-attachments', a.path, 3600), staleTime: 50 * 60_000 });
  if (!url.data) return <Text variant="caption" color="muted">Loading attachment…</Text>;
  if (a.type.startsWith('image/')) return <Image source={{ uri: url.data }} style={{ width: 200, height: 200, borderRadius: 12, marginBottom: 6 }} contentFit="cover" />;
  return <Text variant="label">{a.name}</Text>;
}

const styles = StyleSheet.create({
  bubbleWrap: { marginVertical: 2 },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  attach: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 42, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, borderWidth: 1 },
});
