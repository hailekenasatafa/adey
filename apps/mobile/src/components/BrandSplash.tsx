import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { brand, brandText } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { AdeyFlower } from './ui/AdeyFlower';
import { Text } from './ui/Text';

/**
 * Branded splash overlay shown for ~1.1s after the native splash hides.
 * It never blocks startup work — data loads underneath it.
 */
export function BrandSplash({ onDone }: { onDone: () => void }) {
  const { scheme } = useTheme();
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.8);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.4)) });
    textOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    opacity.value = withDelay(
      900,
      withSequence(
        withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(onDone)();
        }),
      ),
    );
  }, [onDone, opacity, scale, textOpacity]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const flowerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));
  const bg = scheme === 'dark' ? '#15181A' : brand.forest;

  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: bg }, containerStyle]}>
      <Animated.View style={flowerStyle}>
        <AdeyFlower size={96} petal={brand.gold} center={scheme === 'dark' ? brand.forest : brand.ivory} />
      </Animated.View>
      <Animated.View style={[styles.text, textStyle]}>
        <Text variant="display" style={{ color: brand.ivory, letterSpacing: 6 }}>
          {brandText.name}
        </Text>
        <Text variant="heading" style={{ color: brand.gold, marginTop: 2 }}>
          {brandText.nameAm}
        </Text>
        <View style={{ height: 18 }} />
        <Text variant="caption" style={{ color: brand.ivory, opacity: 0.85, letterSpacing: 0.4 }}>
          "{brandText.tagline}"
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' }, text: { alignItems: 'center', marginTop: 20 } });
