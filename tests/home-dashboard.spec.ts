import { test, expect, Page } from '@playwright/test';
import { chooseOption } from './ui-select.helper';

const permissions = ['roster.view', 'roster.create', 'travel.order.view', 'travel.trip.create', 'system.config'];
async function captureDashboard(page: Page, path: string) {
  const viewport = page.viewportSize()!;
  const contentHeight = await page.locator('app-home main').evaluate(el => el.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: contentHeight + 72 });
  await page.screenshot({ path, fullPage: true });
  await page.setViewportSize(viewport);
}
function overview(scopeCode = 'H04', period = '2026-09') {
  const personal = scopeCode === 'mine'; const unit = scopeCode === 'P1';
  const rows = [{ rosterId: 1, date: '2026-09-26', staffName: 'Nguyễn Văn An', unitName: 'Phòng 1', shiftName: 'Ca ngày', timeRange: '07:30–16:30', locationName: 'Trực ban', status: 'Assigned' },
    { rosterId: 1, date: '2026-09-26', staffName: 'Trần Hoàng Long', unitName: 'Phòng 1', shiftName: 'Ca đêm', timeRange: '16:30–07:30', locationName: 'Trụ sở', status: 'PendingSwap' },
    { rosterId: 2, date: '2026-09-26', staffName: 'Lê Phương Thảo', unitName: 'Phòng 2', shiftName: 'Ca ngày', timeRange: '07:30–16:30', locationName: 'Trực ban', status: 'Assigned' }];
  const count = personal ? 1 : unit ? 2 : 3; const papers = period === '2026-08' ? 0 : personal ? 1 : 2;
  return {
    updatedAt: '2026-09-26T05:45:00Z', today: '2026-09-26', timeZone: 'Asia/Ho_Chi_Minh', period, scopeCode,
    scopeName: personal ? 'Công việc của tôi' : unit ? 'Phòng 1' : 'Cục H04', scopes: [{ code: 'H04', name: 'Cục H04' }, { code: 'P1', name: 'Phòng 1' }],
    capabilities: { canCreateRoster: true, canCreateTravel: true, canManageDirectory: true, canManageAccess: true },
    roster: { state: 'ready', todayCount: count, activeRosterCount: personal || unit ? 1 : 3, myShiftCount: 3, myPendingSwapCount: 1,
      chartStart: '2026-09-13', chartEnd: '2026-09-26', dailyCounts: Array.from({ length: 14 }, (_, i) => ({ date: `2026-09-${i + 13}`, count: i === 0 ? 1 : i === 13 ? count : 0 })),
      todayAssignments: rows.slice(0, count), upcomingAssignments: [{ ...rows[0], date: '2026-09-27' }], upcomingCount: 1 },
    travel: { state: 'ready', totalCount: papers, unfinishedCount: papers, statusCounts: [{ code: 'DRAFT', name: 'Nháp', count: papers > 0 ? 1 : 0 }, { code: 'PRINTED', name: 'Đã in', count: papers === 2 ? 1 : 0 }, { code: 'SIGNED', name: 'Đã ký', count: 0 }, { code: 'CLOSED', name: 'Hoàn tất', count: 0 }, { code: 'CANCELLED', name: 'Đã hủy', count: 0 }] },
    directory: { state: 'ready', organizationCount: 3, personnelCount: 24, requiresSetup: false },
  };
}
async function mockSession(page: Page, transform?: (data: any) => any) {
  await page.route('**/auth/me', route => route.fulfill({ json: { username: 'alice', fullName: 'Nguyễn Vũ Toàn', permissions, roles: ['manager'] } }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/me/bootstrap') return route.fulfill({ json: { user: { username: 'alice' }, permissions, roles: ['manager'], scopesByFeature: {} } });
    if (url.pathname === '/api/home/overview') {
      const data = overview(url.searchParams.get('scopeCode') || 'H04', url.searchParams.get('period') || '2026-09');
      return route.fulfill({ json: transform ? transform(data) : data });
    }
    if (url.pathname === '/api/notifications/my') return route.fulfill({ json: { items: [], totalUnread: 0 } });
    if (url.pathname === '/api/directory') return route.fulfill({ json: { mode: 'Local', organizations: [], positions: [], ranks: [], personnel: [], total: 0, page: 1 } });
    return route.fulfill({ json: [] });
  });
}

