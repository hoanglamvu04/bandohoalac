import { test, expect } from '@playwright/test';

test('HOLA Trip builds, reorders, optimizes and shares a multi-stop itinerary', async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const tripRequests = [];
  const places = [
    {
      id: '101',
      name: 'Nhà hàng Hòa Lạc',
      slug: 'nha-hang-hoa-lac',
      category: 'Nhà hàng',
      categorySlug: 'an-uong',
      address: 'Đại lộ Thăng Long, Hòa Lạc',
      lat: 21.01354,
      lng: 105.52522,
      rating: 4.6,
      reviews: 20,
      images: [],
      thumbnails: [],
      cardImages: [],
      status: 'PUBLISHED'
    },
    {
      id: '102',
      name: 'Cafe Xứ Đoài',
      slug: 'cafe-xu-doai',
      category: 'Cafe',
      categorySlug: 'cafe',
      address: 'Thạch Thất, Hòa Lạc',
      lat: 21.018,
      lng: 105.536,
      rating: 4.8,
      reviews: 15,
      images: [],
      thumbnails: [],
      cardImages: [],
      status: 'PUBLISHED'
    },
    {
      id: '103',
      name: 'Vườn hoa Hòa Lạc',
      slug: 'vuon-hoa-hoa-lac',
      category: 'Check-in',
      categorySlug: 'check-in',
      address: 'Yên Xuân, Hòa Lạc',
      lat: 21.024,
      lng: 105.541,
      rating: 4.7,
      reviews: 9,
      images: [],
      thumbnails: [],
      cardImages: [],
      status: 'PUBLISHED'
    }
  ];

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname === '/api/categories') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] })
      });
    }

    if (url.pathname === '/api/places/bounds') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: places, total: places.length, hasMore: false })
      });
    }

    if (url.pathname === '/api/directions/trip') {
      const body = route.request().postDataJSON();
      tripRequests.push(body);
      const stops = body.stops.map((stop, index) => ({ ...stop, order: index + 1 }));
      const legs = stops.slice(0, -1).map((stop, index) => ({
        index,
        fromStop: stop,
        toStop: stops[index + 1],
        distanceMeters: 1700,
        durationSeconds: 310,
        steps: []
      }));

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: 'OSRM',
          profile: 'driving',
          optimized: Boolean(body.optimize),
          optimizationMethod: body.optimize ? 'osrm-duration-matrix' : 'manual',
          stops,
          origin: stops[0],
          destination: stops[stops.length - 1],
          distanceMeters: 3400,
          durationSeconds: 620,
          geometry: {
            type: 'LineString',
            coordinates: stops.map((stop) => [stop.lng, stop.lat])
          },
          legs,
          steps: [],
          hazards: [{
            id: 'trip-road-closure',
            type: 'ROAD_CLOSURE',
            name: 'Đường tạm cấm',
            severity: 'HIGH',
            geometry: {
              type: 'Point',
              coordinates: [105.53, 21.015]
            }
          }],
          hazardCheckAvailable: true
        })
      });
    }

    const placeMatch = url.pathname.match(/^\\/api\\/places\\/(\\d+)$/);
    if (placeMatch) {
      const place = places.find((item) => item.id === placeMatch[1]);
      return route.fulfill({
        status: place ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(place || { message: 'Place not found' })
      });
    }

    if (url.pathname === '/api/map-layers') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ type: 'FeatureCollection', features: [] })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], data: [], ok: true })
    });
  });

  await page.goto('/map', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hm-place-row').first()).toBeVisible({ timeout: 20000 });

  await page.locator('.hm-place-row').nth(0).click();
  await page.locator('.hm-trip-add-place').click();
  await page.locator('.hm-place-row').nth(1).click();
  await page.locator('.hm-place-row').nth(2).click();

  const planner = page.locator('.hm-trip-panel');
  await expect(planner).toBeVisible();
  await expect(planner.locator('.hm-trip-stop')).toHaveCount(3);

  await planner.getByRole('button', { name: 'Đưa Cafe Xứ Đoài lên' }).click();
  await expect(planner.locator('.hm-trip-stop').first()).toContainText('Cafe Xứ Đoài');

  await planner.getByRole('button', { name: /Tính lịch trình/ }).click();
  await expect(planner).toContainText('3,4 km');
  await expect(planner).toContainText('Đường tạm cấm');
  await expect.poll(() => tripRequests.length).toBe(1);

  await planner.getByRole('button', { name: /Tối ưu thứ tự/ }).click();
  await expect.poll(() => tripRequests.length).toBe(2);
  expect(tripRequests[1].optimize).toBe(true);
  expect(tripRequests[1].stops[0].id).toBe('102');

  await planner.getByRole('button', { name: /Chia sẻ lịch trình/ }).click();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  expect(sharedUrl).toContain('trip=102.101.103');

  await page.goto(sharedUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.hm-trip-panel')).toBeVisible();
  await expect(page.locator('.hm-trip-stop')).toHaveCount(3);
  await expect(page.locator('.hm-trip-summary')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => tripRequests.length).toBe(3);
  expect(tripRequests[2].optimize).toBe(false);
});
