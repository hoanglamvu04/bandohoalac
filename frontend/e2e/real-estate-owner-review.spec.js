import { expect, test } from '@playwright/test';

test('owner sees unpublished property submissions and rejection reasons without a public link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 77, role: 'USER', name: 'Người đăng' }
    } });
    if (url.pathname === '/api/housing/mine') return route.fulfill({ json: { items: [{
      id: '9001', name: 'Nhà đã đăng', address: 'Hòa Lạc',
      listingType: 'SALE', listingStatus: 'ACTIVE', placeStatus: 'PUBLISHED',
      totalPriceVnd: 3500000000, areaM2: 90
    }] } });
    if (url.pathname === '/api/contributions/me') return route.fulfill({ json: { items: [
      { id: 410, type: 'CREATE_PLACE', status: 'PENDING', payload: { place: {
        categorySlug: 'bat-dong-san', name: 'Nhà đang xét duyệt', address: 'Thạch Thất',
        realEstate: { transactionType: 'SALE', areaM2: 88, totalPriceVnd: 2300000000 }
      } } },
      { id: 411, type: 'CREATE_PLACE', status: 'REJECTED',
        rejectReason: 'Ảnh không đúng nhà được đăng.', payload: { place: {
          categorySlug: 'bat-dong-san', name: 'Đất cần chỉnh sửa', address: 'Hòa Lạc',
          realEstate: { transactionType: 'RENT', areaM2: 120, monthlyRentVnd: 3000000 }
        } } },
      { id: 412, type: 'CREATE_PLACE', status: 'PENDING', payload: { place: {
        categorySlug: 'cafe', name: 'Địa điểm khác'
      } } },
      { id: 413, type: 'CREATE_PLACE', status: 'APPROVED', payload: { place: {
        categorySlug: 'bat-dong-san', name: 'Tin đã duyệt',
        realEstate: { transactionType: 'SALE', totalPriceVnd: 1200000000 }
      } } }
    ] } });
    return route.fulfill({ json: { items: [], ok: true } });
  });

  await page.goto('/tin-bat-dong-san-cua-toi');
  const queue = page.getByTestId('estate-owner-review-queue');
  await expect(queue).toBeVisible();
  await expect(page.getByTestId('my-estate-9001')).toBeVisible();
  const pending = page.getByTestId('estate-submission-410');
  const rejected = page.getByTestId('estate-submission-411');
  await expect(pending).toContainText('Chờ Admin duyệt');
  await expect(pending).toContainText('Nhà đang xét duyệt');
  await expect(pending.getByRole('link', { name: 'Xem tin công khai' })).toHaveCount(0);
  await expect(rejected).toContainText('Đã từ chối');
  await expect(rejected).toContainText('Ảnh không đúng nhà được đăng.');
  await expect(rejected.getByRole('link', { name: 'Tạo tin mới sau khi chỉnh sửa' })).toBeVisible();
  await expect(queue.getByText('Địa điểm khác')).toHaveCount(0);
  await expect(queue.getByText('Tin đã duyệt')).toHaveCount(0);
});

test('unavailable contribution history does not hide published owner listings', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') return route.fulfill({ json: {
      token: 'test-session', user: { id: 77, role: 'USER' }
    } });
    if (path === '/api/contributions/me') return route.fulfill({
      status: 503, json: { error: 'Temporarily unavailable' }
    });
    if (path === '/api/housing/mine') return route.fulfill({ json: { items: [{
      id: '9100', name: 'Tin còn hoạt động', address: 'Hòa Lạc',
      listingType: 'SALE', listingStatus: 'ACTIVE', placeStatus: 'PUBLISHED',
      totalPriceVnd: 1200000000
    }] } });
    return route.fulfill({ json: { items: [], ok: true } });
  });
  await page.goto('/tin-bat-dong-san-cua-toi');
  await expect(page.getByTestId('my-estate-9100')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Chưa tải được trạng thái tin chờ duyệt');
});
