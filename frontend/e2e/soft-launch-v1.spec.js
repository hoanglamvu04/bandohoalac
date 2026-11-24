import { test, expect } from '@playwright/test';

test('guest can send a bug report without sharing exact page URL or login', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let posted = null;

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth/refresh') {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ error: 'Not logged in' }) });
    }
    if (pathname === '/api/soft-launch/feedback' && route.request().method() === 'POST') {
      posted = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({ status: 201, contentType: 'application/json',
        body: JSON.stringify({
          accepted: true, reference: 'e41cc551-90db-4cf7-b140-bd284e9f51e0'
        }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ items: [], ok: true }) });
  });

  await page.goto('/gop-y', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Bạn gặp lỗi khi dùng HOLA Maps/ })).toBeVisible();
  await page.getByLabel('Loại phản hồi').selectOption('BUG');
  await page.getByLabel('Khu vực gặp lỗi').selectOption('MAP');
  await page.locator('textarea').fill('Bản đồ bị trống vài giây khi kéo trên điện thoại Android.');
  await page.getByRole('button', { name: 'Gửi góp ý cho HOLA Maps' }).click();

  await expect.poll(() => posted).not.toBeNull();
  expect(posted.category).toBe('BUG');
  expect(posted.area).toBe('MAP');
  expect(posted.message).toContain('Bản đồ bị trống');
  expect(posted).not.toHaveProperty('url');
  expect(posted).not.toHaveProperty('location');
  expect(posted).not.toHaveProperty('userId');
  await expect(page.getByRole('heading', { name: /Cảm ơn bạn đã góp ý/ })).toBeVisible();
  await expect(page.getByText('e41cc551-90db-4cf7-b140-bd284e9f51e0')).toBeVisible();
});

test('Admin can review feedback and see anonymized mobile network summaries', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const item = {
    id: 701, reference: 'd0c3b8f3-5d1a-4db7-8dd5-36de2fb973c2',
    category: 'BUG', area: 'MAP',
    message: 'Bản đồ bị đứng khi đổi từ chế độ 2D sang ảnh vệ tinh.',
    status: 'NEW', note: null, version: 1, createdAt: '2026-11-20T08:00:00Z'
  };
  let saved = null;

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let output = { items: [], ok: true };
    if (pathname === '/api/auth/refresh') {
      output = {
        token: 'test-session',
        user: { id: 11, name: 'Admin QA', role: 'ADMIN',
          security: { adminTwoFactorSetupRequired: false } }
      };
    } else if (pathname === '/api/admin/soft-launch/feedback' && method === 'GET') {
      output = { items: [item], total: 1, page: 1, limit: 20 };
    } else if (pathname === '/api/admin/soft-launch/feedback/701' && method === 'PATCH') {
      saved = JSON.parse(route.request().postData() || '{}');
      output = { id: 701, status: saved.status };
    } else if (pathname === '/api/admin/soft-launch/vitals' && method === 'GET') {
      output = {
        windowHours: 24,
        groups: [
          { metric: 'LCP', routeGroup: 'MAP', device: 'MOBILE',
            network: '4g', samples: 36, good: 23, goodPct: 63.9 },
          { metric: 'MAP_READY', routeGroup: 'MAP', device: 'MOBILE',
            network: '3g', samples: 19, good: 10, goodPct: 52.6 }
        ]
      };
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(output) });
  });

  await page.goto('/admin/soft-launch', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Phản hồi & hiệu năng' })).toBeVisible();
  await expect(page.getByText('Bản đồ bị đứng khi đổi')).toBeVisible();
  await page.getByLabel('Trạng thái phản hồi 701').selectOption('IN_REVIEW');
  await page.getByLabel('Ghi chú phản hồi 701').fill('Đã tạo ticket kiểm tra mobile');
  await page.getByRole('button', { name: 'Lưu xử lý' }).click();
  await expect.poll(() => saved).not.toBeNull();
  expect(saved.status).toBe('IN_REVIEW');
  expect(saved.note).toContain('Đã tạo ticket');
  expect(saved.expectedVersion).toBe(1);

  await page.getByRole('tab', { name: 'Hiệu năng thực tế' }).click();
  await expect(page.getByText('Tải nội dung chính')).toBeVisible();
  await page.getByLabel('Lọc loại mạng').selectOption('4g');
  await expect(page.getByText('63.9% tốt')).toBeVisible();
  await expect(page.getByText('52.6% tốt')).toHaveCount(0);
});

