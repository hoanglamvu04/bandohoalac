import { test, expect } from '@playwright/test';

const housing = {
  id:4683, name:'Nhà trọ test tại Thạch Hòa',
  slug:'can-tro-test-4683', category:'Bất động sản',
  categorySlug:'bat-dong-san',
  status:'PUBLISHED', lat:21.01354, lng:105.52522, address:'Thạch Hòa',
  images:[], phone:null,
  housing:{
    listingType:'RENT', monthlyRent:2900000, areaM2:26,
    availabilityStatus:'AVAILABLE', availableRooms:1,
    contactName:'Người cho thuê thử nghiệm', contactZalo:null
  }
};

function mockHousingApi(page, loggedIn = false, requestCounter = { count:0 }) {
  return page.route('**/api/**', (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/api/auth/refresh') {
      return route.fulfill(loggedIn
        ? { json:{ token:'testing-token', user:{ id:7, role:'USER', email:'qa@example.invalid' } } }
        : { status:401, json:{ error:'Unauthorized' } });
    }
    if (u.pathname === '/api/housing') {
      return route.fulfill({ json:{
        items:[housing],meta:{ total:1,count:1,hasMore:false }
      } });
    }
    if (u.pathname === '/api/housing/4683/contact') {
      requestCounter.count++;
      return route.fulfill({ json:{ contact:{
        contactName:'Người cho thuê thử nghiệm', phone:'0912345678', zalo:null, isDemo:false
      } } });
    }
    if (u.pathname === '/api/map-layers') {
      return route.fulfill({ json:{type:'FeatureCollection',features:[]} });
    }
    if (u.pathname.startsWith('/api/places')) {
      return route.fulfill({ json:{ items:[housing],total:1,hasMore:false } });
    }
    return route.fulfill({ json:{ items:[], ok:true } });
  });
}

test('housing map shows real price badge and anonymous visitor gets login gate, not a number', async ({ page }) => {
  await page.setViewportSize({ width:1280, height:800 });
  const calls = { count:0 };
  await mockHousingApi(page, false, calls);
  await page.goto('/map?vertical=housing&category=bat-dong-san', { waitUntil:'domcontentloaded' });
  await expect(page.locator('.hm-map-shell')).toBeVisible();
  await expect.poll(async () => {
    try {
      return await page.evaluate(() =>
        Boolean(window.__HOLA_MAP_INSTANCE__?.getLayer('hm-housing-price-label'))
      );
    } catch {
      // App/map can still navigate during the first render in a cold browser.
      return false;
    }
  }, { timeout:20000 }).toBe(true);
  await page.evaluate(() => window.__HOLA_MAP_INSTANCE__.jumpTo({
    center:[105.52522,21.01354], zoom:16
  }));
  await expect.poll(() => page.evaluate(() => {
    const map = window.__HOLA_MAP_INSTANCE__;
    if (!map?.getLayer('hm-housing-price-label')) return '';
    const features = map.queryRenderedFeatures({ layers:['hm-housing-price-label'] });
    return features[0]?.properties?.priceLabel || '';
  }), { timeout:20000 }).toBe('2,9 tr/th');

  await expect(page.getByText('Nhà trọ test tại Thạch Hòa').first()).toBeVisible();
  await page.getByText('Nhà trọ test tại Thạch Hòa').first().click();
  await expect(page.getByRole('link', { name:'Đăng nhập để hiện số' })).toBeVisible();
  expect(calls.count).toBe(0);
  await expect(page.getByText('0912345678')).toHaveCount(0);
});

test('logged-in member must explicitly click to reveal phone in housing inspector', async ({ page }) => {
  const calls = { count:0 };
  await mockHousingApi(page, true, calls);
  await page.goto('/map?vertical=housing&category=bat-dong-san', { waitUntil:'domcontentloaded' });
  await expect(page.getByText('Nhà trọ test tại Thạch Hòa').first()).toBeVisible();
  await page.getByText('Nhà trọ test tại Thạch Hòa').first().click();
  await expect(page.getByRole('button', { name:'Hiện số điện thoại' })).toBeVisible();
  expect(calls.count).toBe(0);
  await page.getByRole('button', { name:'Hiện số điện thoại' }).click();
  await expect(page.getByRole('link', { name:'0912345678' })).toBeVisible();
  expect(calls.count).toBe(1);
});
