import { test, expect } from '@playwright/test';

async function mockApi(page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({status:401,json:{}});
    if (path === '/api/map-layers') return route.fulfill({json:{type:'FeatureCollection',features:[]}});
    return route.fulfill({json:{items:[],total:0,ok:true}});
  });
}

for (const width of [1536,1280,1024,800]) {
  test('V8 desktop search, filter and map controls stay in map column at ' + width, async ({page}) => {
    await page.setViewportSize({width,height:820});
    await mockApi(page);
    await page.goto('/map', {waitUntil:'domcontentloaded'});
    await expect(page.locator('.map-ui-v8')).toBeVisible();
    const search = page.locator('.hm-search-v2');
    const filters = page.locator('.hm-discovery-filters');
    const sidebar = page.locator('.hm-left-panel');
    const surface = page.locator('.hm-map-shell');
    await expect(search).toBeVisible();
    await expect(filters).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(page.locator('.hm-locate')).toBeVisible();
    await expect(page.locator('.hm-my-location-filter')).toBeHidden();
    const [s,f,r,m] = await Promise.all([search.boundingBox(),filters.boundingBox(),sidebar.boundingBox(),surface.boundingBox()]);
    expect(s.x).toBeGreaterThanOrEqual(r.x+r.width-1);
    expect(m.x).toBeGreaterThanOrEqual(r.x+r.width-2);
    expect(f.y).toBeGreaterThanOrEqual(s.y+s.height-1);
    expect(f.x).toBeGreaterThanOrEqual(r.x+r.width-1);
    expect(f.x+f.width).toBeLessThanOrEqual(width+1);
    const control = page.locator('.hm-locate');
    const cb = await control.boundingBox();
    expect(cb.x+cb.width).toBeLessThanOrEqual(width+1);
    expect(cb.x).toBeGreaterThan(width-80);
    await page.locator('.hm-filter-trigger').click();
    const popup = page.locator('.hm-filter-popover');
    await expect(popup).toBeVisible();
    const box = await popup.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x+box.width).toBeLessThanOrEqual(width+2);
  });
}
test('V8 keeps search reachable after closing and reopening rail', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await mockApi(page);
  await page.goto('/map');
  await page.getByRole('button',{name:'Chuyển về bản đồ'}).click();
  const search=page.locator('.hm-search-v2');
  const menu=page.locator('.hm-map-menu');
  await expect(menu).toBeVisible();
  await expect(search).toBeVisible();
  expect((await search.boundingBox()).x).toBeLessThan(100);
  await menu.click();
  await expect(page.locator('.hm-workspace')).toHaveClass(/hm-workspace-split/);
});
test('V8 keeps mobile list and location controls intact', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await mockApi(page);
  await page.goto('/map');
  await expect(page.locator('.hm-mobile-list-toggle')).toBeVisible();
  await expect(page.locator('.hm-my-location-filter')).toBeVisible();
  await page.locator('.hm-mobile-list-toggle').click();
  await expect(page.locator('.hm-left-panel')).toHaveClass(/open/);
});