test('guest is denied the private Admin feedback queue', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({ status: pathname === '/api/auth/refresh' ? 401 : 200,
      contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.goto('/admin/soft-launch', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Phản hồi & hiệu năng' })).toHaveCount(0);
});

test('feedback queue hides the previous filter and ignores a superseded response', async ({ page }) => {
  const newItem = { id: 801, message: 'Mục đang chờ xử lý', status: 'NEW', version: 1 };
  const resolvedItem = { id: 802, message: 'Mục đã giải quyết', status: 'RESOLVED', version: 1 };
  let releaseStale;
  const staleGate = new Promise((resolve) => { releaseStale = resolve; });
  let releaseResolved;
  const resolvedGate = new Promise((resolve) => { releaseResolved = resolve; });
  let initialLoads = 0;

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 11, role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false } }
    } });
    if (url.pathname !== '/api/admin/soft-launch/feedback') {
      return route.fulfill({ json: { items: [], ok: true } });
    }
    if (url.searchParams.get('status') === 'RESOLVED') {
      await resolvedGate;
      return route.fulfill({ json: { items: [resolvedItem], total: 1 } });
    }
    initialLoads += 1;
    if (initialLoads > 1) await staleGate;
    await route.fulfill({ json: { items: [newItem], total: 1 } });
  });

  try {
    await page.goto('/admin/soft-launch');
    await expect(page.getByText(newItem.message)).toBeVisible();
    const reloadRequest = page.waitForRequest((req) => req.url().includes('/soft-launch/feedback?'));
    await page.getByRole('button', { name: 'Làm mới' }).click();
    const oldRequest = await reloadRequest;
    const cancelled = page.waitForEvent('requestfailed', { predicate: (req) => req === oldRequest });
    await page.getByLabel('Lọc trạng thái phản hồi').selectOption('RESOLVED');
    await expect(page.getByText(newItem.message)).toHaveCount(0);
    await cancelled;
    releaseResolved();
    await expect(page.getByText(resolvedItem.message)).toBeVisible();
    releaseStale();
    await expect(page.getByText(newItem.message)).toHaveCount(0);
  } finally {
    releaseStale();
    releaseResolved();
  }
});

test('saving the last item on a page returns to the last available page', async ({ page }) => {
  const firstItem = { id: 901, message: 'Một góp ý ở trang đầu', status: 'NEW', version: 1 };
  const lastItem = { id: 902, message: 'Góp ý cuối ở trang hai', status: 'NEW', version: 1 };
  let saved = false;

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 11, role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false } }
    } });
    if (url.pathname === '/api/admin/soft-launch/feedback/902') {
      saved = route.request().postDataJSON().status === 'RESOLVED' &&
        route.request().postDataJSON().expectedVersion === 1;
      return route.fulfill({ json: { id: 902, status: 'RESOLVED' } });
    }
    if (url.pathname === '/api/admin/soft-launch/feedback') {
      const secondPage = url.searchParams.get('page') === '2';
      const items = secondPage ? (saved ? [] : [lastItem]) : [firstItem];
      return route.fulfill({ json: { items, total: saved ? 20 : 21 } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });

  await page.goto('/admin/soft-launch');
  await page.getByRole('button', { name: 'Trang tiếp' }).click();
  await expect(page.getByText(lastItem.message)).toBeVisible();
  await page.getByLabel('Trạng thái phản hồi 902').selectOption('RESOLVED');
  await page.getByRole('button', { name: 'Lưu xử lý' }).click();
  await expect(page.getByText(firstItem.message)).toBeVisible();
  await expect(page.getByText('Trang 1 / 1')).toBeVisible();
  expect(saved).toBe(true);
});

