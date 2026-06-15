import { expect, test } from '@playwright/test';

test('homepage renders the how it works section', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'A straightforward flow from listing to outcome.',
    }),
  ).toBeVisible();
});