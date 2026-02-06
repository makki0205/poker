import { expect, test } from '@playwright/test';

test('can create tournament, join via flow, and stay joined after reload', async ({ page }) => {
  await page.goto('/');

  const joinNameInput = page.getByPlaceholder('your name');
  await joinNameInput.fill('e2e_spectator');

  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('alert')).toContainText('Tournament created: trn_');

  const tournamentIdInput = page.getByPlaceholder('trn_xxx');
  const tournamentId = await tournamentIdInput.inputValue();
  expect(tournamentId.startsWith('trn_')).toBeTruthy();

  await page.getByRole('button', { name: 'Join as Spectator' }).click();
  await expect(page.getByRole('heading', { name: 'Table', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spectator' })).toBeVisible();

  await expect(page).toHaveURL(new RegExp(`tournamentId=${tournamentId}`));
  await expect(page).toHaveURL(/role=spectator/);
  await expect(page).toHaveURL(/name=e2e_spectator/);

  await page.reload();

  await expect(page.getByRole('heading', { name: 'Table', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Spectator' })).toBeVisible();
});