test('two Admin reviews show conflict, preserve draft when filter changes and permit explicit retry', async ({ page }) => {
  const item = {
    id: 1001, reference: '31ecfc93-7de5-47dd-bbec-3e82df7ef802',
    category: 'BUG', area: 'MAP',
    message: 'Ứng dụng không hiện dữ liệu trên một số điện thoại.',
    status: 'NEW', note: '', version: 1, createdAt: '2026-11-20T08:00:00Z'
  };
  const payloads = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 11, role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false } }
    } });
    if (url.pathname === '/api/admin/soft-launch/feedback/1001') {
      const input = route.request().postDataJSON();
      payloads.push(input);
      if (payloads.length === 1) {
        // Simulate a second Admin saving before this stale request arrives.
        item.status = 'IN_REVIEW';
        item.note = 'Admin khác đang kiểm tra';
        item.version = 2;
      }
      if (input.expectedVersion !== item.version) {
        return route.fulfill({ status: 409, json: {
          error: 'Góp ý đã được Admin khác cập nhật.',
          details: { code: 'FEEDBACK_VERSION_CONFLICT',
            current: { id: item.id, status: item.status,
              note: item.note, version: item.version,
              updatedAt: '2026-11-20T10:00:00Z' } }
        } });
      }
      item.status = input.status;
      item.note = input.note;
      item.version += 1;
      return route.fulfill({ json: { id: item.id, status: item.status,
        version: item.version } });
    }
    if (url.pathname === '/api/admin/soft-launch/feedback') {
      const filter = url.searchParams.get('status');
      const items = (!filter || filter === item.status) ? [{ ...item }] : [];
      return route.fulfill({ json: { items, total: items.length, page: 1, limit: 20 } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });

  await page.goto('/admin/soft-launch');
  await expect(page.getByText(item.message)).toBeVisible();
  await page.getByLabel('Trạng thái phản hồi 1001').selectOption('RESOLVED');
  await page.getByLabel('Ghi chú phản hồi 1001').fill('Đã tái hiện và khắc phục lỗi');
  await page.getByRole('button', { name: 'Lưu xử lý' }).click();

  const compare = page.getByRole('alert', { name: 'Xung đột góp ý 1001' });
  await expect(compare).toBeVisible();
  await expect(compare.getByText('Admin khác đang kiểm tra')).toBeVisible();
  await expect(compare.getByLabel('Bản nháp trạng thái 1001')).toHaveValue('RESOLVED');
  await expect(compare.getByLabel('Bản nháp ghi chú 1001'))
    .toHaveValue('Đã tái hiện và khắc phục lỗi');
  await expect(page.getByText(item.message)).toHaveCount(0);

  await compare.getByRole('button', { name: 'Lưu bản nháp sau khi đối chiếu' }).click();
  await expect(compare).toHaveCount(0);
  expect(payloads).toHaveLength(2);
  expect(payloads.map((x) => x.expectedVersion)).toEqual([1, 2]);
  expect(item.version).toBe(3);
  expect(item.status).toBe('RESOLVED');
  expect(item.note).toBe('Đã tái hiện và khắc phục lỗi');

  await page.getByLabel('Lọc trạng thái phản hồi').selectOption('ALL');
  await expect(page.getByText(item.message)).toBeVisible();
  await expect(page.getByLabel('Trạng thái phản hồi 1001')).toHaveValue('RESOLVED');
});

