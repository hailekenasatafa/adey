import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/auth';

import { ONBOARDING_KEY } from '@/lib/constants';

/** Entry: first launch → onboarding; otherwise → tabs (browsing never requires an account). */
export default function Index() {
  const { session, loading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => setOnboarded(v === '1'));
  }, []);
  if (onboarded === null || loading) return null; // branded splash overlay is visible
  if (!onboarded && !session) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
