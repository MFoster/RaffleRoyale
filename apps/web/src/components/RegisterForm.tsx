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
    return 'Unable to create your account right now.';
  }

  const record = payload as Record<string, unknown>;
  const message = record.message;

  if (typeof message === 'string') {
    return message;
  }

  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message.join(' ');
  }

  return 'Unable to create your account right now.';
}

export default function RegisterForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const phoneRaw = String(formData.get('phone') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    const agreedToTerms = formData.get('agreeTerms') === 'on';

    if (!email || !password || !confirmPassword) {
      setErrorMessage('Email, password, and confirmation are required.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must agree to the platform terms to continue.');
      return;
    }

    setSubmitting(true);

    try {
      const createResponse = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          phone: phoneRaw.length > 0 ? phoneRaw : undefined,
          password,
        }),
      });

      const createPayload: unknown = await createResponse.json();

      if (!createResponse.ok) {
        setErrorMessage(parseApiErrorMessage(createPayload));
        return;
      }

      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginPayload: unknown = await loginResponse.json();

      if (!loginResponse.ok) {
        setErrorMessage(parseApiErrorMessage(loginPayload));
        return;
      }

      if (!isLoginResponse(loginPayload)) {
        setErrorMessage('Account created but login response format was invalid.');
        return;
      }

      setAuthSession(loginPayload, true);
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('Network error while creating your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
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
        label="Phone number"
        name="phone"
        type="tel"
        autoComplete="tel"
        helperText="Optional at signup, but useful for purchase and fulfillment updates."
        fullWidth
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        fullWidth
        required
      />
      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        fullWidth
        required
      />
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Checkbox name="agreeTerms" slotProps={{ input: { id: 'agree-terms' } }} />
        <Typography component="label" htmlFor="agree-terms" sx={{ pt: 1 }}>
          I agree to the raffle platform terms and understand that identity
          verification may be required for some actions.
        </Typography>
      </Stack>
      <Button type="submit" size="large" variant="contained" disabled={submitting}>
        {submitting ? 'Creating account...' : 'Create account'}
      </Button>

      <Typography color="text.secondary">
        Already have an account?{' '}
        <Typography component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
          <AppLink href="/login">Sign in</AppLink>
        </Typography>
      </Typography>
    </Stack>
  );
}
