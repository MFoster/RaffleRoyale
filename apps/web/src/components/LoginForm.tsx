'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AppLink from '@/components/AppLink';
import { setAuthSession } from '@/lib/auth-session';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
};

function isLoginResponse(payload: unknown): payload is LoginResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return false;
  }

  const record = payload as Record<string, unknown>;

  return (
    typeof record.accessToken === 'string' &&
    typeof record.refreshToken === 'string' &&
    typeof record.tokenType === 'string' &&
    typeof record.accessTokenExpiresIn === 'string' &&
    typeof record.refreshTokenExpiresIn === 'string'
  );
}

function parseApiErrorMessage(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'Unable to sign in right now.';
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }

  return 'Unable to sign in right now.';
}

export default function LoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email');
    const password = formData.get('password');
    const keepSignedIn = formData.get('keepSignedIn') === 'on';

    if (typeof email !== 'string' || typeof password !== 'string') {
      setErrorMessage('Email and password are required.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(parseApiErrorMessage(payload));
        return;
      }

      if (!isLoginResponse(payload)) {
        setErrorMessage('Login succeeded but response format was invalid.');
        return;
      }

      setAuthSession(payload, keepSignedIn);
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('Network error while signing in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={3} onSubmit={handleSubmit}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        fullWidth
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        fullWidth
        required
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Checkbox
            defaultChecked
            name="keepSignedIn"
            slotProps={{ input: { id: 'keep-signed-in' } }}
          />
          <Typography component="label" htmlFor="keep-signed-in">
            Keep me signed in
          </Typography>
        </Stack>
        <Typography color="primary" sx={{ fontWeight: 700 }}>
          <AppLink href="/register">Need an account?</AppLink>
        </Typography>
      </Stack>
      <Button type="submit" size="large" variant="contained" disabled={submitting}>
        {submitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </Stack>
  );
}
