import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { LOCATION_PRESETS, useLocation } from '@/lib/location';
import { Button, Header, Screen, Text } from '@/components/ui';

export default function LocationPicker() {
  const { colors, radius } = useTheme();
  const { location, useDeviceLocation, setManual, permission } = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen header={<Header title="Your location" />}>
      <Text color="muted" style={{ marginBottom: 16 }}>
        Adey shows businesses and advertising screens near this location. It's only used to sort and filter results.
      </Text>
      <Button
        title={permission === 'denied' ? 'Location permission denied — open Settings' : 'Use my current location'}
        icon="navigate"
        loading={busy}
        fullWidth
        disabled={permission === 'denied'}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const ok = await useDeviceLocation();
            if (ok) router.back();
            else setError('Location permission was not granted. Pick a city below instead.');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {error && (
        <Text color="danger" variant="caption" style={{ marginTop: 8 }}>
          {error}
        </Text>
      )}
      <Text variant="overline" color="muted" style={{ marginTop: 28, marginBottom: 8 }}>
        Choose a community
      </Text>
      <View style={{ gap: 8 }}>
        {LOCATION_PRESETS.map((p) => {
          const selected = location.label === p.label;
          return (
            <Pressable
              key={p.label}
              onPress={() => {
                setManual(p);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border, borderRadius: radius.md }]}
            >
              <Ionicons name="location-outline" size={18} color={selected ? colors.primary : colors.textMuted} />
              <Text style={{ marginLeft: 10, flex: 1 }}>{p.label}</Text>
              {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1.5 } });
