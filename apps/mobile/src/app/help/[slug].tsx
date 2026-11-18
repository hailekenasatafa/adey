import React from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { helpCategoryLabels } from '@adey/shared';
import { api } from '@/lib/supabase';
import { Badge, Button, Card, EmptyState, ErrorState, Header, Loading, Screen, Text } from '@/components/ui';
import { fmtDate } from '@/lib/format';

export default function HelpArticle() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useQuery({ queryKey: ['help', 'article', slug], queryFn: () => api.support.article(slug) });
  const header = <Header title="Help" />;
  if (q.isLoading) return <Screen header={header}><Loading /></Screen>;
  if (q.isError) return <Screen header={header}><ErrorState error={q.error} onRetry={() => q.refetch()} /></Screen>;
  const a = q.data;
  if (!a) return <Screen header={header}><EmptyState icon="document-outline" title="Article not found" action="Back to help" onAction={() => router.replace('/help')} /></Screen>;
  const paragraphs = a.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <Screen header={header}>
      <Badge label={helpCategoryLabels[a.category] ?? a.category} tone="primary" />
      <Text variant="heading" accessibilityRole="header" style={{ marginTop: 8 }}>{a.title}</Text>
      <Text variant="caption" color="muted" style={{ marginBottom: 14 }}>Updated {fmtDate(a.updated_at)}</Text>
      {paragraphs.map((p, i) => <Text key={i} style={{ marginBottom: 12 }}>{p}</Text>)}
      <Card style={{ marginTop: 12 }}>
        <Text variant="bodyStrong">Did this not answer your question?</Text>
        <Button title="Ask the assistant" icon="chatbubble-ellipses-outline" style={{ marginTop: 10 }} onPress={() => router.push('/support')} />
      </Card>
    </Screen>
  );
}
