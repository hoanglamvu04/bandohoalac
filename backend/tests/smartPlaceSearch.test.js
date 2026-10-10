import assert from 'node:assert/strict';
import test from 'node:test';
import {
  anchorCandidates,
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
