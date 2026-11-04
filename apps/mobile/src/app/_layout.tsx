import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, View } from 'react-native';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';
import { NetworkProvider } from '@/lib/network';
import { LocationProvider } from '@/lib/location';
import { CampaignCartProvider } from '@/lib/campaignCart';
import { hydratePublicCache, persistPublicCache, queryClient } from '@/lib/query';
import { usePushNotifications } from '@/lib/notifications';
import { BrandSplash } from '@/components/BrandSplash';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Startup work kept minimal: restore the offline cache, then release the native splash.
    hydratePublicCache().finally(() => setReady(true));
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') persistPublicCache();
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <NetworkProvider>
              <AuthProvider>
                <LocationProvider>
                  <CampaignCartProvider>
                    <Shell ready={ready} />
                  </CampaignCartProvider>
                </LocationProvider>
              </AuthProvider>
            </NetworkProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Shell({ ready }: { ready: boolean }) {
  const { colors, scheme } = useTheme();
  const [brandDone, setBrandDone] = useState(false);
  usePushNotifications();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="search" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="location" options={{ presentation: 'modal' }} />
      </Stack>
      {ready && !brandDone && <BrandSplash onDone={() => setBrandDone(true)} />}
    </View>
  );
}
