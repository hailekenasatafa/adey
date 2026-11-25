import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, supportMessageSchema, type SupportMessage } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Button, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';

const STARTERS = ['Where is my order?', 'How do refunds work?', 'How do I become a verified seller?', 'How do Adey Connect Rewards work?'];

export default function SupportChat() {
  const { id, order, q: starter } = useLocalSearchParams<{ id: string; order?: string; q?: string }>();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [threadId, setThreadId] = useState<string | null>(id && id !== 'new' ? id : null);
  const [text, setText] = useState(starter ? String(starter) : '');
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(true);
  const handedRef = useRef(new Set<string>());
  const listRef = useRef<FlatList<SupportMessage>>(null);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  const msgs = useQuery({ queryKey: ['support-messages', threadId], queryFn: () => api.support.messages(threadId!), enabled: !!threadId && !!user, refetchInterval: focused ? 10_000 : false });
  const threads = useQuery({ queryKey: ['support-threads', user?.id], queryFn: () => api.support.threads(), enabled: !!user, refetchInterval: focused && !!threadId ? 10_000 : false });
  const thread = threads.data?.find((t) => t.id === threadId);
  const waiting = thread?.status === 'waiting_staff';
  const resolved = thread?.status === 'resolved';

  const afterChange = async (tid: string) => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['support-messages', tid] }), qc.invalidateQueries({ queryKey: ['support-threads'] })]);
  };
  const human = useMutation({
    mutationFn: ({ tid, reason }: { tid: string; reason?: string }) => api.support.requestHuman(tid, reason),
    onSuccess: async (_d, v) => { handedRef.current.add(v.tid); setNotice('The Adey Connect support team has been notified. A person will reply in this conversation.'); await afterChange(v.tid); },
    onError: (e) => setErr(friendlyError(e)),
  });
  const send = useMutation({
    mutationFn: async (message: string) => {
      const r = await api.support.send(message, threadId, order ?? null);
      if (r.reply === null && !r.ai_enabled && !r.handed_off && !handedRef.current.has(r.thread_id)) {
        handedRef.current.add(r.thread_id);
        await api.support.requestHuman(r.thread_id, message);
        return { ...r, handed_off: true, asked: true };
      }
      return { ...r, asked: false };
    },
    onSuccess: async (r) => {
      setThreadId(r.thread_id);
      if (r.asked || r.handed_off) setNotice('The Adey Connect support team has been notified. A person will reply in this conversation.');
      await afterChange(r.thread_id);
      setPending(null);
    },
    onError: (e, message) => { setPending(null); setText(message); setErr(friendlyError(e)); },
  });

  const submit = () => {
    const r = supportMessageSchema.safeParse({ message: text });
    if (!r.success || send.isPending) return;
    setErr(null);
    setNotice(null);
    setPending(r.data.message);
    setText('');
    send.mutate(r.data.message);
  };

  const list = msgs.data ?? [];
  useEffect(() => { const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50); return () => clearTimeout(t); }, [list.length, pending, send.isPending]);

  const header = <Header title="Support" subtitle={waiting ? 'Waiting for the support team' : resolved ? 'Resolved' : 'Adey Connect Assistant'} right={threadId && !waiting ? <Pressable onPress={() => human.mutate({ tid: threadId })} disabled={human.isPending} accessibilityRole="button" accessibilityLabel="Talk to a person" style={{ minHeight: 44, justifyContent: 'center', alignItems: 'flex-end' }}><Ionicons name="person-circle-outline" size={26} color={colors.primary} /></Pressable> : undefined} />;
  if (!user) return <Screen header={header}><EmptyState icon="chatbubble-ellipses-outline" title="Sign in to chat with support" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;

  return (
    <Screen header={header} scroll={false} padded={false} bottomInset={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ marginBottom: 6 }}>
              <Text variant="caption" color="muted" center>Replies from the Adey Connect Assistant are automated and can be wrong. Ask for a person any time.</Text>
              {!!order && <Text variant="caption" color="muted" center>This conversation is about one of your orders.</Text>}
            </View>
          }
          renderItem={({ item }) => <Bubble m={item} />}
          ListEmptyComponent={
            msgs.isLoading && threadId ? <Loading /> : msgs.isError ? <ErrorState error={msgs.error} onRetry={() => msgs.refetch()} /> : pending ? <View /> : (
              <View style={{ gap: 8, marginTop: 12 }}>
                <Text variant="subheading" center>How can we help?</Text>
                {STARTERS.map((s) => <Button key={s} title={s} variant="outline" onPress={() => setText(s)} />)}
                <Button title="Browse the help centre" variant="ghost" icon="book-outline" onPress={() => router.push('/help')} />
              </View>
            )
          }
          ListFooterComponent={
            <View style={{ gap: 10 }}>
              {!!pending && <Bubble m={{ id: 'pending', role: 'user', content: pending, created_at: new Date().toISOString(), thread_id: '', author_id: null, meta: {} }} />}
              {send.isPending && <Typing />}
              {(waiting || !!notice) && <Banner text="The Adey Connect support team has been notified. A person will reply in this conversation. You will get a notification when they do." />}
              {resolved && <Banner text="This conversation was marked resolved. Send a message if you still need help." />}
              {!!err && <Text color="danger" variant="caption" center accessibilityLiveRegion="polite">{err}</Text>}
            </View>
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Message"
            multiline
            maxLength={4000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 16 }}
          />
          <Pressable onPress={submit} disabled={!text.trim() || send.isPending} accessibilityRole="button" accessibilityLabel="Send message" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || send.isPending ? 0.5 : 1 }}>
            <Ionicons name="send" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
        {!!threadId && !waiting && (
          <Pressable onPress={() => human.mutate({ tid: threadId })} disabled={human.isPending} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingBottom: 4 }}>
            <Text variant="label" color="primary">{human.isPending ? 'Asking…' : 'Talk to a person'}</Text>
          </Pressable>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ m }: { m: SupportMessage }) {
  const { colors, radius } = useTheme();
  if (m.role === 'system') return <Text variant="caption" color="muted" center style={{ marginVertical: 4 }}>{m.content}</Text>;
  const mine = m.role === 'user';
  const who = m.role === 'assistant' ? 'Adey Connect Assistant · automated' : m.role === 'staff' ? 'Adey Connect support team' : null;
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%' }} accessible accessibilityLabel={`${mine ? 'You' : who ?? 'Adey Connect'}: ${m.content}`}>
      {!!who && <Text variant="caption" color={m.role === 'staff' ? 'primary' : 'muted'} style={{ marginBottom: 2, fontWeight: '600' }}>{who}</Text>}
      <View style={{ backgroundColor: mine ? colors.primary : m.role === 'staff' ? colors.primarySoft : colors.surfaceMuted, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 }}>
        <Text style={{ color: mine ? colors.onPrimary : colors.text }} selectable>{m.content}</Text>
      </View>
    </View>
  );
}

function Typing() {
  const { colors, radius } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start' }} accessibilityLiveRegion="polite" accessibilityLabel="Adey Connect Assistant is typing">
      <Text variant="caption" color="muted" style={{ marginBottom: 2, fontWeight: '600' }}>Adey Connect Assistant · automated</Text>
      <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', gap: 4 }}>
        {[0.4, 0.7, 1].map((o, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted, opacity: o }} />)}
      </View>
    </View>
  );
}

function Banner({ text }: { text: string }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12 }} accessibilityLiveRegion="polite">
      <Text variant="caption" color="primary" center>{text}</Text>
    </View>
  );
}
