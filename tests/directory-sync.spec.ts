import { test, expect } from '@playwright/test';

test('admin configures scoped sync, enqueues a job and sees its result', async ({ page }) => {
  const settings = { rootSourceOrgId: '', rootOrgCode: '', enabled: false, intervalMinutes: 15, maxRemovalPercent: 20, lastSuccessAt: null as string | null };
  const runs: any[] = [];
  await page.route('**/auth/me', route => route.fulfill({ json: { username: 'admin', fullName: 'Quản trị', permissions: ['system.config'], roles: ['admin'] } }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/directory-sync/settings') {
      expect(route.request().headers()['x-duty-admin']).toBe('1');
      Object.assign(settings, route.request().postDataJSON());
      return route.fulfill({ json: settings });
    }
    if (url.pathname === '/api/directory-sync/run') {
      expect(route.request().headers()['x-duty-admin']).toBe('1');
      settings.lastSuccessAt = '2026-09-26T04:00:00Z'; settings.rootOrgCode = 'H04';
      runs.push({ id: 1, status: 'Succeeded', requestedBy: 'admin', requestedAt: settings.lastSuccessAt,
        organizationCount: 2, personnelCount: 1, message: 'Đồng bộ thành công.' });
      return route.fulfill({ status: 202, json: { runId: 1 } });
    }
    if (url.pathname === '/api/directory-sync')
      return route.fulfill({ json: { settings, runs, organizationCount: runs.length ? 2 : 0, personnelCount: runs.length ? 1 : 0, positionCount: 1, rankCount: 1 } });
    if (url.pathname === '/api/directory-sync/personnel')
      return route.fulfill({ json: { items: runs.length ? [{ username: 'alice', fullName: 'Nguyễn Văn A', unitName: 'Phòng 1', orgCode: 'H04-P1', positionName: 'Cán bộ' }] : [], total: runs.length ? 1 : 0, page: 1 } });
    if (url.pathname === '/api/directory-sync/organizations')
      return route.fulfill({ json: runs.length ? [{ sourceId: 'H04-SOURCE', code: 'H04', name: 'Cục H04', parentSourceId: null }] : [] });
    if (url.pathname === '/api/me/bootstrap')
      return route.fulfill({ json: { user: { username: 'admin', displayName: 'Quản trị' }, permissions: ['system.config'], roles: ['admin'], scopesByFeature: {} } });
    return route.fulfill({ json: [] });
  });
  await page.goto('/admin/directory-sync');
  await expect(page.getByRole('heading', { name: 'Đồng bộ danh mục cán bộ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chạy đồng bộ ngay' })).toBeDisabled();
  await page.getByLabel('ID đơn vị gốc trên VBĐH', { exact: false }).fill('H04-SOURCE');
  await page.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu');
  await page.getByRole('button', { name: 'Chạy đồng bộ ngay' }).click();
  await expect(page.getByText('Đồng bộ thành công.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('ID đơn vị gốc trên VBĐH', { exact: false })).toHaveAttribute('readonly', '');
  await expect(page.getByText('Nguyễn Văn A', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/directory-sync-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Đồng bộ danh mục cán bộ' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/directory-sync-mobile.png', fullPage: true });
});
