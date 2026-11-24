import { test, expect } from '@playwright/test';

const overview = {
  checkedAt: '2026-11-20T08:10:00.000Z',
  status: 'ATTENTION',
  database: { ok: true, database: 'up', latencyMs: 12 },
  uptimeSeconds: 1850,
  heapUsedMb: 45,
  metrics: {
    windowMinutes: 15,
    total: {
      requests: 320, serverErrors: 4, rateLimited: 12,
      sampledRequests: 60, p95Ms: 1900
    },
    groups: [
      { group: 'places', requests: 200, serverErrors: 2, rateLimited: 0, p95Ms: 520 },
      { group: 'housing', requests: 120, serverErrors: 2, rateLimited: 12, p95Ms: 1900 }
    ]
  },
  warnings: [{ code: 'SLOW_API', severity: 'warning', message: 'Độ trễ API vượt ngưỡng.' }],
  launch: {
    launchStatus: 'NOT_VERIFIED', dataGate: 'NEEDS_REVIEW',
    counts: { publishedPlaces: 200, activeHousing: 30,
      stalePublishedHousing: 2, missingHousingContact: 1,
      legacyUnstructuredHousing: 3, publishedWithoutImages: 16 },
    blockers: ['STALE_PUBLISHED_HOUSING','HOUSING_MISSING_CONTACT'],
    manualGates: [{ code: 'OFFSITE_BACKUP_VERIFIED', status: 'UNVERIFIED' },
      { code: 'PRODUCTION_RESTORE_DRILL', status: 'UNVERIFIED' }]
  }
};

async function mockApi(page, role) {
  let monitored = 0;
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname === '/api/auth/refresh'
      ? { token: 'test-only-access-token', user: {
          id: 77, name: 'Người kiểm thử', role, security: { adminTwoFactorSetupRequired: false }
        } }
      : url.pathname === '/api/admin/operations/overview'
        ? (monitored += 1, overview)
        : { items: [], data: [], ok: true };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
  return () => monitored;
}

test('mobile Admin sees safe operational metrics and can refresh', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requestCount = await mockApi(page, 'ADMIN');
  await page.goto('/admin/operations', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Giám sát vận hành' })).toBeVisible();
  await expect(page.getByText('PostgreSQL kết nối tốt')).toBeVisible();
  await expect(page.getByText('Cần theo dõi', { exact: true })).toBeVisible();
  await expect(page.getByText('Độ trễ API vượt ngưỡng.')).toBeVisible();
  await expect(page.getByRole('row', { name: /Bất động sản/ })).toBeVisible();
  const launch = page.getByTestId('launch-evidence');
  await expect(launch).toContainText('Chưa nghiệm thu production');
  await expect(launch).toContainText('Bất động sản hết hiệu lực');
  await expect(launch).toContainText('Chưa xác minh');
  await expect(launch).toContainText('Bản sao lưu ngoài VPS');
  await expect.poll(requestCount).toBeGreaterThan(0);

  const initial = requestCount();
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect.poll(requestCount).toBeGreaterThan(initial);

  const overflow = await page.evaluate(
    () => Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  );
  expect(overflow).toBeLessThanOrEqual(2);
});

test('non-admin accounts cannot see launch operations dashboard', async ({ page }) => {
  const requestCount = await mockApi(page, 'USER');
  await page.goto('/admin/operations', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Giám sát vận hành' })).toHaveCount(0);
  expect(requestCount()).toBe(0);
});
