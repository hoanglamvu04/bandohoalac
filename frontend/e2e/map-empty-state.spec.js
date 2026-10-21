import { test, expect } from '@playwright/test';

async function stubEmptyMap(page) {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    const body = url.includes('/api/map-layers')
      ? { type: 'FeatureCollection', features: [] }
      : { items: [], data: [], total: 0, ok: true };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body)
    });
  });
}

// Match the actual desktop rail breakpoints, including a short laptop window.
for (const viewport of [
  { width: 1024, height: 600 },
  { width: 1228, height: 691 },
  { width: 1365, height: 768 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 }
]) {
  test(`empty map sidebar has readable stacked actions at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubEmptyMap(page);
    await page.goto('/map', { waitUntil: 'domcontentloaded' });

    const empty = page.locator('.hm-left-panel .hm-place-empty:not(.compact)');
    await expect(empty).toBeVisible();
    await expect(empty.locator(':scope > b')).toHaveCSS('font-size', '16px');
    await expect(empty.locator(':scope > b')).toHaveCSS('text-wrap', 'balance');
    await expect(empty.locator(':scope > p')).toHaveCSS('font-size', '13px');

    const buttons = empty.locator('.hm-place-empty-actions > button');
    await expect(buttons).toHaveCount(2);
    const layout = await empty.evaluate((card) => {
      const bounds = card.getBoundingClientRect();
      const actions = card.querySelector('.hm-place-empty-actions');
      return {
        cardOverflow: card.scrollWidth - card.clientWidth,
        actionsOverflow: actions.scrollWidth - actions.clientWidth,
        buttons: [...actions.children].map((button) => {
          const box = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          const icon = button.querySelector('svg').getBoundingClientRect();
          const textNode = [...button.childNodes].find((node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent.trim()
          );
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const lines = [...range.getClientRects()].filter((rect) => rect.width > 0);
          return {
            x: box.x, y: box.y, width: box.width, height: box.height,
            inside: box.left >= bounds.left && box.right <= bounds.right + 1,
            overflow: button.scrollWidth - button.clientWidth,
            fontSize: style.fontSize,
            iconWidth: icon.width,
            lineCount: lines.length
          };
        })
      };
    });

    expect(layout.cardOverflow).toBeLessThanOrEqual(1);
    expect(layout.actionsOverflow).toBeLessThanOrEqual(1);
    const [first, second] = layout.buttons;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height + 7);
    expect(Math.abs(first.x - second.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
    for (const button of layout.buttons) {
      expect(button.inside).toBe(true);
      expect(button.overflow).toBeLessThanOrEqual(1);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.fontSize).toBe('14px');
      expect(button.iconWidth).toBeGreaterThanOrEqual(15);
      expect(button.lineCount).toBe(1);
    }

    // Tall copy must scroll in the list, not get trapped behind the layer footer.
    for (let i = 0; i < 2; i += 1) {
      await buttons.nth(i).scrollIntoViewIfNeeded();
      await buttons.nth(i).click({ trial: true });
    }
  });
}

test('a long unbroken search query stays inside the empty-state card', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await stubEmptyMap(page);
  const query = 'x'.repeat(120);
  await page.goto('/map?q=' + query, { waitUntil: 'domcontentloaded' });
  const empty = page.locator('.hm-left-panel .hm-place-empty.compact');
  await expect(empty).toBeVisible();
  await expect(empty.locator(':scope > b')).toContainText(query);
  const overflow = await empty.evaluate((card) => {
    const title = card.querySelector('b');
    return Math.max(card.scrollWidth - card.clientWidth, title.scrollWidth - title.clientWidth);
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await empty.locator('.hm-place-empty-reset').click({ trial: true });
});
