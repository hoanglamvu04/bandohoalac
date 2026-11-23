import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  discoveryScore, rankDiscoveryItems
} from '../src/services/smartDiscoveryRanking.service.js';
import {
  createTravelTimeDiscovery
} from '../src/services/travelTimeDiscovery.service.js';
import { travelTimeQuerySchema } from '../src/validators/place.validators.js';

const FPT = { id: '10', name: 'Trường Đại học FPT',
  lat: 21.0135, lng: 105.5252, status: 'PUBLISHED' };
const places = [
  { id: 10, name: 'Trường Đại học FPT', lat: FPT.lat, lng: FPT.lng,
    status: 'PUBLISHED', categorySlug: 'truong-hoc' },
  { id: 11, name: 'Cà phê gần FPT', lat: 21.0136, lng: 105.5253,
    status: 'PUBLISHED', categorySlug: 'cafe', rating: 4.6, reviews: 15, distance: 120 },
  { id: 12, name: 'Quán cà phê', lat: 21.0142, lng: 105.5260,
    status: 'PUBLISHED', categorySlug: 'cafe', rating: 4.7, reviews: 90, distance: 260 },
  { id: 13, name: 'Quán trọ', lat: 21.017, lng: 105.530,
    status: 'PUBLISHED', categorySlug: 'bat-dong-san', distance: 600 },
  { id: 14, name: 'Đã xóa', lat: 21.015, lng: 105.531,
    status: 'ARCHIVED', categorySlug: 'cafe', distance: 700 },
  { id: 15, name: 'Không có đường đi', lat: 21.025, lng: 105.546,
    status: 'PUBLISHED', categorySlug: 'cafe', distance: 1800 }
];

test('Smart Rank V3 prioritizes exact names over weak description/address and ignores partner monetization', () => {
  const exact = { id: 1, name: 'Cà phê FPT', rating: 4.2, reviews: 20 };
  const distant = { id: 2, name: 'Cửa hàng', address: 'Cà phê FPT', rating: 5, reviews: 100 };
  assert.ok(discoveryScore(exact, { query: 'ca phe fpt' }) >
    discoveryScore(distant, { query: 'ca phe fpt' }));
  const a = { ...exact, isPartner: true };
  const b = { ...exact, isPartner: false };
  assert.equal(discoveryScore(a, { query: 'Cà phê FPT' }),
    discoveryScore(b, { query: 'Cà phê FPT' }));
  assert.deepEqual(rankDiscoveryItems([distant, exact], { query: 'cafe fpt' })
    .map((v) => v.id), [1, 2]);
});

test('Smart Rank V3 rewards recent verification, bayesian reviews and closer near-anchor results', () => {
  const now = new Date('2026-11-23T00:00:00Z').getTime();
  const shared = { name: 'Nhà hàng Hòa Lạc', rating: 4.5, images: ['image.webp'] };
  const newer = { ...shared, lastVerifiedAt: '2026-11-20T00:00:00Z', reviews: 40 };
  const older = { ...shared, lastVerifiedAt: '2023-01-01T00:00:00Z', reviews: 1 };
  assert.ok(discoveryScore(newer, { now, query: 'nhà hàng' }) >
    discoveryScore(older, { now, query: 'nhà hàng' }));
  assert.ok(discoveryScore({ ...newer, distance: 100 }, { now, nearAnchor: true }) >
    discoveryScore({ ...newer, distance: 4000 }, { now, nearAnchor: true }));
  assert.deepEqual(rankDiscoveryItems([{ id: 5 }, { id: 6 }]).map(v => v.id), [5, 6]);
});

test('Travel-time query rejects arbitrary coords, minutes and unsupported profiles', () => {
  const good = travelTimeQuerySchema.safeParse({
    anchor: 'fpt', minutes: '10', category: 'bat-dong-san', limit: '12'
  });
  assert.equal(good.success, true);
  for (const payload of [
    { anchor: 'fpt', minutes: '7' },
    { anchor: 'home', minutes: '10' },
    { anchor: 'fpt', minutes: '10', lat: '21.1', lng: '105.1' },
    { anchor: 'fpt', minutes: '10', category: 'all&auth=1' },
    { anchor: 'fpt', minutes: '10', profile: 'walking' },
    { anchor: 'fpt', minutes: '10', limit: '200' }
  ]) {
    assert.equal(travelTimeQuerySchema.safeParse(payload).success, false,
      JSON.stringify(payload));
  }
});

