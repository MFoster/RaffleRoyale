'use client';

import { useCallback, useState } from 'react';
import type { SuccessToastProps } from './SuccessToast';

export type SuccessToastConfig = Omit<SuccessToastProps, 'open' | 'onClose'>;

export interface SuccessToastState extends SuccessToastConfig {
  open: boolean;
}

const defaultState: SuccessToastState = {
  open: false,
  title: '',
  message: '',
  duration: 5000,
};

/**
 * useSuccessToast - Hook for managing success toast state
 *
 * Usage:
 * ```
 * const { state, show } = useSuccessToast();
 *
 * // Render the toast
 * <SuccessToast
 *   {...state}
 *   onClose={() => show({ ...state, open: false })}
 * />
 *
 * // Show a toast
 * show({
 *   title: '✅ Success!',
 *   message: 'Your action completed successfully.',
 *   actionLabel: 'View Results',
 *   actionPath: '/results',
 * });
 * ```
 */
export function useSuccessToast() {
  const [state, setState] = useState<SuccessToastState>(defaultState);

  const show = useCallback((config: SuccessToastConfig) => {
    setState((prevState) => ({
      ...prevState,
      ...config,
      open: true,
    }));
  }, []);

  const close = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      open: false,
    }));
  }, []);

  const reset = useCallback(() => {
    setState(defaultState);
  }, []);

  return {
    state,
    show,
    close,
    reset,
  };
}
