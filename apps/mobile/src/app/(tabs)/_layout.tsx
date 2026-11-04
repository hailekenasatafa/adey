import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const unread = useQuery({ queryKey: ['unread', user?.id], queryFn: () => api.notifications.unread(), enabled: !!user, refetchInterval: 60_000 });
  const badge = (unread.data?.messages ?? 0) + (unread.data?.notifications ?? 0);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, height: Platform.OS === 'ios' ? 84 : 66, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color as string} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color as string} /> }} />
      <Tabs.Screen name="adconnect" options={{ title: 'AdConnect', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'tv' : 'tv-outline'} size={size} color={color as string} /> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color as string} /> }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarBadge: badge > 0 ? (badge > 99 ? '99+' : badge) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#fff', fontSize: 10 },
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color as string} />,
        }}
      />
    </Tabs>
  );
}
