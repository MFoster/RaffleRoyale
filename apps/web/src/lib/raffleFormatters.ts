'use client';

/**
 * Format time until end of raffle
 * Returns: "45m", "3h", "2d" format
 */
export function formatTimeUntilEnd(endTime: Date | string): string {
  const endDate = typeof endTime === 'string' ? new Date(endTime) : endTime;
  const now = new Date();
  const diffMs = endDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return 'Ended';
  }

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  return `${diffDays}d`;
}

/**
 * Format ticket price as currency
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Get days since date
 */
export function daysSince(date: Date | string): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.floor((now.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Get hours until date
 */
export function hoursUntil(date: Date | string): number {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  return Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60));
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}
