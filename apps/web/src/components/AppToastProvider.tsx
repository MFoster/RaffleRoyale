'use client';

import { useEffect, ReactNode } from 'react';
import SuccessToast from '@/components/feedback/SuccessToast';
import { useSuccessToast } from '@/components/feedback/useSuccessToast';
import { toastEmitter } from '@/lib/toastEmitter';

/**
 * AppToastProvider - Manages success toasts at the app level
 * 
 * Listens for toast events from anywhere in the app via toastEmitter
 */
export default function AppToastProvider({ children }: { children: ReactNode }) {
  const { state, show, close } = useSuccessToast();

  useEffect(() => {
    // Listen for success toast events from toastEmitter
    const unsubscribe = toastEmitter.on('success', (config) => {
      show(config);
    });

    return unsubscribe;
  }, [show]);

  return (
    <>
      {children}
      <SuccessToast {...state} onClose={close} />
    </>
  );
}
