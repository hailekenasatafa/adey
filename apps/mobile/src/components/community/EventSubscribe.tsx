import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { WEB_URL } from '@/lib/supabase';
import { Button, Card, Text } from '@/components/ui';

/** Calendar subscription that follows the current filters. */
export function EventSubscribe({ region, category, tag }: { region?: string | null; category?: string | null; tag?: string | null }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const qs = new URLSearchParams();
  if (region) qs.set('region', region);
  if (category) qs.set('category', category);
  if (tag) qs.set('tag', tag);
  const q = qs.toString();
  const https = `${WEB_URL}/events/calendar.ics${q ? `?${q}` : ''}`;
  const webcal = https.replace(/^https?:/, 'webcal:');

  const phone = () => Linking.openURL(webcal).catch(() => Linking.openURL(https).catch(() => setMsg('Could not open a calendar app.')));
  const google = () => Linking.openURL(`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`).catch(() => setMsg('Could not open Google Calendar.'));
  const copy = async () => { try { await Clipboard.setStringAsync(https); setMsg('Link copied.'); } catch { setMsg('Could not copy the link.'); } };

  return (
    <View>
      <Button title={open ? 'Hide subscribe options' : 'Subscribe to this calendar'} icon="calendar-outline" variant="outline" size="sm" fullWidth onPress={() => { setOpen(!open); setMsg(null); }} accessibilityState={{ expanded: open }} />
      {open && (
        <Card style={{ marginTop: 8, gap: 8 }}>
          <Text variant="caption" color="muted">Your calendar app refreshes this by itself every few hours{region || category || tag ? ', following the filters you picked' : ''}.</Text>
          <Button title="Add to my phone's calendar" icon="phone-portrait-outline" variant="secondary" fullWidth onPress={phone} />
          <Button title="Google Calendar" icon="logo-google" variant="secondary" fullWidth onPress={google} />
          <Button title="Copy link" icon="copy-outline" variant="ghost" fullWidth onPress={copy} />
          {!!msg && <Text variant="caption" color="muted" accessibilityLiveRegion="polite">{msg}</Text>}
        </Card>
      )}
    </View>
  );
}
