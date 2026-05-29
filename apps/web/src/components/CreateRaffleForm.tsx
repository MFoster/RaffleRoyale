'use client';

import { FormEvent, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AppLink from '@/components/AppLink';
import { fetchWithAuthRetry } from '@/lib/authenticated-fetch';
import {
  getAuthUserId,
  hasAuthSession,
  subscribeAuthSession,
} from '@/lib/auth-session';

type ItemType = 'PHYSICAL' | 'DIGITAL';
type RaffleStatus = 'DRAFT' | 'ACTIVE';

type CreateRaffleResponse = {
  id: string;
};

type UploadRaffleImagesResponse = {
  imageUrls: string[];
};

const MAX_RAFFLE_IMAGE_UPLOADS = 3;
const MAX_RAFFLE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function parseApiErrorMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'Unable to create raffle right now.';
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }

  return 'Unable to create raffle right now.';
}

function isUploadRaffleImagesResponse(
  payload: unknown,
): payload is UploadRaffleImagesResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  const imageUrls = record.imageUrls;

  return Array.isArray(imageUrls) && imageUrls.every((value) => typeof value === 'string');
}

function isCreateRaffleResponse(payload: unknown): payload is CreateRaffleResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return typeof record.id === 'string';
}

export default function CreateRaffleForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedImageNames, setSelectedImageNames] = useState<string[]>([]);
  const isAuthenticated = useSyncExternalStore(
    subscribeAuthSession,
    hasAuthSession,
    () => false,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const userId = getAuthUserId();

    if (typeof userId !== 'string' || userId.length === 0) {
      setErrorMessage('Could not resolve your account from the current session.');
      return;
    }

    const formData = new FormData(event.currentTarget);

    const title = String(formData.get('title') ?? '').trim();
    const descriptionRaw = String(formData.get('description') ?? '').trim();
    const endTimeRaw = String(formData.get('endTime') ?? '').trim();
    const itemType = String(formData.get('itemType') ?? 'PHYSICAL') as ItemType;
    const status = String(formData.get('status') ?? 'ACTIVE') as RaffleStatus;
    const totalTicketsRaw = String(formData.get('totalTickets') ?? '').trim();
    const ticketPriceRaw = String(formData.get('ticketPrice') ?? '').trim();
    const minSellThroughRaw = String(formData.get('minSellThrough') ?? '').trim();

    const totalTickets = Number.parseInt(totalTicketsRaw, 10);
    const ticketPriceUsd = Number.parseFloat(ticketPriceRaw);

    if (!title) {
      setErrorMessage('Title is required.');
      return;
    }

    if (!endTimeRaw) {
      setErrorMessage('End time is required.');
      return;
    }

    if (!Number.isInteger(totalTickets) || totalTickets < 1) {
      setErrorMessage('Total tickets must be an integer greater than 0.');
      return;
    }

    if (!Number.isFinite(ticketPriceUsd) || ticketPriceUsd <= 0) {
      setErrorMessage('Ticket price must be greater than 0.');
      return;
    }

    const endTimeDate = new Date(endTimeRaw);
    if (Number.isNaN(endTimeDate.getTime())) {
      setErrorMessage('End time must be a valid date/time.');
      return;
    }

    const ticketPrice = Math.round(ticketPriceUsd * 100);
    const minSellThrough =
      minSellThroughRaw.length > 0 ? Number.parseInt(minSellThroughRaw, 10) : undefined;
    const imageFiles = formData
      .getAll('images')
      .filter(
        (entry): entry is File => entry instanceof File && entry.size > 0,
      );

    if (
      minSellThrough !== undefined &&
      (!Number.isInteger(minSellThrough) || minSellThrough < 50 || minSellThrough > 95)
    ) {
      setErrorMessage('Minimum sell-through must be an integer between 50 and 95.');
      return;
    }

    if (imageFiles.length > MAX_RAFFLE_IMAGE_UPLOADS) {
      setErrorMessage('Upload up to 3 images per raffle.');
      return;
    }

    if (imageFiles.some((file) => !file.type.startsWith('image/'))) {
      setErrorMessage('Only image files are supported.');
      return;
    }

    if (imageFiles.some((file) => file.size > MAX_RAFFLE_IMAGE_SIZE_BYTES)) {
      setErrorMessage('Each image must be 5 MB or smaller.');
      return;
    }

    setSubmitting(true);

    try {
      let imageUrls: string[] | undefined;

      if (imageFiles.length > 0) {
        const imageUploadData = new FormData();

        for (const file of imageFiles) {
          imageUploadData.append('images', file);
        }

        const imageUploadResponse = await fetchWithAuthRetry('/api/raffles/images', {
          method: 'POST',
          body: imageUploadData,
        });
        const imageUploadPayload: unknown = await imageUploadResponse.json();

        if (!imageUploadResponse.ok) {
          setErrorMessage(parseApiErrorMessage(imageUploadPayload));
          return;
        }

        if (!isUploadRaffleImagesResponse(imageUploadPayload)) {
          setErrorMessage('Image upload succeeded but response format was invalid.');
          return;
        }

        imageUrls = imageUploadPayload.imageUrls;
      }

      const response = await fetchWithAuthRetry('/api/raffles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rafflerId: userId,
          title,
          description: descriptionRaw.length > 0 ? descriptionRaw : undefined,
          itemType,
          totalTickets,
          ticketPrice,
          minSellThrough,
          imageUrls,
          endTime: endTimeDate.toISOString(),
          status,
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(parseApiErrorMessage(payload));
        return;
      }

      if (!isCreateRaffleResponse(payload)) {
        setErrorMessage('Raffle created but response format was invalid.');
        return;
      }

      router.push(`/raffles/${payload.id}`);
      router.refresh();
    } catch {
      setErrorMessage('Network error while creating raffle. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <Stack spacing={2}>
        <Alert severity="warning">You need to log in before creating a raffle.</Alert>
        <Typography>
          <AppLink href="/login">Go to login</AppLink>
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack component="form" spacing={3} onSubmit={handleSubmit}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <TextField label="Raffle title" name="title" required />
      <TextField
        label="Description"
        name="description"
        multiline
        minRows={3}
        helperText="Optional, but helps buyers understand what they are entering."
      />
      <Stack spacing={1.25}>
        <Button component="label" variant="outlined" sx={{ alignSelf: 'flex-start' }}>
          Upload raffle images (up to 3)
          <input
            hidden
            type="file"
            name="images"
            accept="image/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              setSelectedImageNames(files.map((file) => file.name));
            }}
          />
        </Button>
        <Typography variant="body2" color="text.secondary">
          Optional: JPG, PNG, WEBP, GIF up to 5 MB each.
        </Typography>
        {selectedImageNames.length > 0 ? (
          <Typography variant="body2" color="text.secondary">
            Selected: {selectedImageNames.join(', ')}
          </Typography>
        ) : null}
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField select label="Item type" name="itemType" defaultValue="PHYSICAL">
          <MenuItem value="PHYSICAL">Physical</MenuItem>
          <MenuItem value="DIGITAL">Digital</MenuItem>
        </TextField>
        <TextField select label="Start status" name="status" defaultValue="ACTIVE">
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="DRAFT">Draft</MenuItem>
        </TextField>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Total tickets"
          name="totalTickets"
          type="number"
          required
          slotProps={{ htmlInput: { min: 1, step: 1 } }}
        />
        <TextField
          label="Ticket price (USD)"
          name="ticketPrice"
          type="number"
          required
          slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }}
          helperText="Converted to cents before saving."
        />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField
          label="Minimum sell-through (%)"
          name="minSellThrough"
          type="number"
          slotProps={{ htmlInput: { min: 50, max: 95, step: 1 } }}
          helperText="Optional: 50-95"
        />
        <TextField
          label="End time"
          name="endTime"
          type="datetime-local"
          required
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Stack>
      <Button type="submit" variant="contained" size="large" disabled={submitting}>
        {submitting ? 'Creating raffle...' : 'Create raffle'}
      </Button>
    </Stack>
  );
}