test('OSRM driving-time discovery filters unreachable/archived and never uses air distance as minutes', async () => {
  const received = [];
  let callCount = 0;
  const svc = createTravelTimeDiscovery({
    resolveLandmark: async (query) => {
      assert.equal(query, 'FPT');
      return { anchor: FPT };
    },
    listNearby: async (opts) => {
      assert.equal(opts.category, undefined);
      assert.equal(opts.status, 'PUBLISHED');
      assert.ok(opts.radius <= 25_000);
      return places;
    },
    routingBaseUrl: 'http://127.0.0.1:5001',
    routingFetch: async (url, opts) => {
      callCount++;
      received.push({ url: new URL(url), opts });
      assert.equal(opts.method, 'GET');
      return {
        ok: true,
        json: async () => ({ code: 'Ok', durations: [[0, 180, 290, 750, null]] })
      };
    },
    clock: () => 1_000
  });
  const result = await svc.search({ anchor: 'fpt', minutes: 5, limit: 12 });
  assert.equal(result.meta.provider, 'OSRM');
  assert.equal(result.meta.method, 'road-network-duration');
  assert.equal(result.minutes, 5);
  assert.deepEqual(result.items.map(x => x.id), [11, 12]);
  assert.deepEqual(result.items.map(x => x.travelMinutes), [3, 4.8]);
  assert.equal(result.items.some(x => x.id === 14 || x.id === 10), false);
  assert.equal(received[0].url.searchParams.get('sources'), '0');
  assert.equal(received[0].url.searchParams.get('annotations'), 'duration');
  assert.equal(received[0].url.pathname.split(';').length, 5);
  assert.equal(callCount, 1);
  const cached = await svc.search({ anchor: 'fpt', minutes: 5, limit: 12 });
  assert.deepEqual(cached, result);
  assert.equal(callCount, 1, 'same query must share the cached OSRM response');
});

test('OSRM errors, invalid matrix and unknown landmark fail closed without synthetic times', async () => {
  const base = {
    resolveLandmark: async () => ({ anchor: FPT }),
    listNearby: async () => [places[1]],
    routingBaseUrl: 'http://127.0.0.1:5001'
  };
  for (const routingFetch of [
    async () => { throw Error('OSRM offline'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => ({
      code: 'Ok', durations: [[0]]
    }) })
  ]) {
    const svc = createTravelTimeDiscovery({ ...base, routingFetch });
    await assert.rejects(() => svc.search({ anchor: 'fpt', minutes: 10 }),
      err => err.statusCode === 503);
  }
  const missing = createTravelTimeDiscovery({
    ...base, resolveLandmark: async () => ({ anchor: null })
  });
  await assert.rejects(() => missing.search({ anchor: 'fpt', minutes: 10 }),
    err => err.statusCode === 404);
  const svc = createTravelTimeDiscovery(base);
  await assert.rejects(() => svc.search({ anchor: 'outside', minutes: 20 }),
    err => err.statusCode === 400);
});

test('OSRM duration rankings are fastest first and are never replaced by paid placement', async () => {
  const svc = createTravelTimeDiscovery({
    resolveLandmark: async () => ({ anchor: FPT }),
    listNearby: async () => [places[1], places[2]],
    routingBaseUrl: 'http://127.0.0.1:5001',
    routingFetch: async () => ({ ok: true, json: async () => ({
      code: 'Ok', durations: [[0, 310, 140]]
    }) })
  });
  const result = await svc.search({ anchor: 'fpt', minutes: 10, limit: 2 });
  assert.deepEqual(result.items.map(x => x.id), [12, 11]);
  assert.deepEqual(result.items.map(x => x.durationSeconds), [140, 310]);
});
