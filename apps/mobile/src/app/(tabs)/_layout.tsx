import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/supabase';
import { useCart, useCommerce } from '@/lib/commerce';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (on: IconName, off: IconName) =>
  function TabIcon({ color, size, focused }: { color: unknown; size: number; focused: boolean }) {
    return <Ionicons name={focused ? on : off} size={size} color={color as string} />;
  };
const count = (n: number) => (n > 0 ? (n > 99 ? '99+' : n) : undefined);

/** Home · Explore · Events · Cart (Saved while checkout is off) · Profile. AdConnect and Saved stay routable. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { checkoutEnabled } = useCommerce();
  const cart = useCart();
  const unread = useQuery({ queryKey: ['unread', user?.id], queryFn: () => api.notifications.unread(), enabled: !!user, refetchInterval: 60_000 });
  const badge = (unread.data?.messages ?? 0) + (unread.data?.notifications ?? 0);
  const badgeStyle = { backgroundColor: colors.danger, color: '#fff', fontSize: 10 };

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
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('compass', 'compass-outline') }} />
      <Tabs.Screen name="events" options={{ title: 'Events', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          href: checkoutEnabled ? undefined : null,
          tabBarBadge: count(cart.data?.count ?? 0),
          tabBarBadgeStyle: badgeStyle,
          tabBarAccessibilityLabel: cart.data?.count ? `Cart, ${cart.data.count} items` : 'Cart',
          tabBarIcon: icon('bag', 'bag-outline'),
        }}
      />
      <Tabs.Screen name="saved" options={{ title: 'Saved', href: checkoutEnabled ? null : undefined, tabBarIcon: icon('heart', 'heart-outline') }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarBadge: count(badge), tabBarBadgeStyle: badgeStyle, tabBarIcon: icon('person', 'person-outline') }}
      />
      <Tabs.Screen name="adconnect" options={{ title: 'AdConnect', href: null }} />
    </Tabs>
  );
}
