import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/supabase';
import { AuthShell } from '@/components/AuthShell';
import { Button, Text } from '@/components/ui';

export default function VerifyEmail() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [status, setStatus] = useState<string | null>(null);
  return (
    <AuthShell title="Verify your email" subtitle={`We sent a confirmation link to ${email ?? 'your email'}. Open it on this device to finish signing up.`}>
      <Button title="I've verified — Sign in" size="lg" fullWidth onPress={() => router.replace('/(auth)/sign-in')} />
      <Button
        title="Resend email"
        variant="ghost"
        style={{ marginTop: 10 }}
        onPress={() =>
          email
            ? api.auth
                .resendVerification(email)
                .then(() => setStatus('Sent another verification email.'))
                .catch((e) => setStatus(e.message))
            : undefined
        }
      />
      {status && (
        <Text variant="caption" color="muted" center style={{ marginTop: 8 }}>
          {status}
        </Text>
      )}
    </AuthShell>
  );
}
