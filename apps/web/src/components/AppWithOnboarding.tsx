'use client';

import { ReactNode } from 'react';
import { useOnboardingState } from '@/components/auth/useOnboardingState';
import OnboardingModal from '@/components/auth/OnboardingModal';

export default function AppWithOnboarding({ children }: { children: ReactNode }) {
  const { showModal, onClose, onBrowseRaffles, onCreateRaffle } = useOnboardingState();

  return (
    <>
      {children}
      <OnboardingModal
        open={showModal}
        onClose={onClose}
        onBrowseRaffles={onBrowseRaffles}
        onCreateRaffle={onCreateRaffle}
      />
    </>
  );
}
