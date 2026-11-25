import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { friendlyError, helpCategoryLabels } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Button, Card, Divider, EmptyState, ErrorState, Header, Input, Loading, Screen, Text } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';

export default function Help() {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const t = setTimeout(() => setTerm(text.trim()), 350); return () => clearTimeout(t); }, [text]);
  const all = useQuery({ queryKey: ['help', 'articles'], queryFn: () => api.support.articles(), staleTime: 5 * 60_000 });
  const found = useQuery({ queryKey: ['help', 'search', term], queryFn: () => api.support.searchHelp(term), enabled: term.length >= 2 });
  const articles = all.data;
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof articles>>();
    for (const a of articles ?? []) m.set(a.category, [...(m.get(a.category) ?? []), a]);
    return [...m.entries()];
  }, [articles]);
  const searching = term.length >= 2;

  return (
    <Screen header={<Header title="Help centre" />} keyboard>
      <Input icon="search" placeholder="Search for help" value={text} onChangeText={setText} returnKeyType="search" autoCorrect={false} accessibilityLabel="Search help articles" containerStyle={{ marginBottom: 8 }} />
      {searching ? (
        found.isLoading ? <Loading /> : found.isError ? <Text color="danger">{friendlyError(found.error)}</Text> : (found.data ?? []).length === 0 ? (
          <EmptyState icon="search-outline" title="No articles found" body="Try different words, or ask the assistant." action="Ask the assistant" onAction={() => router.push('/support')} />
        ) : (
          <Card padded={false}>
            {(found.data ?? []).map((a, i) => (
              <View key={a.slug}>
                {i > 0 && <Divider />}
                <MenuRow icon="document-text-outline" label={a.title} onPress={() => router.push(`/help/${a.slug}`)} />
              </View>
            ))}
          </Card>
        )
      ) : all.isLoading ? <Loading /> : all.isError ? <ErrorState error={all.error} onRetry={() => all.refetch()} /> : groups.length === 0 ? (
        <EmptyState icon="help-circle-outline" title="No help articles yet" body="You can still ask the assistant a question." action="Ask the assistant" onAction={() => router.push('/support')} />
      ) : (
        <>
          {groups.map(([cat, items]) => (
            <View key={cat}>
              <Text variant="overline" color="muted" style={{ marginTop: 20, marginBottom: 8 }}>{helpCategoryLabels[cat] ?? cat}</Text>
              <Card padded={false}>
                {items.map((a, i) => (
                  <View key={a.slug}>
                    {i > 0 && <Divider />}
                    <MenuRow icon="document-text-outline" label={a.title} onPress={() => router.push(`/help/${a.slug}`)} />
                  </View>
                ))}
              </Card>
            </View>
          ))}
        </>
      )}
      <Card style={{ marginTop: 24 }}>
        <Text variant="bodyStrong">Still need help?</Text>
        <Text color="muted">Chat with the Adey Connect assistant. You can ask for a person at any time.</Text>
        <Button title="Ask the assistant" icon="chatbubble-ellipses-outline" style={{ marginTop: 10 }} onPress={() => router.push('/support')} />
      </Card>
    </Screen>
  );
}