test('live dashboard uses filters, reconciles charts and renders desktop/tablet/mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await mockSession(page); await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tổng quan công việc' })).toBeVisible();
  expect(parseFloat(await page.getByRole('heading', { name: 'Tổng quan công việc' }).evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(25);
  await expect(page.getByTestId('today-count')).toHaveText('3');
  await expect(page.getByTestId('order-count')).toHaveText('2');
  await expect(page.getByRole('link', { name: 'Tạo chuyến đi' })).toHaveAttribute('href', '/travel/create');
  await expect(page.getByRole('link', { name: 'Mở giấy giới thiệu' })).toHaveAttribute('href', '/introduction-letters');
  await expect(page.getByRole('img', { name: /Giấy đi đường.*2 giấy/ })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await captureDashboard(page, 'test-results/dashboard-live-desktop.png');
  await page.getByRole('combobox', { name: 'Phạm vi đơn vị', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Tìm phạm vi đơn vị', exact: true }).fill('P1');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.locator('.ui-select-panel').evaluate(async el => {
    const animations: Animation[] = [];
    for (let node: Element | null = el; node; node = node.parentElement) animations.push(...node.getAnimations());
    await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
  });
  // Keep the viewport unchanged: PrimeNG closes an open overlay on window resize.
  await page.screenshot({ path: 'test-results/dashboard-select-new.png' });
  await page.getByRole('option').filter({ hasText: 'Phòng 1' }).click();
  await expect(page.getByTestId('today-count')).toHaveText('2');
  await page.getByRole('combobox', { name: 'Kỳ báo cáo', exact: true }).press('ArrowDown');
  await page.getByRole('searchbox', { name: 'Tìm kỳ báo cáo', exact: true }).fill('08/2026');
  await page.getByRole('searchbox', { name: 'Tìm kỳ báo cáo', exact: true }).press('ArrowDown');
  await page.getByRole('searchbox', { name: 'Tìm kỳ báo cáo', exact: true }).press('Enter');
  await expect(page.getByTestId('order-count')).toHaveText('0');
  await expect(page.getByTestId('today-count')).toHaveText('2');
  await expect(page.getByRole('heading', { name: 'Chưa có giấy đi đường trong kỳ' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Giấy đi đường.*giấy/ })).toHaveCount(0);
  await chooseOption(page, 'Kỳ báo cáo', 'Tháng 09/2026');
  await expect(page.getByTestId('order-count')).toHaveText('2');
  await page.getByRole('tab', { name: /Hôm nay/ }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Sắp tới · 7 ngày' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('27/09/2026');
  await chooseOption(page, 'Phạm vi đơn vị', 'Cục H04');
  await expect(page.getByTestId('today-count')).toHaveText('3');
  await page.getByRole('tab', { name: /Hôm nay/ }).click();
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect.poll(() => page.locator('app-home').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('combobox', { name: 'Phạm vi đơn vị', exact: true })).toBeVisible();
    await page.locator('.dashboard-footer').scrollIntoViewIfNeeded();
    const footer = await page.locator('.dashboard-footer').boundingBox();
    expect(footer!.y).toBeGreaterThanOrEqual(0);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(1001);
    await page.locator('app-home').evaluate(el => el.scrollTop = 0);
    await captureDashboard(page, `test-results/dashboard-live-${width}.png`);
  }
  await chooseOption(page, 'Phạm vi đơn vị', 'Công việc của tôi');
  await expect(page.getByTestId('today-count')).toHaveText('1');
  await expect(page.getByText('Ca của tôi trong kỳ', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('technical admin sees setup, no unauthorized metrics and the shared style in directory and travel', async ({ page }) => {
  await mockSession(page, data => ({ ...data, scopeCode: 'mine', scopeName: 'Công việc của tôi', scopes: [], capabilities: { canCreateRoster: false, canCreateTravel: false, canManageDirectory: true, canManageAccess: true }, roster: { ...data.roster, state: 'unavailable', todayAssignments: [], dailyCounts: [] }, travel: { ...data.travel, state: 'unavailable', statusCounts: [] }, directory: { state: 'ready', organizationCount: 0, personnelCount: 0, requiresSetup: true } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hoàn thiện danh mục để bắt đầu' })).toBeVisible();
  await expect(page.getByTestId('order-count')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tạo chuyến đi' })).toHaveCount(0);
  const buttonColor = await page.getByRole('link', { name: 'Mở tổ chức và cán bộ' }).evaluate(el => getComputedStyle(el).backgroundColor);
  await page.getByRole('link', { name: 'Mở tổ chức và cán bộ' }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục đơn vị', exact: true })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe(buttonColor);
  await page.screenshot({ path: 'test-results/shared-style-directory.png', fullPage: true });
  await page.goto('/travel');
  await expect(page.getByRole('heading', { name: 'Danh sách giấy đi đường' })).toBeVisible();
  expect(await page.locator('.travel-list-page .list-header').getByRole('button', { name: 'Tạo mới', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe(buttonColor);
  await page.screenshot({ path: 'test-results/shared-style-travel.png', fullPage: true });
});

test('a failed section displays unknown values while successful roster data remains usable', async ({ page }) => {
  await mockSession(page, data => ({ ...data, travel: { ...data.travel, state: 'error' } })); await page.goto('/');
  await expect(page.getByTestId('today-count')).toHaveText('3');
  await expect(page.getByTestId('order-count')).toHaveText('—');
  await expect(page.getByRole('alert')).toContainText('Một phần tổng quan chưa tải được');
  await expect(page.getByRole('heading', { name: 'Chưa có giấy đi đường trong kỳ' })).toHaveCount(0);
});

test('dashboard API forbidden and notification failures show recovery without starting SSO', async ({ page }) => {
  let loginRequests = 0;
  await mockSession(page);
  await page.route('**/auth/login**', route => { loginRequests++; return route.fulfill({ status: 500 }); });
  await page.route('**/api/home/overview**', route => route.fulfill({ status: 403, json: { error: 'Forbidden' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Bạn không có quyền xem phạm vi đã chọn');
  expect(loginRequests).toBe(0);
  await page.unroute('**/api/home/overview**');
  await page.route('**/api/notifications/my**', route => route.fulfill({ status: 500, json: { error: 'Failed' } }));
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByTestId('today-count')).toHaveText('3');
  await page.getByRole('button', { name: 'Làm mới thông báo' }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được thông báo');
  expect(loginRequests).toBe(0);
});
