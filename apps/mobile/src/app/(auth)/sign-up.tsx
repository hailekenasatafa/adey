import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, LEGAL_PAGES_PUBLISHED, signUpSchema } from '@adey/shared';
import { api, WEB_URL } from '@/lib/supabase';
import { AuthShell } from '@/components/AuthShell';
import { Button, FormInput, Text } from '@/components/ui';

type Form = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(signUpSchema), defaultValues: { displayName: '', email: '', password: '', confirmPassword: '' } });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const res = await api.auth.signUp(v.email, v.password, v.displayName, `${WEB_URL}/auth/callback`);
      if (res.session) router.replace('/(tabs)');
      else router.replace({ pathname: '/(auth)/verify-email', params: { email: v.email } });
    } catch (e) {
      setError(friendlyError(e));
    }
  });

  return (
    <AuthShell title="Create your account" subtitle="One account for everything: shopping, your business, advertising, and your screens.">
      <FormInput control={control} name="displayName" label="Your name" placeholder="e.g. Selam Tesfaye" autoCapitalize="words" autoComplete="name" icon="person-outline" />
      <FormInput control={control} name="email" label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" />
      <FormInput control={control} name="password" label="Password" placeholder="At least 8 characters" secure autoComplete="new-password" icon="lock-closed-outline" />
      <FormInput control={control} name="confirmPassword" label="Confirm password" placeholder="Repeat your password" secure autoComplete="new-password" icon="lock-closed-outline" />
      {error && (
        <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>
          {error}
        </Text>
      )}
      <Button title="Create Account" size="lg" fullWidth loading={formState.isSubmitting} onPress={() => onSubmit()} />
      {LEGAL_PAGES_PUBLISHED && (
        <Text variant="caption" color="muted" center style={{ marginTop: 14 }}>
          By continuing you agree to Adey Connect's Terms of Service and Privacy Policy.
        </Text>
      )}
      <View style={{ alignItems: 'center', marginTop: 18 }}>
        <Text color="muted">
          Already have an account?{' '}
          <Link href="/(auth)/sign-in">
            <Text variant="label" color="primary">
              Sign in
            </Text>
          </Link>
        </Text>
      </View>
    </AuthShell>
  );
}
