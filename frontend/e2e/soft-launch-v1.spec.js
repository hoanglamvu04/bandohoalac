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
    status: 'NEW', note: null, createdAt: '2026-11-20T08:00:00Z'
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
  const newItem = { id: 801, message: 'Mục đang chờ xử lý', status: 'NEW' };
  const resolvedItem = { id: 802, message: 'Mục đã giải quyết', status: 'RESOLVED' };
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
  const firstItem = { id: 901, message: 'Một góp ý ở trang đầu', status: 'NEW' };
  const lastItem = { id: 902, message: 'Góp ý cuối ở trang hai', status: 'NEW' };
  let saved = false;

  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 11, role: 'ADMIN',
        security: { adminTwoFactorSetupRequired: false } }
    } });
    if (url.pathname === '/api/admin/soft-launch/feedback/902') {
      saved = route.request().postDataJSON().status === 'RESOLVED';
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
