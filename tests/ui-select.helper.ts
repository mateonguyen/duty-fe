import { Page, expect } from '@playwright/test';

export async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option').filter({ hasText: option }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}
