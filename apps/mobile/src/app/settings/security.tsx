import React, { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { emailSchema, friendlyError, passwordSchema } from '@adey/shared';
import { api, WEB_URL } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button, Card, EmptyState, Header, Input, Screen, Text } from '@/components/ui';

export default function Security() {
  const { user, signOut } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);
  const [email, setEmail] = useState('');
  const [emErr, setEmErr] = useState<string | null>(null);
  const [emOk, setEmOk] = useState(false);

  const changePw = useMutation({
    mutationFn: (p: string) => api.auth.updatePassword(p),
    onSuccess: () => { setPw(''); setPw2(''); setPwErr(null); setPwOk(true); },
    onError: (e) => { setPwOk(false); setPwErr(friendlyError(e)); },
  });
  const changeEmail = useMutation({
    mutationFn: (e: string) => api.account.changeEmail(e, `${WEB_URL}/auth/callback`),
    onSuccess: () => { setEmErr(null); setEmOk(true); },
    onError: (e) => { setEmOk(false); setEmErr(friendlyError(e)); },
  });
  const everywhere = useMutation({
    mutationFn: () => api.account.signOutEverywhere(),
    onSuccess: async () => { await signOut().catch(() => {}); router.replace('/(tabs)'); },
    onError: (e) => Alert.alert('Could not sign out', friendlyError(e)),
  });

  if (!user) return <Screen header={<Header title="Password & security" />}><EmptyState icon="lock-closed-outline" title="Sign in to manage security" action="Sign in" onAction={() => router.push('/(auth)/sign-in')} /></Screen>;

  const submitPw = () => {
    setPwOk(false);
    const r = passwordSchema.safeParse(pw);
    if (!r.success) return setPwErr(r.error.issues[0].message);
    if (pw !== pw2) return setPwErr('The two passwords do not match.');
    setPwErr(null);
    changePw.mutate(pw);
  };
  const submitEmail = () => {
    setEmOk(false);
    const r = emailSchema.safeParse(email);
    if (!r.success) return setEmErr(r.error.issues[0].message);
    if (r.data.toLowerCase() === (user.email ?? '').toLowerCase()) return setEmErr('That is already your email address.');
    setEmErr(null);
    changeEmail.mutate(r.data);
  };

  return (
    <Screen header={<Header title="Password & security" />} keyboard>
      <Text variant="subheading" style={{ marginBottom: 8 }}>Change password</Text>
      <Card>
        <Input label="New password" secure value={pw} onChangeText={setPw} autoCapitalize="none" textContentType="newPassword" hint="At least 8 characters." />
        <Input label="Confirm new password" secure value={pw2} onChangeText={setPw2} autoCapitalize="none" textContentType="newPassword" error={pwErr ?? undefined} />
        {pwOk && <Text color="success" variant="caption" style={{ marginBottom: 10 }} accessibilityLiveRegion="polite">Password updated.</Text>}
        <Button title="Update password" loading={changePw.isPending} onPress={submitPw} />
      </Card>

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 8 }}>Change email</Text>
      <Card>
        <Text color="muted" style={{ marginBottom: 10 }}>Current email: {user.email}. We send a confirmation link to the new address, and your email changes once you open it.</Text>
        <Input label="New email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false} textContentType="emailAddress" error={emErr ?? undefined} />
        {emOk && <Text color="success" variant="caption" style={{ marginBottom: 10 }} accessibilityLiveRegion="polite">Check your inbox: we sent a confirmation email. Open the link in it to finish the change.</Text>}
        <Button title="Send confirmation email" variant="secondary" loading={changeEmail.isPending} onPress={submitEmail} />
      </Card>

      <Text variant="subheading" style={{ marginTop: 24, marginBottom: 8 }}>Devices</Text>
      <Card>
        <Text color="muted">Signed in somewhere you no longer use? Sign out of every phone and browser, including this one.</Text>
        <Button title="Sign out on all devices" variant="outline" icon="log-out-outline" style={{ marginTop: 10 }} loading={everywhere.isPending} onPress={() => Alert.alert('Sign out everywhere?', 'You will need to sign in again on every device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => everywhere.mutate() }])} />
      </Card>
    </Screen>
  );
}
