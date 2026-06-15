import { expect, test } from '@playwright/test';

function formatLocalDateTime(value: Date): string {
  const pad = (input: number) => String(input).padStart(2, '0');

  return [
    value.getFullYear(),
    pad(value.getMonth() + 1),
    pad(value.getDate()),
  ].join('-') + `T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

test('authenticated user can create a raffle', async ({ page }) => {
  await page.context().addInitScript(() => {
    const authSession = {
      accessToken: 'header.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature',
      refreshToken: 'header.payload.signature',
      tokenType: 'Bearer',
      accessTokenExpiresIn: '3600',
      refreshTokenExpiresIn: '7200',
    };

    localStorage.setItem('raffle-royale.auth.local', JSON.stringify(authSession));
  });

  let submittedPayload: Record<string, unknown> | null = null;

  await page.route('**/raffle', async (route) => {
    submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: '123e4567-e89b-12d3-a456-426614174000' }),
    });
  });

  await page.goto('/raffles/create');

  await expect(page.getByRole('heading', { name: 'Create a raffle' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create raffle' })).toBeVisible();

  await page.getByLabel('Raffle title').fill('Playwright Premium Drop');
  await page.getByLabel('Description').fill('A focused smoke test raffle.');
  await page.getByLabel('Total tickets').fill('100');
  await page.getByLabel('Ticket price (USD)').fill('25');
  await page.getByLabel('End time').fill(formatLocalDateTime(new Date(Date.now() + 86400000)));
  await page.getByRole('button', { name: 'Create raffle' }).click();

  await expect(page).toHaveURL('/raffles/123e4567-e89b-12d3-a456-426614174000');
  expect(submittedPayload).not.toBeNull();
  expect(submittedPayload?.title).toBe('Playwright Premium Drop');
  expect(submittedPayload?.rafflerId).toBe('user-123');
});
