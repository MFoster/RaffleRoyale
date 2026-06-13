'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const JUST_SIGNED_UP_STORAGE_KEY = 'raffle-royale.just-signed-up';

function shouldOpenOnboarding(pathname: string): boolean {
  return pathname !== '/register';
}

/**
 * useOnboardingState - Manages onboarding modal visibility
 *
 * Features:
 * - Tracks whether user just signed up
 * - Prevents modal from showing multiple times
 * - Auto-dismisses after navigation
 * - Works with browser session/localStorage
 */
export function useOnboardingState() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (hasShownRef.current || !shouldOpenOnboarding(pathname)) {
      return;
    }

    const justSignedUp = sessionStorage.getItem(JUST_SIGNED_UP_STORAGE_KEY);
    if (justSignedUp !== 'true') {
      return;
    }

    sessionStorage.removeItem(JUST_SIGNED_UP_STORAGE_KEY);
    const showTimer = window.setTimeout(() => {
      hasShownRef.current = true;
      setShowModal(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [pathname]);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleBrowseRaffles = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleCreateRaffle = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    showModal,
    onClose: handleClose,
    onBrowseRaffles: handleBrowseRaffles,
    onCreateRaffle: handleCreateRaffle,
  };
}

/**
 * Marks user as just signed up, which will trigger onboarding modal on next page load
 * Call this after successful signup/login in RegisterForm
 */
export function markUserJustSignedUp(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(JUST_SIGNED_UP_STORAGE_KEY, 'true');
  }
}
