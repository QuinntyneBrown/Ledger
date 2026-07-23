import { expect, test } from '@playwright/test';

const email = process.env['LEDGER_E2E_EMAIL'];
const password = process.env['LEDGER_E2E_PASSWORD'];

test('configured member can sign in through the deployed application', async ({ page }) => {
  test.skip(!email || !password, 'Set LEDGER_E2E_EMAIL and LEDGER_E2E_PASSWORD to run this live check.');

  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);

  const signInResponse = page.waitForResponse(
    response =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/v1/auth/sign-in'),
  );
  await page.getByRole('button', { name: 'Sign in' }).click();

  expect((await signInResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/(dashboard|welcome)$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
