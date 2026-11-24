import { CampaignsGate } from '@/components/CampaignsGate';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CampaignsGate>{children}</CampaignsGate>;
}
