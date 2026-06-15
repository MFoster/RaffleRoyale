import { expect, test } from '@playwright/test';

test('signup flow shows onboarding and routes to create raffle', async ({ page }) => {
  await page.goto('/login');

  await page.goto('/register');
  await page.waitForTimeout(3000);

  const email = `playwright-${Date.now()}@example.com`;
  const password = 'P@ssw0rd123!';

  await page.route('**/user', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'header.payload.signature',
        refreshToken: 'header.payload.signature',
        tokenType: 'Bearer',
        accessTokenExpiresIn: '3600',
        refreshTokenExpiresIn: '7200',
      }),
    });
  });

  await page.getByLabel('Email address').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole('checkbox', { name: /I agree to the raffle platform terms/i }).check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL('/');

  const onboardingDialog = page.getByRole('dialog');
  await expect(onboardingDialog).toBeVisible();
  await expect(
    onboardingDialog.getByRole('heading', { name: 'Welcome to Raffle Royale!' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Create a Raffle' }).click();

  await expect(page).toHaveURL('/raffles/create');
  await expect(page.getByRole('heading', { name: 'Create a raffle' })).toBeVisible();
});