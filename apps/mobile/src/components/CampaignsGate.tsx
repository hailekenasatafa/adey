import React from 'react';
import { router } from 'expo-router';
import { useAdconnect } from '@/lib/settings';
import { EmptyState, Header, Loading, Screen } from '@/components/ui';

/**
 * Shows the AdConnect campaign / request / booking screens only while Adey has them switched on
 * (platform setting adconnect.campaigns_enabled). The screens and their data are kept, just not offered.
 */
export function CampaignsGate({ children }: { children: React.ReactNode }) {
  const { campaignsEnabled, loading } = useAdconnect();
  if (loading) return <Screen header={<Header title="AdConnect" />}><Loading /></Screen>;
  if (!campaignsEnabled) {
    return (
      <Screen header={<Header title="AdConnect" />}>
        <EmptyState icon="chatbubble-ellipses-outline" title="Contact screen owners directly"
          body="AdConnect connects advertisers with screen owners. Find a screen, then use Contact screen owner to agree dates, price and payment between yourselves. Adey Connect's campaign and booking tools are switched off."
          action="Browse screens" onAction={() => router.replace('/adconnect/screens')} />
      </Screen>
    );
  }
  return <>{children}</>;
}
