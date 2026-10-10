import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anchorCandidates,
  foldSearchText,
  selectBestAnchorMatch
} from '../src/services/smartPlaceSearch.service.js';

test('FPT alias tries the university canonical name before the raw keyword', () => {
  const candidates = anchorCandidates('FPT');
  assert.equal(candidates[0].query, 'Trường Đại học FPT');
  assert.equal(candidates[0].preferredCategory, 'truong-hoc');
});

test('FPT anchor prefers the university over a shop or bank carrying FPT keyword', () => {
  const candidate = anchorCandidates('FPT')[0];
  const selected = selectBestAnchorMatch([
    {
      id: 'shop',
      name: 'FPT Shop 03 Nguyễn Thái Học',
      categorySlug: 'sieu-thi',
      lat: 21.01,
      lng: 105.52
    },
    {
      id: 'bank',
      name: 'TPBank LiveBank FPT Polytechnic',
      categorySlug: 'ngan-hang-atm',
      lat: 21.02,
      lng: 105.53
    },
    {
      id: 'university',
      name: 'Trường Đại học FPT',
      categorySlug: 'truong-hoc',
      lat: 21.013,
      lng: 105.527
    }
  ], candidate);

  assert.equal(selected.id, 'university');
});

test('ĐHQG alias prefers an education landmark', () => {
  const candidate = anchorCandidates('đại học quốc gia')[0];
  const selected = selectBestAnchorMatch([
    {
      id: 'cafe',
      name: 'Cafe Đại học Quốc gia',
      categorySlug: 'cafe',
      lat: 21.01,
      lng: 105.5
    },
    {
      id: 'vnu',
      name: 'Đại học Quốc gia Hà Nội',
      categorySlug: 'truong-hoc',
      lat: 21.04,
      lng: 105.51
    }
  ], candidate);

  assert.equal(selected.id, 'vnu');
});

test('road anchors are valid search anchors with coordinates', () => {
  const candidate = anchorCandidates('Đường 420')[0];
  const selected = selectBestAnchorMatch([
    {
      id: 'map:420',
      resultType: 'road',
      name: 'Đường 420',
      categorySlug: 'duong',
      lat: 20.995,
      lng: 105.51
    },
    {
      id: 'place:420',
      name: 'Quán 420',
      categorySlug: 'an-uong',
      lat: 20.996,
      lng: 105.511
    }
  ], candidate);

  assert.equal(selected.id, 'map:420');
});

test('search folding handles Vietnamese street names consistently', () => {
  assert.equal(foldSearchText('Đường Tỉnh 420'), 'duong tinh 420');
  assert.equal(foldSearchText('ĐT.420'), 'dt 420');
});
