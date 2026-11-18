import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { Avatar, Badge, Button, Card, Divider, Screen, Text, VerificationBadges } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, profile, businesses, roles, signOut } = useAuth();
  const unread = useQuery({ queryKey: ['unread', user?.id], queryFn: () => api.notifications.unread(), enabled: !!user });
  const rewards = useQuery({ queryKey: ['rewards', user?.id], queryFn: () => api.rewards.summary(), enabled: !!user, staleTime: 60_000 });
  const points = rewards.data?.enabled ? rewards.data.balance : null;

  if (!user) {
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + 8 }}><Text variant="title">Profile</Text></View>
        <Card style={{ marginTop: 20 }}>
          <Text variant="subheading">One account for the whole Adey ecosystem</Text>
          <Text color="muted" style={{ marginTop: 6 }}>Shop and save as a customer, run your business, list advertising screens, and launch campaigns — all from one login.</Text>
          <Button title="Sign In" style={{ marginTop: 16 }} fullWidth onPress={() => router.push('/(auth)/sign-in')} />
          <Button title="Create Account" variant="outline" style={{ marginTop: 8 }} fullWidth onPress={() => router.push('/(auth)/sign-up')} />
        </Card>
        <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Community</Text>
        <Card padded={false}><MenuRow icon="calendar-outline" label="Community events" onPress={() => router.push('/(tabs)/events')} /></Card>
        <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Help & settings</Text>
        <Card padded={false}>
          <MenuRow icon="help-buoy-outline" label="Help centre" onPress={() => router.push('/help')} />
          <Divider />
          <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + 8, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar url={profile?.avatar_url} name={profile?.display_name} size={64} />
        <View style={{ flex: 1 }}>
          <Text variant="heading">{profile?.display_name ?? 'Adey member'}</Text>
          <Text variant="caption" color="muted">{user.email}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <Badge label="Customer" tone="neutral" />
            {roles.businessOwner && <Badge label="Business owner" tone="primary" />}
            {roles.advertiser && <Badge label="Advertiser" tone="accent" />}
            {roles.screenOwner && <Badge label="Screen owner" tone="info" />}
            {roles.staff && <Badge label={profile?.platform_role === 'admin' ? 'Admin' : 'Moderator'} tone="danger" />}
          </View>
        </View>
        <Pressable onPress={() => router.push('/profile/edit')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit profile" style={styles.edit}><Ionicons name="create-outline" size={22} color={colors.primary} /></Pressable>
      </View>

      <View style={styles.quick}>
        <Quick icon="receipt-outline" label="Orders" onPress={() => router.push('/orders')} />
        {rewards.data?.enabled && <Quick icon="gift-outline" label={points != null ? `${points.toLocaleString()} pts` : 'Rewards'} a11y="Adey Rewards" onPress={() => router.push('/rewards')} />}
        <Quick icon="heart-outline" label="Saved" onPress={() => router.push('/(tabs)/saved')} />
        <Quick icon="chatbubbles-outline" label="Messages" badge={unread.data?.messages} onPress={() => router.push('/messages')} />
        <Quick icon="notifications-outline" label="Notifications" badge={unread.data?.notifications} onPress={() => router.push('/notifications')} />
      </View>

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>My businesses</Text>
      {businesses.length === 0 ? (
        <Card>
          <Text variant="subheading">Own a business or sell from Ethiopia?</Text>
          <Text color="muted" style={{ marginTop: 4 }}>List it on Adey Market for free. You'll also unlock AdConnect as an advertiser or screen owner.</Text>
          <Button title="Add my business" icon="add" style={{ marginTop: 12 }} onPress={() => router.push('/business/new')} />
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {businesses.map((b) => (
            <Card key={b.id} onPress={() => router.push(`/dashboard/${b.id}`)} accessibilityLabel={`Manage ${b.name}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar url={b.logo_url ? api.storage.publicUrl('business-media', b.logo_url) : null} name={b.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{b.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <Badge label={b.status} tone={b.status === 'published' ? 'success' : b.status === 'suspended' ? 'danger' : 'warning'} />
                    <Badge label={b.market === 'us' ? 'US Market' : 'Ethiopian Market'} tone="neutral" />
                    <Badge label={b.role} tone="neutral" />
                  </View>
                  <View style={{ marginTop: 6 }}><VerificationBadges badges={b.badges} compact /></View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ))}
          <Button title="Add another business" variant="ghost" icon="add" onPress={() => router.push('/business/new')} />
        </View>
      )}

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Shopping</Text>
      <Card padded={false}>
        <MenuRow icon="receipt-outline" label="My orders" onPress={() => router.push('/orders')} />
        <Divider />
        <MenuRow icon="location-outline" label="Delivery addresses" onPress={() => router.push('/settings/addresses')} />
        {rewards.data?.enabled && (<><Divider /><MenuRow icon="gift-outline" label="Adey Rewards" value={points != null ? `${points.toLocaleString()} pts` : undefined} onPress={() => router.push('/rewards')} /></>)}
        <Divider />
        <MenuRow icon="calendar-outline" label="Events I am going to" onPress={() => router.push('/(tabs)/events?mine=1')} />
        <Divider />
        <MenuRow icon="list-outline" label="Events I submitted" onPress={() => router.push('/events/mine')} />
      </Card>

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>AdConnect</Text>
      <Card padded={false}>
        <MenuRow icon="tv-outline" label="Find advertising screens" onPress={() => router.push('/adconnect/screens')} />
        <Divider />
        <MenuRow icon="megaphone-outline" label="My campaigns" onPress={() => router.push('/adconnect/campaigns')} />
        <Divider />
        <MenuRow icon="albums-outline" label="My screens & incoming requests" onPress={() => router.push('/adconnect/my-screens')} />
      </Card>

      <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Help & settings</Text>
      <Card padded={false}>
        <MenuRow icon="help-buoy-outline" label="Help & support" onPress={() => router.push('/support')} />
        <Divider />
        <MenuRow icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
      </Card>

      {roles.staff && (
        <>
          <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>Administration</Text>
          <Card padded={false}><MenuRow icon="shield-outline" label="Verification & moderation queue" onPress={() => router.push('/admin')} /></Card>
        </>
      )}

      <Button title="Sign out" variant="outline" icon="log-out-outline" style={{ marginTop: 20 }} fullWidth onPress={() => signOut().then(() => router.replace('/(tabs)'))} />
      <Text variant="caption" color="muted" center style={{ marginTop: 16 }}>ADEY v{Constants.expoConfig?.version} · {user.id.slice(0, 8)}</Text>
    </Screen>
  );
}

function Quick({ icon, label, badge, onPress, a11y }: { icon: keyof typeof Ionicons.glyphMap; label: string; badge?: number; onPress: () => void; a11y?: string }) {
  const { colors, radius } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a11y ?? label}${badge ? `, ${badge} unread` : ''}`} style={({ pressed }) => [styles.quickItem, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}>
      <View>
        <Ionicons name={icon} size={22} color={colors.primary} />
        {!!badge && <View style={[styles.dot, { backgroundColor: colors.danger }]}><Text variant="caption" style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>{badge}</Text></View>}
      </View>
      <Text variant="caption" style={{ marginTop: 6, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  quickItem: { flexGrow: 1, flexBasis: '30%', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderWidth: 1, minHeight: 64 },
  dot: { position: 'absolute', top: -6, right: -10, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  edit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
