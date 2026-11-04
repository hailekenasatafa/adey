import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { friendlyError, resetPasswordSchema } from '@adey/shared';
import { api, WEB_URL } from '@/lib/supabase';
import { AuthShell } from '@/components/AuthShell';
import { Button, FormInput, Text } from '@/components/ui';

type Form = z.infer<typeof resetPasswordSchema>;

export default function ForgotPassword() {
  const { control, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { email: '' } });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.auth.resetPassword(v.email, `${WEB_URL}/auth/reset`);
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    }
  });

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a secure link to choose a new password.">
      {sent ? (
        <Text color="success">Check your inbox — if an account exists for that email, a reset link is on its way.</Text>
      ) : (
        <>
          <FormInput control={control} name="email" label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline" />
          {error && (
            <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>
              {error}
            </Text>
          )}
          <Button title="Send reset link" size="lg" fullWidth loading={formState.isSubmitting} onPress={() => onSubmit()} />
        </>
      )}
    </AuthShell>
  );
}
