import React, { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { AdeyFlower, Button, Text } from '@/components/ui';
import { ONBOARDING_KEY } from '@/lib/constants';

const { width } = Dimensions.get('window');

const SLIDES = [
  { key: 'community', icon: 'storefront-outline' as const, title: 'Discover Habesha Businesses.', body: 'Find restaurants, shops and services near you, and shop products from verified sellers.' },
  { key: 'safe', icon: 'shield-checkmark-outline' as const, title: 'Pay Safely.', body: 'Adey holds your payment and releases it to the seller only after you confirm delivery.' },
  { key: 'rewards', icon: 'gift-outline' as const, title: 'Rewards & Community.', body: 'Earn Adey Rewards points when you shop, and find community events near you.' },
  { key: 'grow', icon: 'trending-up-outline' as const, title: 'Grow Your Business.', body: 'Businesses can sell online and advertise on screens across the community.' },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);

  const finish = async (to: '/(tabs)' | '/(auth)/sign-in') => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace(to);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  const last = index === SLIDES.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <AdeyFlower size={28} />
          <Text variant="label" style={{ letterSpacing: 3, marginLeft: 8 }}>
            ADEY
          </Text>
        </View>
        <Pressable onPress={() => finish('/(tabs)')} hitSlop={10} accessibilityRole="button">
          <Text variant="label" color="muted">
            Skip
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.illus, { backgroundColor: colors.primarySoft }]}>
              <View style={[styles.illusInner, { backgroundColor: colors.primary }]}>
                <Ionicons name={item.icon} size={64} color={brand.gold} />
              </View>
              <View style={styles.flowerTL}>
                <AdeyFlower size={34} petal={brand.gold} center={colors.primary} />
              </View>
              <View style={styles.flowerBR}>
                <AdeyFlower size={22} petal={brand.gold} center={colors.primary} />
              </View>
            </View>
            <Text variant="title" center style={{ marginTop: 36 }}>
              {item.title}
            </Text>
            <Text color="muted" center style={{ marginTop: 12, paddingHorizontal: 12 }}>
              {item.body}
            </Text>
          </View>
        )}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 22 : 8 }]} />
          ))}
        </View>
        {last ? (
          <View style={{ gap: 10 }}>
            <Button title="Get Started" size="lg" fullWidth onPress={() => finish('/(tabs)')} />
            <Button title="Sign In" size="lg" variant="outline" fullWidth onPress={() => finish('/(auth)/sign-in')} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <Button title="Next" size="lg" fullWidth iconRight="arrow-forward" onPress={() => list.current?.scrollToIndex({ index: index + 1, animated: true })} />
            <Button title="Sign In" size="lg" variant="ghost" fullWidth onPress={() => finish('/(auth)/sign-in')} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  brand: { flexDirection: 'row', alignItems: 'center' },
  slide: { paddingHorizontal: 28, paddingTop: 24, alignItems: 'center' },
  illus: { width: 260, height: 260, borderRadius: 130, alignItems: 'center', justifyContent: 'center' },
  illusInner: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  flowerTL: { position: 'absolute', top: 30, left: 26 },
  flowerBR: { position: 'absolute', bottom: 40, right: 34 },
  footer: { paddingHorizontal: 20, gap: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
});
