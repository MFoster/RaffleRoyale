'use client';

import type { SuccessToastConfig } from '@/components/feedback/useSuccessToast';

/**
 * Toast event emitter for triggering toasts from anywhere in the app
 * without prop drilling
 *
 * Usage:
 * ```
 * import { toastEmitter } from '@/lib/toastEmitter';
 *
 * // In any component
 * toastEmitter.emit('success', {
 *   title: '✅ Raffle Created!',
 *   message: 'Your raffle is now live.',
 *   actionLabel: 'View My Raffles',
 *   actionPath: '/dashboard#my-raffles'
 * });
 * ```
 */

class ToastEmitter {
  private listeners: Map<string, Set<(config: SuccessToastConfig) => void>> = new Map();

  on(event: 'success', callback: (config: SuccessToastConfig) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const listeners = this.listeners.get(event)!;
    listeners.add(callback);

    // Return unsubscribe function
    return () => {
      listeners.delete(callback);
    };
  }

  emit(event: 'success', config: SuccessToastConfig): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(config));
    }
  }

  off(event: 'success', callback: (config: SuccessToastConfig) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
}

export const toastEmitter = new ToastEmitter();
