import { test, expect } from '@playwright/test';

test('proposal reconciles charts after filters, supports keyboard tabs and empty/mobile layouts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/previews/dashboard-proposal.html');
  await expect(page.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('#order-count')).toHaveText('84');
  await expect(page.locator('#unfinished-count')).toHaveText('14');
  await page.screenshot({ path: 'test-results/dashboard-proposal-desktop.png', fullPage: true });
  await page.getByLabel('Phạm vi đơn vị').selectOption('P1');
  await expect(page.locator('#order-count')).toHaveText('34');
  await expect(page.locator('#unfinished-count')).toHaveText('7');
  await page.getByLabel('Kỳ báo cáo').selectOption('08');
  await expect(page.locator('#order-count')).toHaveText('30');
  expect(await page.locator('#order-data td:nth-child(2)').allTextContents()).toEqual(['2', '3', '16', '8', '1']);
  // Monthly reporting changes the paper cohort, while today's duty remains today.
  await expect(page.locator('#today-count')).toHaveText('6');
  await page.getByRole('tab', { name: 'Hôm nay · 26/09' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Sắp tới · 7 ngày' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'upcoming-tab');
  await page.getByLabel('Phạm vi đơn vị').selectOption('H04');
  await page.getByLabel('Kỳ báo cáo').selectOption('09');
  await page.getByRole('tab', { name: 'Hôm nay · 26/09' }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByLabel('Phạm vi đơn vị')).toBeVisible();
    await page.screenshot({ path: `test-results/dashboard-proposal-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: 'Xem trạng thái chưa có dữ liệu' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa có dữ liệu trong phạm vi này' })).toBeVisible();
  await expect(page.locator('#charts')).toBeHidden();
  await expect(page.locator('#order-count')).toHaveText('0');
  await page.screenshot({ path: 'test-results/dashboard-proposal-empty.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('real Angular forms load local Google Sans including Vietnamese glyphs', async ({ page }) => {
  const fontResponses: { url: string; status: number }[] = [];
  const externalFontRequests: string[] = [];
  page.on('response', response => {
    if (/\.woff2(?:\?|$)/.test(response.url())) fontResponses.push({ url: response.url(), status: response.status() });
  });
  page.on('request', request => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) externalFontRequests.push(request.url());
  });
  await page.route('**/auth/me', route => route.fulfill({ json: { username: 'admin', permissions: ['system.config'], roles: ['admin'] } }));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/me/bootstrap') return route.fulfill({ json: { user: { username: 'admin' }, permissions: ['system.config'], roles: ['admin'], scopesByFeature: {} } });
    if (path === '/api/directory') return route.fulfill({ json: { mode: 'Local', organizations: [], positions: [], ranks: [], personnel: [], total: 0, page: 1 } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/directory');
  await expect(page.getByRole('heading', { name: 'Tổ chức và cán bộ' })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
  const nameInput = page.getByLabel(/^Tên\s*\*/);
  await nameInput.fill('Cục H04 · Nguyễn Văn Đặng · Giấy đi đường');
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      body: getComputedStyle(document.body).fontFamily,
      loaded: Array.from(document.fonts).filter(face => face.family.replaceAll('"', '') === 'Google Sans' && face.status === 'loaded').length,
      vietnamese: document.fonts.check('400 14px "Google Sans"', 'Cục H04 · Nguyễn Văn Đặng · Giấy đi đường'),
    };
  });
  expect(fonts.body).toMatch(/^"?Google Sans/);
  expect(fonts.loaded).toBeGreaterThan(0);
  expect(fonts.vietnamese).toBe(true);
  expect(await nameInput.evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/^"?Google Sans/);
  expect(fontResponses.length).toBeGreaterThanOrEqual(2);
  expect(fontResponses.every(response => response.status === 200 && response.url.startsWith('http://127.0.0.1:4219/'))).toBe(true);
  expect(externalFontRequests).toEqual([]);
  await page.screenshot({ path: 'test-results/google-sans-app.png', fullPage: true });
});
