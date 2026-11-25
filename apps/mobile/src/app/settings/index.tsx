import React from 'react';
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { countryName } from '@adey/shared';
import { useTheme, type ThemePreference } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { Card, Divider, Header, Screen, Text } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';

const THEMES: { key: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function Settings() {
  const { colors, preference, setPreference } = useTheme();
  const { user, profile } = useAuth();
  const h = (t: string) => <Text variant="overline" color="muted" style={{ marginTop: 24, marginBottom: 8 }}>{t}</Text>;
  return (
    <Screen header={<Header title="Settings" />}>
      {user && (
        <>
          {h('Account')}
          <Card padded={false}>
            <MenuRow icon="person-outline" label="Edit profile" onPress={() => router.push('/profile/edit')} />
            <Divider />
            <MenuRow icon="mail-outline" label="Email" value={user.email ?? undefined} onPress={() => router.push('/settings/security')} />
            <Divider />
            <MenuRow icon="lock-closed-outline" label="Password & security" onPress={() => router.push('/settings/security')} />
            <Divider />
            <MenuRow icon="location-outline" label="Delivery addresses" onPress={() => router.push('/settings/addresses')} />
          </Card>
        </>
      )}

      {h('Appearance')}
      <Card padded={false} accessibilityRole="radiogroup">
        {THEMES.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <Divider />}
            <Pressable onPress={() => setPreference(t.key)} accessibilityRole="radio" accessibilityState={{ selected: preference === t.key }} accessibilityLabel={t.label} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52, opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name={t.icon} size={20} color={colors.primary} />
              <Text style={{ flex: 1, marginLeft: 12 }}>{t.label}</Text>
              {preference === t.key && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          </React.Fragment>
        ))}
      </Card>

      {user && (
        <>
          {h('Preferences')}
          <Card padded={false}>
            <MenuRow icon="cash-outline" label="Currency & country" value={`${profile?.preferred_currency ?? 'USD'}${profile?.country ? ' · ' + countryName(profile.country) : ''}`} onPress={() => router.push('/settings/currency')} />
            <Divider />
            <MenuRow icon="language-outline" label="Language" value={profile?.locale === 'am' ? 'አማርኛ' : 'English'} onPress={() => router.push('/profile/edit')} />
            <Divider />
            <MenuRow icon="notifications-circle-outline" label="Notification preferences" onPress={() => router.push('/profile/notifications')} />
            <Divider />
            <MenuRow icon="eye-off-outline" label="Privacy" onPress={() => router.push('/settings/privacy')} />
          </Card>
        </>
      )}

      {h('Help & legal')}
      <Card padded={false}>
        <MenuRow icon="help-buoy-outline" label="Help centre" onPress={() => router.push('/help')} />
        {user && (<><Divider /><MenuRow icon="chatbubble-ellipses-outline" label="Contact support" onPress={() => router.push('/support')} /></>)}
        <Divider />
        <MenuRow icon="document-outline" label="Privacy policy & terms" onPress={() => router.push('/profile/legal')} />
        {user && (<><Divider /><MenuRow icon="trash-outline" label="Delete account" danger onPress={() => router.push('/profile/delete-account')} /></>)}
      </Card>
      <Text variant="caption" color="muted" center style={{ marginTop: 20 }}>Adey Connect v{Constants.expoConfig?.version}</Text>
    </Screen>
  );
}
