import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { friendlyError, type DealClaimRef } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { Badge, Button, Card, Text } from '@/components/ui';
import { ReportButton } from '@/components/ReportButton';
import { cover } from '@/components/cards';

/** What every deal card needs, whether it comes from a business page or the deals feed. */
export type DealView = {
  id: string; title: string; description: string | null; terms: string | null; image_path: string | null;
  claims_count: number; my_claim: DealClaimRef | null;
  business: { id: string; slug: string; name: string; place?: string | null; cover_url?: string | null };
};

export function DealCard({ deal, showBusiness = false }: { deal: DealView; showBusiness?: boolean }) {
  const { colors } = useTheme();
  const img = cover('business-media', deal.image_path) ?? (showBusiness ? cover('business-media', deal.business.cover_url) : null);
  return (
    <Card padded={false} accessibilityLabel={deal.title}>
      {(img || showBusiness) && (
        <View style={[styles.img, { backgroundColor: colors.accentSoft }]}>
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Text style={{ fontSize: 32 }}>🏷️</Text>}
          <View style={styles.tag}><Badge label="Deal" tone="primary" icon="pricetag" /></View>
        </View>
      )}
      <View style={{ padding: 14, gap: 4 }}>
        {showBusiness && (
          <Pressable onPress={() => router.push(`/business/${deal.business.slug}`)} accessibilityRole="link">
            <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>{deal.business.name}{deal.business.place ? ` · ${deal.business.place}` : ''}</Text>
          </Pressable>
        )}
        <Text variant="subheading">{!img && !showBusiness ? '🏷️ ' : ''}{deal.title}</Text>
        {deal.description ? <Text variant="caption" color="muted" numberOfLines={3}>{deal.description}</Text> : null}
        {deal.terms ? <Text variant="caption" color="muted"><Text variant="caption" style={{ fontWeight: '600' }}>Conditions: </Text>{deal.terms}</Text> : null}
        <View style={{ marginTop: 10 }}><ClaimButton deal={deal} /></View>
        <View style={styles.footer}>
          <Text variant="caption" color="muted">{deal.claims_count > 0 ? `${deal.claims_count} ${deal.claims_count === 1 ? 'member' : 'members'} claimed` : 'Be the first to claim'}</Text>
          <ReportButton targetType="deal" targetId={deal.id} />
        </View>
      </View>
    </Card>
  );
}

/** Claims the deal (sign-in first if needed), then shows the code. Claiming again shows the same code. */
export function ClaimButton({ deal }: { deal: DealView }) {
  const { user, businesses } = useAuth();
  const qc = useQueryClient();
  const [claim, setClaim] = useState<DealClaimRef | null>(deal.my_claim);
  const [open, setOpen] = useState(false);
  const go = useMutation({
    mutationFn: () => api.deals.claim(deal.id),
    onSuccess: (c) => { setClaim({ id: c.id, code: c.code, redeemed_at: c.redeemed_at }); setOpen(true); qc.invalidateQueries({ queryKey: ['my-deals'] }); qc.invalidateQueries({ queryKey: ['business-deals'] }); },
  });
  if (businesses.some((b) => b.id === deal.business.id)) return <Text variant="caption" color="muted" center>Your business’s deal — customers claim it here.</Text>;
  return (
    <>
      <Button title={claim ? (claim.redeemed_at ? 'Used — view code' : 'Show my code') : 'Claim deal'} variant={claim ? 'secondary' : 'primary'} icon={claim ? 'qr-code-outline' : 'pricetag-outline'} fullWidth loading={go.isPending}
        onPress={() => (claim ? setOpen(true) : !user ? router.push('/(auth)/sign-in') : go.mutate())} />
      {go.error && <Text variant="caption" color="danger" style={{ marginTop: 6 }}>{friendlyError(go.error)}</Text>}
      {claim && <CodeSheet visible={open} code={claim.code} redeemedAt={claim.redeemed_at} title={deal.title} businessName={deal.business.name} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CodeSheet({ visible, code, redeemedAt, title, businessName, onClose }: { visible: boolean; code: string; redeemedAt: string | null; title: string; businessName: string; onClose: () => void }) {
  const { colors, radius } = useTheme();
  const [copied, setCopied] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, justifyContent: 'center', gap: 16 }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: radius.lg, padding: 20 }}>
          <Text variant="overline" style={{ color: colors.onPrimary, opacity: 0.85 }}>{redeemedAt ? 'Used' : 'Your deal code'}</Text>
          <Text variant="subheading" style={{ color: colors.onPrimary }}>{title}</Text>
        </View>
        <Text center selectable accessibilityLabel={code.split('').join(' ')} style={{ fontSize: 40, lineHeight: 48, fontWeight: '700', letterSpacing: 6, fontVariant: ['tabular-nums'], color: redeemedAt ? colors.textMuted : colors.primary, textDecorationLine: redeemedAt ? 'line-through' : 'none' }}>{code}</Text>
        <Text center color="muted">{redeemedAt ? `${businessName} marked this code as used on ${new Date(redeemedAt).toLocaleDateString()}.` : `Show this code at ${businessName}. They enter it to mark the deal as used.`}</Text>
        <Button title={copied ? 'Copied' : 'Copy code'} variant="outline" icon="copy-outline" onPress={() => Clipboard.setStringAsync(code).then(() => setCopied(true))} />
        <Button title="My deals" variant="outline" icon="pricetags-outline" onPress={() => { onClose(); router.push('/deals/mine'); }} />
        <Button title="Done" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  img: { height: 140, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tag: { position: 'absolute', top: 10, left: 10 },
  footer: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
