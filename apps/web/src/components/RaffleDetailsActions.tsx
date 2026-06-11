'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { rafflePurchaseTickets } from '@/generated/clients';
import {
  getAuthUserId,
  hasAuthSession,
  subscribeAuthSession,
} from '@/lib/auth-session';
import { callApiWithAuthRetry, getApiErrorMessage } from '@/lib/generated-api';

type RaffleStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'SOLD_OUT'
  | 'EXPIRED'
  | 'DISBANDED'
  | 'COMPLETED';

type PurchaseResponse = {
  quantity: number;
  totalAmount: number;
};

type RaffleDetailsActionsProps = {
  raffleId: string;
  raffleTitle: string;
  raffleStatus: RaffleStatus;
  availableTickets: number;
  ticketPrice: number;
};

function isPurchaseResponse(payload: unknown): payload is PurchaseResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.quantity === 'number' && typeof record.totalAmount === 'number';
}

function formatCurrencyFromMinorUnits(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount / 100);
}

export default function RaffleDetailsActions({
  raffleId,
  raffleTitle,
  raffleStatus,
  availableTickets,
  ticketPrice,
}: RaffleDetailsActionsProps) {
  const router = useRouter();
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    hasAuthSession,
    () => false,
  );
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const maxPurchasable = useMemo(
    () => Math.max(1, Math.min(100, availableTickets)),
    [availableTickets],
  );

  const canPurchase = raffleStatus === 'ACTIVE' && availableTickets > 0;
  const totalAmount = quantity * ticketPrice;

  function handleOpenDialog() {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDialogOpen(true);
  }

  function handleCloseDialog() {
    if (submitting) {
      return;
    }

    setIsDialogOpen(false);
  }

  async function handlePurchase() {
    setErrorMessage(null);

    const userId = getAuthUserId();

    if (!userId) {
      setErrorMessage('Please sign in again before buying tickets.');
      return;
    }

    if (!canPurchase) {
      setErrorMessage('This raffle is not currently accepting ticket purchases.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxPurchasable) {
      setErrorMessage(`Quantity must be between 1 and ${String(maxPurchasable)}.`);
      return;
    }

    setSubmitting(true);

    try {
      const payload = await callApiWithAuthRetry((config) =>
        rafflePurchaseTickets(
          raffleId,
          {
            buyerId: userId,
            quantity,
          },
          config,
        ),
      );

      if (!isPurchaseResponse(payload)) {
        setErrorMessage('Purchase succeeded but response format was invalid.');
        return;
      }

      setSuccessMessage(
        `Purchased ${String(payload.quantity)} ticket(s) for ${formatCurrencyFromMinorUnits(payload.totalAmount)}.`,
      );
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(error, 'Network error while purchasing tickets. Please try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return (
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Button variant="contained" size="large" disabled={!canPurchase} onClick={handleOpenDialog}>
            Buy tickets
          </Button>
          <Button href="/marketplace" variant="outlined" size="large">
            Browse more raffles
          </Button>
          <Button href="/raffles/create" variant="outlined" size="large">
            Create raffle
          </Button>
        </Stack>

        <Dialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          aria-labelledby="purchase-dialog-title"
        >
          <DialogTitle id="purchase-dialog-title">Buy tickets</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.5} sx={{ pt: 0.5 }}>
              <Stack spacing={0.75}>
                <Typography variant="body2" color="text.secondary">
                  Title
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {raffleTitle}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Price per ticket
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formatCurrencyFromMinorUnits(ticketPrice)}
                </Typography>
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  Tickets available
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {String(availableTickets)}
                </Typography>
              </Stack>
              <TextField
                label="Number of tickets"
                type="number"
                size="small"
                value={quantity}
                onChange={(event) => {
                  const nextValue = Number.parseInt(event.target.value, 10);
                  setQuantity(Number.isNaN(nextValue) ? 1 : nextValue);
                }}
                slotProps={{ htmlInput: { min: 1, max: maxPurchasable, step: 1 } }}
                helperText={`Enter 1-${String(maxPurchasable)} ticket(s).`}
                disabled={submitting}
              />
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Total to be charged
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatCurrencyFromMinorUnits(totalAmount)}
                </Typography>
              </Stack>
              {errorMessage && !isDialogOpen ? <Alert severity="error">{errorMessage}</Alert> : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handlePurchase}
              disabled={!canPurchase || submitting}
            >
              {submitting ? 'Submitting...' : 'Submit purchase'}
            </Button>
          </DialogActions>
        </Dialog>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
        {!canPurchase ? (
          <Typography variant="body2" color="text.secondary">
            Purchases are enabled only while a raffle is in <strong>Active</strong> status.
          </Typography>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
      <Button href="/register" variant="contained" size="large">
        Create account to participate
      </Button>
      <Button href="/marketplace" variant="outlined" size="large">
        Browse more raffles
      </Button>
    </Stack>
  );
}
