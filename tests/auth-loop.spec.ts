import { test, expect } from '@playwright/test';

for (const status of [403, 500]) {
  test(`auth/me ${status} stops on a message without returning to SSO`, async ({ page }) => {
    let meRequests = 0; let logins = 0;
    await page.route('**/auth/me', async route => {
      meRequests++;
      return route.fulfill({ status, json: { error: status === 403 ? 'Tài khoản chưa có trong danh mục cán bộ nội bộ.' : 'Backend chưa sẵn sàng.' } });
    });
    await page.route('**/auth/login?**', route => { logins++; return route.fulfill({ status: 500 }); });
    await page.goto('/');
    await expect(page).toHaveURL(status === 403 ? /\/403$/ : /\/session-error\?/);
    await expect(page.getByRole('heading', { name: status === 403 ? '403 - Không có quyền truy cập' : 'Chưa truy cập được hệ thống' })).toBeVisible();
    expect(logins).toBe(0);
    // App initializer and guard share one request.
    expect(meRequests).toBe(1);
  });
}

test('a missing BFF cookie after the SSO round trip stops automatic login', async ({ page, baseURL }) => {
  let logins = 0;
  await page.route('**/auth/me', route => route.fulfill({ status: 401, json: { error: 'Chưa có phiên đăng nhập hợp lệ.' } }));
  await page.route('**/auth/login?**', route => {
    logins++;
    return route.fulfill({ status: 302, headers: { location: `${baseURL}/` } });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/session-error\?/);
  await expect(page.getByRole('button', { name: 'Đăng nhập lại' })).toBeVisible();
  expect(logins).toBe(1);
  await page.reload();
  await expect(page).toHaveURL(/\/session-error\?/);
  expect(logins).toBe(1);
});
