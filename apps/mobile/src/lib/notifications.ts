import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from './supabase';
import { useAuth } from './auth';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

/** Request permission and register the Expo push token with the shared backend. */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators/emulators cannot receive push
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Adey Connect',
      // eslint-disable-next-line import/namespace -- re-exported via `export *`, resolves fine at runtime/tsc
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E8B923',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || projectId.startsWith('REPLACE')) {
    console.warn('[adey] EAS projectId not configured; push tokens cannot be issued yet.');
    return null;
  }
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.notifications.registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android', Device.modelName ?? undefined, Constants.expoConfig?.version ?? undefined);
    return token;
  } catch (e) {
    console.warn('[adey] push registration failed', e);
    return null;
  }
}

/** Navigate to the record a notification points at (data.route from the backend). */
export function routeForNotification(data: Record<string, unknown> | undefined) {
  const route = typeof data?.route === 'string' ? data.route : null;
  if (!route) return null;
  return route;
}

/** Hook: registers token when signed in and wires tap-to-navigate + live badge refresh. */
export function usePushNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const registered = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (registered.current !== user.id) {
      registered.current = user.id;
      registerForPushNotificationsAsync();
    }
    const received = Notifications.addNotificationReceivedListener(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    });
    const responded = Notifications.addNotificationResponseReceivedListener((resp) => {
      const route = routeForNotification(resp.notification.request.content.data as Record<string, unknown>);
      if (route) router.push(route as never);
    });
    // Cold start from a notification tap
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      const route = resp ? routeForNotification(resp.notification.request.content.data as Record<string, unknown>) : null;
      if (route) setTimeout(() => router.push(route as never), 300);
    });
    return () => {
      received.remove();
      responded.remove();
    };
  }, [user, qc]);
}
