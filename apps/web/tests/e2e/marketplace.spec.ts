import { expect, test } from '@playwright/test';

test('marketplace renders the browsing shell', async ({ page }) => {
  await page.goto('/marketplace');

  await expect(
    page.getByRole('heading', {
      name: 'Find the raffles you are looking for.',
    }),
  ).toBeVisible();
});