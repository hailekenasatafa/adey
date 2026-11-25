import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { friendlyError, inquirySchema, type InquiryInput } from '@adey/shared';
import { api } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { track } from '@/lib/analytics';
import { Button, Card, Chip, FormInput, Header, Screen, Text } from '@/components/ui';

export default function InquiryScreen() {
  const { businessId, type, productId, serviceId, screen: screenId } = useLocalSearchParams<{ businessId: string; type?: 'contact' | 'quote' | 'advertising'; productId?: string; serviceId?: string; screen?: string }>();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const biz = useQuery({ queryKey: ['business', businessId], queryFn: () => api.market.business(businessId!) });
  const product = useQuery({ queryKey: ['product', productId], queryFn: () => api.market.product(productId!), enabled: !!productId });
  const screen = useQuery({ queryKey: ['screen', screenId], queryFn: () => api.adconnect.screen(screenId!), enabled: !!screenId });
  const [error, setError] = useState<string | null>(null);

  const { control, handleSubmit, setValue, watch, getValues, formState } = useForm<InquiryInput>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { type: type ?? 'contact', subject: productId ? `About: ${product.data?.name ?? 'a product'}` : '', message: '', contact_phone: profile?.phone ?? '', product_id: productId ?? null, service_id: serviceId ?? null },
  });
  const kind = watch('type');
  // Name the screen in the subject so the owner knows which one you mean.
  useEffect(() => { if (screen.data && !getValues('subject')) setValue('subject', `Advertising on your screen: ${screen.data.title}`.slice(0, 200)); }, [screen.data, getValues, setValue]);

  const send = useMutation({
    mutationFn: (v: InquiryInput) =>
      api.market.createInquiry({
        business_id: businessId!, from_user_id: user!.id, type: v.type, subject: v.subject || null, message: v.message, contact_phone: v.contact_phone || null, product_id: v.product_id ?? null, service_id: v.service_id ?? null,
      }),
    onSuccess: (inq) => {
      track('contact_click', { businessId, meta: { type: kind } });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      // The backend opened a conversation for this inquiry; take the user straight into it.
      if (inq.conversation_id) router.replace(`/messages/${inq.conversation_id}`);
      else router.back();
    },
    onError: (e) => setError(friendlyError(e)),
  });

  if (!user) {
    router.replace('/(auth)/sign-in');
    return null;
  }

  return (
    <Screen header={<Header title={kind === 'quote' ? 'Request a quote' : kind === 'advertising' ? 'Contact screen owner' : 'Contact business'} subtitle={biz.data?.name} />} keyboard>
      {kind === 'advertising' ? (
        <Text variant="caption" color="muted" style={{ marginBottom: 16 }}>Say when you want to run your ad, for how long, your budget, and whether it’s a video or an image. You and the owner agree the details and payment directly; Adey Connect isn’t part of the agreement and takes no commission.</Text>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Chip label="Message" icon="chatbubble-ellipses-outline" selected={kind === 'contact'} onPress={() => setValue('type', 'contact')} />
          <Chip label="Request quote" icon="document-text-outline" selected={kind === 'quote'} onPress={() => setValue('type', 'quote')} />
        </View>
      )}
      {product.data && (
        <Card style={{ marginBottom: 14 }}>
          <Text variant="caption" color="muted">About product</Text>
          <Text variant="bodyStrong">{product.data.name}</Text>
        </Card>
      )}
      <FormInput control={control} name="subject" label="Subject (optional)" placeholder={kind === 'quote' ? 'e.g. Catering for 40 guests' : 'What is this about?'} />
      <FormInput control={control} name="message" label={kind === 'quote' ? 'What do you need a quote for?' : 'Your message'} placeholder={kind === 'quote' ? 'Describe quantities, dates, delivery, and anything else that affects the price.' : 'Write your message…'} multiline />
      <FormInput control={control} name="contact_phone" label="Phone (optional)" placeholder="So the business can call you back" keyboardType="phone-pad" icon="call-outline" />
      {error && <Text color="danger" variant="caption" style={{ marginBottom: 12 }}>{error}</Text>}
      <Button title={kind === 'quote' ? 'Send quote request' : 'Send message'} size="lg" fullWidth loading={send.isPending || formState.isSubmitting} onPress={() => handleSubmit((v) => send.mutate(v))()} />
      <Text variant="caption" color="muted" center style={{ marginTop: 12 }}>
        Your message starts a conversation in Messages. The business is notified immediately.
      </Text>
    </Screen>
  );
}
