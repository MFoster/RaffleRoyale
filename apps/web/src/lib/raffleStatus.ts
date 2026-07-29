export type RaffleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SOLD_OUT'
  | 'PENDING_DRAW'
  | 'EXPIRED'
  | 'DISBANDED'
  | 'COMPLETED';

export const RAFFLE_STATUS_VALUES: RaffleStatus[] = [
  'DRAFT',
  'ACTIVE',
  'SOLD_OUT',
  'PENDING_DRAW',
  'EXPIRED',
  'DISBANDED',
  'COMPLETED',
];

const CURRENT_RAFFLE_STATUSES = new Set<RaffleStatus>(['ACTIVE', 'SOLD_OUT']);

export function parseRaffleStatus(value: unknown): RaffleStatus | null {
  return typeof value === 'string' &&
    (RAFFLE_STATUS_VALUES as string[]).includes(value)
    ? (value as RaffleStatus)
    : null;
}

/** Live raffles a user can still buy into or that just sold out. */
export function isCurrentRaffleStatus(status: RaffleStatus): boolean {
  return CURRENT_RAFFLE_STATUSES.has(status);
}

export const RAFFLE_STATUS_LABELS: Record<RaffleStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SOLD_OUT: 'Sold out',
  PENDING_DRAW: 'Drawing winner',
  EXPIRED: 'Expired',
  DISBANDED: 'Disbanded',
  COMPLETED: 'Completed',
};

export function getInitials(name: string | null | undefined): string {
  if (!name) {
    return 'RR';
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'RR';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
