import React, { useState } from 'react';
import { Switch, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { friendlyError, notificationPrefsSchema, type NotificationPrefs } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { Button, Card, Divider, Header, Screen, Text } from '@/components/ui';

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'push', label: 'Push notifications', hint: 'Master switch for alerts on this device' },
  { key: 'email', label: 'Email notifications', hint: 'Summaries and important account updates' },
  { key: 'inquiries', label: 'Customer inquiries', hint: 'New messages and quote requests for your business' },
  { key: 'ad_requests', label: 'Advertising requests', hint: 'When an advertiser wants your screens' },
  { key: 'offers', label: 'Offers & counteroffers', hint: 'Accepted, countered, declined, or expired' },
  { key: 'bookings', label: 'Bookings', hint: 'Confirmations and completions' },
  { key: 'verification', label: 'Verification updates', hint: 'Progress on your verification requests' },
  { key: 'payments', label: 'Payments', hint: 'Only used once Monetized Mode is enabled' },
  { key: 'messages', label: 'Messages', hint: 'New chat messages' },
  { key: 'marketing', label: 'Tips & announcements', hint: 'Occasional news from Adey' },
];

export default function NotificationPrefsScreen() {
  const { colors } = useTheme();
  const { profile, refresh } = useAuth();
  const parsed = notificationPrefsSchema.safeParse(profile?.notification_prefs);
  const [prefs, setPrefs] = useState<NotificationPrefs>(parsed.success ? parsed.data : { push: true, email: true, inquiries: true, ad_requests: true, offers: true, bookings: true, verification: true, payments: true, messages: true, marketing: false });
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (next: NotificationPrefs) => api.profile.update({ notification_prefs: next }),
    onSuccess: () => refresh(),
    onError: (e) => setError(friendlyError(e)),
  });

  const toggle = (key: keyof NotificationPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    save.mutate(next);
    if (key === 'push' && next.push) registerForPushNotificationsAsync().then((t) => setStatus(t ? 'Push enabled on this device.' : 'Push could not be enabled (permission denied, simulator, or EAS project not configured).'));
  };

  return (
    <Screen header={<Header title="Notifications" />}>
      <Card padded={false}>
        {ROWS.map((r, i) => (
          <View key={r.key}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text variant="bodyStrong">{r.label}</Text>
                <Text variant="caption" color="muted">{r.hint}</Text>
              </View>
              <Switch value={prefs[r.key]} onValueChange={() => toggle(r.key)} trackColor={{ true: colors.primary }} accessibilityLabel={r.label} />
            </View>
          </View>
        ))}
      </Card>
      {status && <Text variant="caption" color="muted" style={{ marginTop: 12 }}>{status}</Text>}
      {error && <Text variant="caption" color="danger" style={{ marginTop: 12 }}>{error}</Text>}
      <Button title="Re-register this device for push" variant="ghost" style={{ marginTop: 16 }} onPress={() => registerForPushNotificationsAsync().then((t) => setStatus(t ? 'Device registered.' : 'Could not register (see hint above).'))} />
    </Screen>
  );
}
