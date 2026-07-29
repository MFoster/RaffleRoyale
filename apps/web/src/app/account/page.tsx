import type { Metadata } from 'next';
import Box from '@mui/material/Box';
import SiteHeader from '@/components/SiteHeader';
import PageContainer from '@/components/layout/PageContainer';
import AccountDashboard from '@/components/account/AccountDashboard';
import { royaleTokens } from '@/design-system';

export const metadata: Metadata = {
  title: 'My account | Raffle Royale',
};

export default function AccountPage() {
  return (
    <Box sx={{ pb: { xs: 6, md: 10 }, background: royaleTokens.surface.heroGradient }}>
      <SiteHeader />
      <PageContainer sx={{ pt: { xs: 4, md: 6 } }}>
        <AccountDashboard />
      </PageContainer>
    </Box>
  );
}
