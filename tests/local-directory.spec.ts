import { test, expect, Page } from '@playwright/test';
import { chooseOption } from './ui-select.helper';

function catalog() { return { mode: 'Local', organizations: [] as any[], positions: [] as any[], ranks: [] as any[], personnel: [] as any[], total: 0, page: 1 }; }
async function captureDirectory(page: Page, path: string) {
  const viewport = page.viewportSize()!; const height = await page.locator('.admin-main').evaluate(el => el.scrollHeight);
  await page.setViewportSize({ width: viewport.width, height: Math.max(viewport.height, height + 128) });
  await page.screenshot({ path, fullPage: true, animations: 'disabled' }); await page.setViewportSize(viewport);
}
async function session(page: Page, data: ReturnType<typeof catalog>, options: { failWrite?: boolean } = {}) {
  const requests: URL[] = []; let oracleRequests = 0; let writes = 0;
  await page.route('**/auth/me', route => route.fulfill({ json: { username: 'admin', permissions: ['system.config'], roles: ['admin'] } }));
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.pathname.startsWith('/api/directory-sync')) oracleRequests++;
    if (url.pathname === '/api/me/bootstrap') return route.fulfill({ json: { user: { username: 'admin' }, permissions: ['system.config'], roles: ['admin'], scopesByFeature: {} } });
    if (url.pathname === '/api/directory') {
      requests.push(url); const q = (url.searchParams.get('q') || '').toLowerCase(); const org = url.searchParams.get('orgCode'); const active = url.searchParams.get('active'); const pageNo = Number(url.searchParams.get('page') || '1');
      const people = data.personnel.filter(x => (!q || (x.username + ' ' + x.fullName).toLowerCase().includes(q)) && (!org || x.orgCode === org) && (!active || x.active === (active === 'true')));
      return route.fulfill({ json: { ...data, personnel: people.slice((pageNo - 1) * 50, pageNo * 50), total: people.length, personnelTotal: data.personnel.length, page: pageNo } });
    }
    if (url.pathname.startsWith('/api/directory/')) {
      writes++; expect(request.headers()['x-duty-admin']).toBe('1');
      if (options.failWrite) return route.fulfill({ status: 400, json: { error: 'Mã danh mục đã tồn tại.' } });
      const kind = url.pathname.split('/')[3] as 'organizations' | 'personnel' | 'positions' | 'ranks'; const body = request.postDataJSON();
      if (request.method() === 'POST') data[kind].push({ ...body, id: `LOCAL-${kind}-${data[kind].length}` });
      else Object.assign(data[kind].find((x: any) => (x.username || x.code) === decodeURIComponent(url.pathname.split('/')[4])), body);
      return route.fulfill({ json: { message: 'Đã lưu' } });
    }
    return route.fulfill({ json: [] });
  });
  return { requests, oracleRequests: () => oracleRequests, writes: () => writes };
}
async function openKind(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Phân hệ danh mục' }).getByRole('link').filter({ hasText: label }).click();
  await expect(page.locator('.directory-list')).toHaveAttribute('aria-busy', 'false');
}
async function addClassification(page: Page, kind: string, code: string, name: string) {
  await openKind(page, kind); await page.getByRole('button', { name: `Thêm ${kind.toLocaleLowerCase('vi-VN')}`, exact: true }).click();
  await page.getByLabel(/^Mã\s*\*/).fill(code); await page.getByLabel(/^Tên\s*\*/).fill(name);
  if (kind === 'Chức vụ') await page.getByLabel('Cấp chức vụ', { exact: false }).fill('4');
  await page.getByLabel('Thứ tự hiển thị').fill('1'); await page.getByRole('button', { name: `Lưu ${kind.toLocaleLowerCase('vi-VN')}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('table')).toContainText(name);
}

test('admin creates organization, classifications and SSO personnel through focused dialogs', async ({ page }) => {
  const data = catalog(); const api = await session(page, data); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/admin/directory');
  await expect(page.getByRole('heading', { name: 'Danh mục đơn vị', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Chưa có đơn vị' })).toBeVisible();
  await page.screenshot({ path: 'test-results/directory-new-empty.png', fullPage: true });
  await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lưu đơn vị', exact: true })).toBeDisabled();
  await page.getByLabel(/^Mã đơn vị/).fill('H04'); await page.getByLabel(/^Tên đơn vị/).fill('Cục H04');
  await page.getByRole('button', { name: 'Lưu đơn vị', exact: true }).click();
  await expect(page.locator('.unit-detail')).toContainText('Cục H04');
  await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
  await page.getByLabel(/^Mã đơn vị/).fill('P1'); await page.getByLabel(/^Tên đơn vị/).fill('Phòng 1');
  await page.getByRole('button', { name: 'Lưu đơn vị', exact: true }).click();
  await expect(page.locator('.unit-detail')).toContainText('Phòng 1');
  expect(data.organizations[1].parentId).toBe(data.organizations[0].id);
  await addClassification(page, 'Chức vụ', 'STAFF', 'Cán bộ'); await addClassification(page, 'Cấp bậc', 'RANK', 'Thượng úy');
  await openKind(page, 'Cán bộ'); await expect(page).toHaveURL(/\/admin\/directory\/personnel$/);
  await page.getByRole('button', { name: 'Thêm cán bộ', exact: true }).click();
  await page.getByLabel(/^Tài khoản SSO/).fill('alice'); await page.getByLabel(/^Họ tên/).fill('Nguyễn Văn A');
  await expect(page.getByRole('button', { name: 'Lưu cán bộ', exact: true })).toBeDisabled();
  await page.getByRole('combobox', { name: 'Đơn vị', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Tìm đơn vị', exact: true }).fill('P1');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.screenshot({ path: 'test-results/directory-new-select.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('option').filter({ hasText: 'Phòng 1' }).click();
  await chooseOption(page, 'Chức vụ', 'Cán bộ'); await chooseOption(page, 'Cấp bậc', 'Thượng úy');
  await page.screenshot({ path: 'test-results/directory-new-editor.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Lưu cán bộ', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Nguyễn Văn A');
  expect(data.personnel[0]).toMatchObject({ orgCode: 'P1', positionCode: 'STAFF', rankCode: 'RANK' });
  await page.getByRole('button', { name: 'Sửa Nguyễn Văn A', exact: true }).click();
  await expect(page.getByLabel(/^Tài khoản SSO/)).toHaveAttribute('readonly', '');
  await page.getByLabel('Đang hoạt động', { exact: true }).uncheck();
  await page.getByRole('button', { name: 'Lưu cán bộ', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('Ngừng hoạt động');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await captureDirectory(page, 'test-results/directory-new-desktop.png');
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect.poll(() => page.locator('.admin-main').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(366);
  await expect(page.getByRole('combobox', { name: 'Lọc đơn vị', exact: true })).toBeVisible();
  await chooseOption(page, 'Lọc đơn vị', 'Phòng 1'); await expect(page.getByRole('table')).toContainText('Nguyễn Văn A');
  await captureDirectory(page, 'test-results/directory-new-mobile.png');
  await page.getByRole('button', { name: 'Sửa Nguyễn Văn A', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialog = await page.getByRole('dialog').boundingBox(); expect(dialog!.width).toBeLessThanOrEqual(390);
  await page.getByRole('combobox', { name: 'Đơn vị', exact: true }).click(); await expect(page.getByRole('option').filter({ hasText: 'Phòng 1' })).toBeVisible();
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  expect(api.oracleRequests()).toBe(0); expect(errors).toEqual([]);
});

test('personnel filtering happens on server before paging, and failed save retains input', async ({ page }) => {
  const data = catalog(); data.organizations = [{ id: 'root', code: 'H04', name: 'Cục H04', parentId: null, active: true }, { id: 'p1', code: 'P1', name: 'Phòng 1', parentId: 'root', active: true }, { id: 'p2', code: 'P2', name: 'Phòng 2', parentId: 'root', active: true }, { id: 'team', code: 'TEAM', name: 'Tổ công tác', parentId: 'p1', active: true }];
  data.personnel = Array.from({ length: 62 }, (_, i) => ({ username: `user${String(i + 1).padStart(3, '0')}`, fullName: `Cán bộ ${i + 1}`, orgCode: i === 61 ? 'P2' : 'P1', active: i < 51 || i === 61 }));
  const writeOptions = { failWrite: true }; const api = await session(page, data, writeOptions); await page.goto('/admin/directory/personnel');
  await expect(page.getByRole('heading', { name: 'Tổ chức và cán bộ', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Chọn đơn vị' }).getByRole('button', { name: /^Phòng 1/ }).click();
  await chooseOption(page, 'Lọc trạng thái', 'Đang hoạt động');
  await expect(page.locator('.list-footer')).toContainText('1–50 / 51 cán bộ');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.getByRole('table')).toContainText('user051'); await expect(page.locator('.list-footer')).toContainText('51–51 / 51 cán bộ');
  await page.getByRole('textbox', { name: 'Tìm danh mục', exact: true }).fill('user051'); await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page.locator('.list-footer')).toContainText('1–1 / 1 cán bộ');
  await expect(page.getByRole('navigation', { name: 'Phân hệ danh mục' }).getByRole('link').filter({ hasText: 'Cán bộ' })).toContainText('62');
  expect(api.requests.at(-1)!.searchParams.get('active')).toBe('true'); expect(api.requests.at(-1)!.searchParams.get('orgCode')).toBe('P1'); expect(api.requests.at(-1)!.searchParams.get('page')).toBe('1');
  await page.getByRole('button', { name: 'Xóa từ khóa', exact: true }).click(); await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  writeOptions.failWrite = false; await page.getByRole('button', { name: 'Sửa Cán bộ 51', exact: true }).click();
  await page.getByLabel('Đang hoạt động', { exact: true }).uncheck(); await page.getByRole('button', { name: 'Lưu cán bộ', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.locator('.list-footer')).toContainText('1–50 / 50 cán bộ');
  await expect(page.locator('.list-footer')).toContainText('Trang 1 / 1'); writeOptions.failWrite = true;
  await openKind(page, 'Đơn vị'); await page.locator('.tree-label').filter({ hasText: 'Phòng 1' }).click(); await page.getByRole('button', { name: 'Sửa Phòng 1', exact: true }).click();
  await page.getByRole('combobox', { name: 'Đơn vị cha', exact: true }).click();
  await expect(page.getByRole('option').filter({ hasText: 'Phòng 1' })).toHaveCount(0); await expect(page.getByRole('option').filter({ hasText: 'Tổ công tác' })).toHaveCount(0);
  await expect(page.getByRole('option').filter({ hasText: 'Đơn vị gốc' })).toHaveAttribute('data-p-disabled', 'true');
  await page.keyboard.press('Escape'); await page.getByLabel(/^Tên đơn vị/).fill('Phòng 1 chỉnh sửa');
  await page.getByRole('button', { name: 'Lưu đơn vị', exact: true }).click();
  await expect(page.locator('.unit-detail').getByRole('alert')).toContainText('Mã danh mục đã tồn tại'); await expect(page.getByLabel(/^Tên đơn vị/)).toHaveValue('Phòng 1 chỉnh sửa');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await captureDirectory(page, `test-results/directory-organizations-${width}.png`);
  }
});

test('H04 departments display in numeric order in the tree and unit selector', async ({ page }) => {
  const data = catalog();
  data.organizations = [{ id: 'root', code: 'H04', name: 'Cục H04', parentId: null, active: true },
    ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, code: `P${i + 1}`, name: `Phòng ${i + 1}`, parentId: 'root', active: true }))]
    .sort((a, b) => a.code.localeCompare(b.code)); // API orders by CODE: P1, P10, P11, P12, P2...
  await session(page, data); await page.goto('/admin/directory/organizations');
  const expected = ['Cục H04', ...Array.from({ length: 12 }, (_, i) => `Phòng ${i + 1}`)];
  await expect(page.locator('.tree-label strong')).toHaveText(expected);
  await expect(page.locator('.organization-tree header')).toContainText('13 đơn vị');
  await expect(page.locator('.unit-detail .structure-summary')).toContainText('12');
  await page.getByRole('button', { name: 'Thêm đơn vị', exact: true }).click();
  await page.getByRole('combobox', { name: 'Đơn vị cha', exact: true }).click();
  await expect(page.getByRole('option').locator('.ui-select-option > span')).toHaveText(['Đơn vị gốc của bản cài', ...expected]);
});

test('synchronized directory is read only, and loading errors do not appear as empty lists', async ({ page }) => {
  const data = catalog(); data.mode = 'OracleSync'; const api = await session(page, data);
  await page.goto('/admin/directory/ranks'); await expect(page.getByText('Danh mục do nguồn đồng bộ quản lý.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Thêm/ })).toHaveCount(0);
  await page.route('**/api/directory?**', route => route.fulfill({ status: 500, json: { error: 'Lỗi tải danh mục' } }));
  await page.getByRole('button', { name: 'Làm mới danh mục', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Lỗi tải danh mục'); await expect(page.getByRole('heading', { name: 'Chưa tải được danh sách' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chưa có cấp bậc' })).toHaveCount(0); expect(api.writes()).toBe(0);
});

test('organization profile uses a wide searchable tree, inline editing and unsaved-change protection', async ({ page }) => {
  const data = catalog();
  const names = ['Phòng Tham mưu - Tổng hợp', 'Phòng Chính trị / Tổ chức cán bộ', 'Phòng Hậu cần - Quản trị', 'Phòng Quản lý Mạng và Truyền dẫn', 'Phòng Kỹ thuật nghiệp vụ mật mã', 'Phòng Quản lý liên lạc cơ yếu', 'Phòng Quản lý và cung cấp tài liệu mật mã', 'Phòng Mã dịch và Chuyển nhận điện mật', 'Phòng Quản lý phát triển phần mềm và CSDL', 'Phòng Hạ tầng số và Trung tâm dữ liệu', 'Phòng An toàn thông tin và Kiểm định', 'Phòng / Trung tâm Quản trị kỹ thuật khu vực phía Nam'];
  data.organizations = [{ id: 'root', code: 'H04', name: 'Cục Công nghệ thông tin và Cơ yếu', shortName: 'H04', parentId: null, active: true },
    ...names.map((name, i) => ({ id: `p${i + 1}`, code: `P${i + 1}`, name: `Phòng ${i + 1} (${name})`, shortName: `Phòng ${i + 1}`, parentId: 'root', active: true }))];
  data.positions = ['Cục trưởng', 'Phó Cục trưởng', 'Trưởng phòng', 'Phó Trưởng phòng', 'Đội trưởng', 'Phó Đội trưởng', 'Cán bộ'].map((name, i) => ({ code: `POS${i + 1}`, name, active: true }));
  data.ranks = ['Đại tướng', 'Thượng tướng', 'Trung tướng', 'Thiếu tướng', 'Đại tá', 'Thượng tá', 'Trung tá', 'Thiếu tá', 'Đại úy', 'Thượng úy', 'Trung úy', 'Thiếu úy', 'Thượng sĩ', 'Trung sĩ', 'Hạ sĩ', 'Binh nhất', 'Binh nhì'].map((name, i) => ({ code: `RANK${i + 1}`, name, active: true }));
  const api = await session(page, data); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/admin/directory/organizations');
  await expect(page.locator('.unit-detail h2')).toHaveText(data.organizations[0].name);
  expect((await page.locator('app-organization-tree').boundingBox())!.width).toBeGreaterThan(400);
  // At a standard desktop height, controls leave room for the actual directory.
  await page.setViewportSize({ width: 1440, height: 900 });
  expect((await page.locator('.directory-workspace').boundingBox())!.y).toBeLessThan(260);
  expect((await page.locator('.unit-detail').boundingBox())!.height).toBeLessThan(560);
  await page.screenshot({ path: 'test-results/directory-compact-desktop.png' });
  const expandedHeight = (await page.locator('.organization-tree').boundingBox())!.height;
  const treeBounds = (await page.locator('.organization-tree').boundingBox())!;
  expect(treeBounds.y + treeBounds.height).toBeLessThanOrEqual(900);
  await captureDirectory(page, 'test-results/directory-profile-desktop.png');
  await page.getByRole('button', { name: 'Thu gọn ' + data.organizations[0].name, exact: true }).click();
  await expect(page.locator('.tree-label')).toHaveCount(1);
  expect((await page.locator('.organization-tree').boundingBox())!.height).toBeLessThan(expandedHeight / 2);
  await page.getByRole('textbox', { name: 'Tìm đơn vị trên cây' }).fill('phan mem');
  await expect(page.locator('.tree-label strong')).toHaveText([data.organizations[0].name, data.organizations[9].name]);
  await page.locator('.tree-label').filter({ hasText: 'P9' }).click();
  await expect(page.locator('.unit-detail h2')).toHaveText(data.organizations[9].name);
  await page.getByRole('button', { name: 'Xóa tìm kiếm cây', exact: true }).click();
  await page.getByRole('button', { name: 'Sửa ' + data.organizations[9].name, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel(/^Mã đơn vị/)).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Lưu đơn vị', exact: true })).toBeDisabled();
  await page.getByLabel(/^Tên đơn vị/).fill('Phòng 9 đổi tên chưa lưu');
  await page.getByRole('button', { name: 'Thêm đơn vị con của ' + data.organizations[2].name, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click();
  await expect(page.getByLabel(/^Tên đơn vị/)).toHaveValue('Phòng 9 đổi tên chưa lưu');
  await page.getByRole('navigation', { name: 'Phân hệ danh mục' }).getByRole('link').filter({ hasText: 'Cán bộ' }).click();
  await expect(page.getByRole('dialog', { name: 'Thay đổi chưa lưu' })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click();
  await expect(page).toHaveURL(/organizations$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/directory-compact-editor.png' });
  await captureDirectory(page, 'test-results/directory-inline-editor.png');
  await page.getByRole('button', { name: 'Lưu đơn vị', exact: true }).click();
  await expect(page.locator('.unit-detail h2')).toHaveText('Phòng 9 đổi tên chưa lưu');
  await page.getByRole('button', { name: 'Thêm đơn vị con của ' + data.organizations[2].name, exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Đơn vị cha', exact: true })).toContainText(data.organizations[2].name);
  await page.getByLabel(/^Mã đơn vị/).fill('TEAM2'); await page.getByLabel(/^Tên đơn vị/).fill('Tổ công tác thuộc Phòng 2');
  await page.getByRole('button', { name: 'Lưu đơn vị', exact: true }).click();
  await expect(page.locator('.unit-detail h2')).toHaveText('Tổ công tác thuộc Phòng 2');
  expect(data.organizations.at(-1).parentId).toBe('p2');
  await page.getByRole('button', { name: 'Sửa Tổ công tác thuộc Phòng 2', exact: true }).click();
  await page.getByLabel(/^Tên đơn vị/).fill('Bỏ thay đổi');
  await page.getByRole('button', { name: 'Làm mới danh mục', exact: true }).click();
  await page.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
  await expect(page.locator('.unit-detail h2')).toHaveText('Tổ công tác thuộc Phòng 2');
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await expect(page.locator('app-organization-tree')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect.poll(() => page.locator('.admin-main').evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(width);
    await captureDirectory(page, `test-results/directory-profile-${width}.png`);
  }
  await page.setViewportSize({ width: 1440, height: 1100 }); await openKind(page, 'Cán bộ');
  expect((await page.locator('app-organization-tree').boundingBox())!.width).toBeGreaterThan(320);
  await captureDirectory(page, 'test-results/directory-wide-personnel.png');
  expect(api.writes()).toBe(2); expect(api.oracleRequests()).toBe(0); expect(errors).toEqual([]);
});
