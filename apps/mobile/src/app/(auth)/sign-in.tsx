import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, signInSchema } from '@adey/shared';
import { api } from '@/lib/supabase';
import { AuthShell } from '@/components/AuthShell';
import { Button, FormInput, Text } from '@/components/ui';

type Form = z.infer<typeof signInSchema>;

export default function SignIn() {
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });
  const [error, setError] = useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.auth.signIn(v.email, v.password);
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } catch (e) {
      const msg = friendlyError(e);
      if (/confirm/i.test(msg)) setNeedsVerify(v.email);
      setError(msg);
    }
  });

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to save businesses, message sellers, and manage your dashboard.">
      <FormInput control={control} name="email" label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" />
      <FormInput control={control} name="password" label="Password" placeholder="Your password" secure autoComplete="current-password" icon="lock-closed-outline" />
      {error && (
        <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>
          {error}
        </Text>
      )}
      {needsVerify && (
        <Button title="Resend verification email" variant="ghost" size="sm" onPress={() => api.auth.resendVerification(needsVerify).then(() => setError('Verification email sent.'))} />
      )}
      <Button title="Sign In" size="lg" fullWidth loading={formState.isSubmitting} onPress={() => onSubmit()} />
      <View style={{ alignItems: 'center', marginTop: 18, gap: 14 }}>
        <Link href="/(auth)/forgot-password" asChild>
          <Text variant="label" color="primary">
            Forgot password?
          </Text>
        </Link>
        <Text color="muted">
          New to Adey?{' '}
          <Link href="/(auth)/sign-up">
            <Text variant="label" color="primary">
              Create an account
            </Text>
          </Link>
        </Text>
      </View>
    </AuthShell>
  );
}
