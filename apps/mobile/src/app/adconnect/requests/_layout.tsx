import React from 'react';
import { Stack } from 'expo-router';
import { CampaignsGate } from '@/components/CampaignsGate';

export default function Layout() {
  return <CampaignsGate><Stack screenOptions={{ headerShown: false }} /></CampaignsGate>;
}
