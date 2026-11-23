import { expect, test } from '@playwright/test';

const place = (id) => ({
  id, slug: 'dia-diem-' + id, name: 'Địa điểm thử nghiệm ' + id,
  categorySlug: 'cafe', category: 'Cafe', status: 'PUBLISHED',
  address: 'Hòa Lạc', description: 'Không gửi nội dung này vào telemetry.',
  phone: '0987654321', lat: 21.01354, lng: 105.52522,
  source: 'USER', images: []
});

async function serveTelemetrySite(page, { loggedIn = false, favoriteFailure = false } = {}) {
  const events = [];
  const requests = [];
  let failedOnce = false;
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/xhub-analytics/status') {
      requests.push('status');
      return route.fulfill({ json: { schemaVersion: 1, enabled: true } });
    }
    if (path === '/api/xhub-analytics' && route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      requests.push('post');
      events.push(...(body.events || []).map((item) => ({ ...item, schemaVersion: body.schemaVersion })));
      return route.fulfill({ status: 202, json: { accepted: true } });
    }
    if (path === '/api/auth/refresh') {
      return loggedIn
        ? route.fulfill({ json: {
          token: 'test-session',
          user: { id: 90, role: 'USER', name: 'User QA' }
        } })
        : route.fulfill({ status: 401, json: {} });
    }
    if (/^\/api\/places\/\d+$/.test(path) && route.request().method() === 'GET') {
      return route.fulfill({ json: place(Number(path.split('/').at(-1))) });
    }
    if (path.endsWith('/favorite') && route.request().method() === 'POST') {
      if (favoriteFailure && !failedOnce) {
        failedOnce = true;
        return route.fulfill({ status: 500, json: { error: 'Not saved' } });
      }
      return route.fulfill({ json: { favorite: true } });
    }
    if (path.endsWith('/me')) return route.fulfill({ json: { favorite: false } });
    if (path.endsWith('/trust')) return route.fulfill({ json: {} });
    if (path.startsWith('/api/places/nearby')) return route.fulfill({ json: { items: [] } });
    if (path.startsWith('/api/halo/v1/places/')) return route.fulfill({ json: { item: null } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
  return { events, requests };
}

test('WA-002 defaults to opt-out: no status check or event POST even on public places', async ({ page }) => {
  const traffic = await serveTelemetrySite(page);
  await page.goto('/place/41');
  await expect(page.getByRole('heading', { name: 'Địa điểm thử nghiệm 41', level: 1 })).toBeVisible();
  await expect(page.getByTestId('xhub-consent-allow')).toBeVisible();
  await page.getByTestId('xhub-consent-deny').click();
  await page.goto('/place/42');
  await expect(page.getByRole('heading', { name: 'Địa điểm thử nghiệm 42', level: 1 })).toBeVisible();
  expect(traffic.requests).toEqual([]);
});

test('WA-002 sends one public place view per opened detail and no PII', async ({ page }) => {
  const traffic = await serveTelemetrySite(page);
  await page.goto('/place/40');
  await page.getByTestId('xhub-consent-allow').click();
  await expect.poll(() => traffic.events.some((e) => e.name === 'page_view')).toBe(true);

  for (const id of [41, 42, 43]) {
    await page.goto('/place/' + id);
    await expect(page.getByRole('heading', {
      name: 'Địa điểm thử nghiệm ' + id, level: 1
    })).toBeVisible();
    await expect.poll(() => traffic.events.filter((e) =>
      e.name === 'map_place_view' && e.entityKey === String(id)).length
    ).toBe(1);
  }
  const detail = traffic.events.filter((e) => e.name === 'map_place_view');
  // Place 40 may legitimately be tracked immediately after opt-in.
  // Still assert exactly one event for each subsequently opened detail.
  expect(detail.filter((e) => e.entityKey !== '40')
    .map((e) => e.entityKey)).toEqual(['41', '42', '43']);
  expect(detail.filter((e) => e.entityKey === '40').length).toBeLessThanOrEqual(1);
  expect(detail.every((e) => e.schemaVersion === 1 && e.consent === true &&
    e.path === '/place' && e.entityType === 'place')).toBe(true);
  const contents = JSON.stringify(traffic.events);
  expect(contents).not.toContain('0987654321');
  expect(contents).not.toContain('21.01354');
  expect(contents).not.toContain('105.52522');
  expect(contents).not.toContain('Không gửi nội dung này');
  expect(contents).not.toContain('User QA');
  await page.getByTestId('xhub-consent-settings').click();
  await page.getByTestId('xhub-consent-deny').click();
  const count = traffic.events.length;
  await page.goto('/place/44');
  await expect(page.getByRole('heading', { name: 'Địa điểm thử nghiệm 44', level: 1 })).toBeVisible();
  expect(traffic.events.length).toBe(count);
});

test('WA-002 fires directions and favorite_added only on successful favorite API', async ({ page, context }) => {
  const traffic = await serveTelemetrySite(page, { loggedIn: true, favoriteFailure: true });
  await context.route('https://www.google.com/**', (route) => route.abort());
  await page.goto('/place/51');
  await page.getByTestId('xhub-consent-allow').click();
  await expect.poll(() => traffic.events.some((e) => e.name === 'page_view')).toBe(true);

  await page.getByRole('link', { name: 'Chỉ đường', exact: true }).click();
  await expect.poll(() => traffic.events.filter((e) => e.name === 'map_directions_click').length).toBe(1);

  const save = page.getByRole('button', { name: 'Lưu', exact: true });
  await save.click();
  await expect(page.getByText('Not saved')).toBeVisible();
  expect(traffic.events.filter((e) => e.name === 'favorite_added')).toHaveLength(0);
  await save.click();
  await expect.poll(() => traffic.events.filter((e) => e.name === 'favorite_added').length).toBe(1);
  const added = traffic.events.find((e) => e.name === 'favorite_added');
  expect(added.entityKey).toBe('51');
  expect(added.entityType).toBe('place');
  expect(JSON.stringify(added)).not.toContain('User QA');
});

test('WA-002 honors Global Privacy Control and disables the consent opt-in', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      configurable: true, value: true
    });
  });
  const traffic = await serveTelemetrySite(page);
  await page.goto('/place/62');
  await expect(page.getByTestId('xhub-consent-allow')).toBeDisabled();
  await expect(page.getByText(/GPC\/Do Not Track/)).toBeVisible();
  expect(traffic.requests).toEqual([]);
});
