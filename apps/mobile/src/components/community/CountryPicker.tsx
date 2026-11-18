import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { countriesForPicker, countryName } from '@adey/shared';
import { useTheme } from '@/lib/theme';
import { Input, Text } from '@/components/ui';

/** Field that opens a searchable country list. `value` is an ISO-2 code. */
export function CountryPicker({ value, onChange, label = 'Country', error }: { value: string | null | undefined; onChange: (code: string) => void; label?: string; error?: string }) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? countriesForPicker.filter((c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase() === t) : countriesForPicker;
  }, [query]);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text variant="label" style={{ marginBottom: 6 }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ? countryName(value) : 'not chosen'}. Change`}
        style={{ minHeight: 50, borderWidth: 1.5, borderColor: error ? colors.danger : colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}
      >
        <Text style={{ flex: 1 }} color={value ? 'text' : 'muted'}>{value ? countryName(value) : 'Choose a country'}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {!!error && <Text variant="caption" color="danger" style={{ marginTop: 6 }}>{error}</Text>}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text variant="heading">{label}</Text>
            <Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={24} color={colors.text} /></Pressable>
          </View>
          <Input icon="search" placeholder="Search countries" value={query} onChangeText={setQuery} autoCorrect={false} containerStyle={{ marginBottom: 8 }} />
          <FlatList
            data={list}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            ListEmptyComponent={<Text color="muted" center style={{ marginTop: 24 }}>No country matches that search.</Text>}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => { onChange(item.code); setOpen(false); setQuery(''); }}
                accessibilityRole="button"
                accessibilityState={{ selected: item.code === value }}
                style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1, borderBottomWidth: 1, borderBottomColor: colors.border })}
              >
                <Text style={{ flex: 1 }}>{item.name}</Text>
                {item.code === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}