test('manual refresh keeps the original review version attached to an unsaved draft', async ({ page }) => {
  const item = {
    id: 1002, reference: '0e217750-ff08-4f14-860e-e776eb2ae34e',
    category: 'BUG', area: 'MAP', status: 'NEW', version: 1,
    note: '', message: 'Chế độ xem vệ tinh mở chậm trên thiết bị Android.',
    createdAt: '2026-11-20T08:00:00Z'
  };
  const submitted = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 11, role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false } }
    } });
    if (url.pathname === '/api/admin/soft-launch/feedback/1002') {
      const input = route.request().postDataJSON();
      submitted.push(input);
      return route.fulfill({ status: 409, json: {
        error: 'Góp ý đã thay đổi.',
        details: { code: 'FEEDBACK_VERSION_CONFLICT', current: {
          id: item.id, status: item.status, note: item.note,
          version: item.version, updatedAt: '2026-11-20T10:00:00Z'
        } }
      } });
    }
    if (url.pathname === '/api/admin/soft-launch/feedback') {
      return route.fulfill({ json: { items: [{ ...item }], total: 1, page: 1, limit: 20 } });
    }
    return route.fulfill({ json: { items: [], ok: true } });
  });

  await page.goto('/admin/soft-launch');
  await expect(page.getByText(item.message)).toBeVisible();
  await page.getByLabel('Trạng thái phản hồi 1002').selectOption('RESOLVED');
  await page.getByLabel('Ghi chú phản hồi 1002').fill('Tôi đã xử lý xong');
  item.version = 2;
  item.note = 'Admin A đang xác minh';
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByRole('button', { name: 'Làm mới' })).toBeEnabled();
  await page.getByRole('button', { name: 'Lưu xử lý' }).click();

  const compare = page.getByRole('alert', { name: 'Xung đột góp ý 1002' });
  await expect(compare).toBeVisible();
  expect(submitted).toHaveLength(1);
  expect(submitted[0].expectedVersion).toBe(1);
  await expect(compare.getByText('Admin A đang xác minh')).toBeVisible();
  await expect(compare.getByLabel('Bản nháp ghi chú 1002')).toHaveValue('Tôi đã xử lý xong');
  await compare.getByRole('button', { name: 'Dùng dữ liệu mới nhất, bỏ nháp' }).click();
  await expect(compare).toHaveCount(0);
  await expect(page.getByLabel('Ghi chú phản hồi 1002')).toHaveValue('Admin A đang xác minh');
});

test('guest can flag a public property for human triage without login or automatic removal', async ({ page }) => {
  let submitted = null;
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh')
      return route.fulfill({ status:401, json:{ error:'Login required' } });
    if (url.pathname === '/api/soft-launch/feedback' && route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status:201, json:{
        accepted:true, reference:'47b02e0f-8a45-48a0-bfdd-130784bf6a00'
      } });
    }
    return route.fulfill({ json:{ items:[], ok:true } });
  });
  await page.goto('/gop-y?reportHousing=701', { waitUntil:'domcontentloaded' });
  await expect(page.getByText('Đang phản ánh tin BĐS #701')).toBeVisible();
  await expect(page.getByLabel('Loại phản hồi')).toHaveValue('DATA');
  await expect(page.getByLabel('Khu vực gặp lỗi')).toHaveValue('HOUSING');
  await expect(page.getByRole('button', { name:'Gửi góp ý cho HOLA Maps' })).toBeDisabled();
  await page.locator('textarea').fill('Ảnh và giá chào trên tin có dấu hiệu không khớp với thông tin tôi kiểm tra.');
  await page.getByRole('button', { name:'Gửi góp ý cho HOLA Maps' }).click();
  await expect.poll(() => submitted).not.toBeNull();
  expect(submitted.area).toBe('HOUSING');
  expect(submitted.category).toBe('DATA');
  expect(submitted.message).toContain('Tin BĐS #701');
  expect(submitted.message).toContain('Ảnh và giá chào');
  for (const key of ['phone','userId','coordinates','lat','lng','url'])
    expect(submitted).not.toHaveProperty(key);
  await expect(page.getByText('Không có thay đổi nào được tự động áp dụng lên bản đồ.')).toBeVisible();
});

test('invalid public property reference never prefills an arbitrary housing ID', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: {} }));
  await page.goto('/gop-y?reportHousing=0001', { waitUntil:'domcontentloaded' });
  await expect(page.getByLabel('Loại phản hồi')).toHaveValue('BUG');
  await expect(page.getByLabel('Khu vực gặp lỗi')).toHaveValue('MAP');
  await expect(page.getByText(/Đang phản ánh tin BĐS/)).toHaveCount(0);
});
