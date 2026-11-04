import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { Text } from './Text';

export type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  secure?: boolean;
  rightSlot?: React.ReactNode;
  containerStyle?: object;
};

export function Input({ label, error, hint, icon, secure, rightSlot, containerStyle, style, multiline, ...rest }: InputProps) {
  const { colors, radius } = useTheme();
  const [hidden, setHidden] = useState(!!secure);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label && (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor: error ? colors.danger : focused ? colors.primary : colors.border, borderRadius: radius.md, minHeight: multiline ? 108 : 50, alignItems: multiline ? 'flex-start' : 'center' },
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={{ marginRight: 8, marginTop: multiline ? 14 : 0 }} />}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={hidden}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[styles.input, { color: colors.text, paddingTop: multiline ? 12 : 0 }, style]}
          {...rest}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {rightSlot}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="muted" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** React Hook Form bound input. */
export function FormInput<T extends FieldValues>({ control, name, transform, ...props }: InputProps & { control: Control<T>; name: FieldPath<T>; transform?: { in: (v: unknown) => string; out: (s: string) => unknown } }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <Input
          value={transform ? transform.in(value) : value == null ? '' : String(value)}
          onChangeText={(s) => onChange(transform ? transform.out(s) : s)}
          onBlur={onBlur}
          error={error?.message}
          {...props}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { marginBottom: 6 },
  field: { flexDirection: 'row', borderWidth: 1.5, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  helper: { marginTop: 6 },
});
