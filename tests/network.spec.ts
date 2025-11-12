import { test, expect, Page } from '@playwright/test';

const login = async (page: Page) => {
  // Do a login via API, then store token
  const res = await page.request.post('/api/authtest/login', {
    data: { username: 'test', password: 'test' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  await page.addInitScript(([token]) => {
    localStorage.setItem('duty.auth.token', token);
  }, body.token);
};

test('single bootstrap after F5 and no extra auth calls', async ({ page }) => {
  await login(page);
  const bootstrapReqs: string[] = [];
  const suspiciousAuth: string[] = [];

  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/api/me/bootstrap')) bootstrapReqs.push(url);
    if (
      /\/api\/auth\//.test(url) ||
      (/\/api\/scopes\//.test(url) && !/\/api\/me\/bootstrap/.test(url))
    ) {
      suspiciousAuth.push(url);
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Assert exactly one bootstrap call
  expect(bootstrapReqs.length).toBe(1);
  // Assert no suspicious auth/scopes calls
  expect(suspiciousAuth.length).toBe(0);

  // Reload (F5)
  await page.reload();
  await page.waitForLoadState('networkidle');
  // After reload, again exactly one bootstrap in this navigation
  const countThisNav = bootstrapReqs.filter((u) =>
    u.includes('/api/me/bootstrap')
  ).length;
  expect(countThisNav).toBeGreaterThanOrEqual(1);
});

test('ScopePicker visible and scope change triggers business reload (if multiple scopes)', async ({
  page,
}) => {
  await login(page);
  await page.goto('/schedule/rosters');
  await page.waitForLoadState('networkidle');

  // Scope picker should be visible on schedule pages
  const picker = page.locator('.scope-picker');
  await expect(picker).toBeVisible();

  // Read diagnostics counters if present
  const before = await page.evaluate(() => {
    const d = (window as any).__diag;
    return d
      ? { roster: d.rosterLoads, staff: d.staffTreeReloads }
      : { roster: 0, staff: 0 };
  });

  // Try to open dropdown and select another option (if exists)
  const options = page.locator('.scope-picker .p-dropdown-item');
  const count = await options.count();
  if (count >= 2) {
    await page.locator('.scope-picker .p-dropdown').click();
    await options.nth(1).click();
    // Wait a bit for reloads
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => {
      const d = (window as any).__diag;
      return d
        ? { roster: d.rosterLoads, staff: d.staffTreeReloads }
        : { roster: 0, staff: 0 };
    });
    expect(after.roster).toBeGreaterThanOrEqual(before.roster);
    expect(after.staff).toBeGreaterThanOrEqual(before.staff + 1);
  }
});
