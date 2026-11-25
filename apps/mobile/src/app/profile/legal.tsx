import React from 'react';
import { WEB_URL } from '@/lib/supabase';
import { openWebsite } from '@/lib/actions';
import { Card, Divider, Header, Screen, Text } from '@/components/ui';
import { MenuRow } from '@/components/MenuRow';

export default function Legal() {
  return (
    <Screen header={<Header title="Privacy & terms" />}>
      <Card padded={false}>
        <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => openWebsite(`${WEB_URL}/legal/terms`)} />
        <Divider />
        <MenuRow icon="lock-closed-outline" label="Privacy Policy" onPress={() => openWebsite(`${WEB_URL}/legal/privacy`)} />
        <Divider />
        <MenuRow icon="shield-checkmark-outline" label="How verification works" onPress={() => openWebsite(`${WEB_URL}/verification`)} />
      </Card>
      <Text variant="caption" color="muted" style={{ marginTop: 16 }}>
        Adey Connect stores your account data with Supabase (US East). Identity documents uploaded for verification are kept in a private bucket readable only by you and Adey Connect staff reviewing your request.
      </Text>
    </Screen>
  );
}
