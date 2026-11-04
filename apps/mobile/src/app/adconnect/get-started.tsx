import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Button, Card, Header, Screen, Text } from '@/components/ui';

/** Guidance for users without a business: AdConnect roles are derived from business ownership. */
export default function GetStarted() {
  const { colors } = useTheme();
  return (
    <Screen header={<Header title="Get started with AdConnect" />}>
      <Text color="muted" style={{ marginBottom: 16 }}>You don't need a separate advertiser or screen-owner account. One business profile does both — and it's free.</Text>
      <Card>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Ionicons name="megaphone-outline" size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">I want to advertise</Text>
            <Text color="muted" style={{ marginTop: 4 }}>Create a profile for the business you're promoting (e.g. a real-estate agency, a church event, a clinic). Then build a campaign and pick screens.</Text>
          </View>
        </View>
      </Card>
      <Card style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Ionicons name="tv-outline" size={26} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">I have screens to rent</Text>
            <Text color="muted" style={{ marginTop: 4 }}>Create your business profile (restaurant, barbershop, grocery…). Publish it, then add your TVs under "My screens" with pricing and hours.</Text>
          </View>
        </View>
      </Card>
      <Button title="Create my business profile" size="lg" fullWidth style={{ marginTop: 20 }} onPress={() => router.replace('/business/new')} />
      <Text variant="caption" color="muted" center style={{ marginTop: 12 }}>Already on the website? The same business appears here automatically — one shared account.</Text>
    </Screen>
  );
}
