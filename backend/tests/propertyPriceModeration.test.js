import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRealEstateReviewer } from '../src/services/admin.service.js';

function fakeDb(slug) {
  return {
    query: async () => ({ rows: [{ slug }] })
  };
}

test('CTV cannot approve legacy unstructured property price updates', async () => {
  const contribution = {
    type: 'UPDATE_PRICE',
    place_id: 101,
    payload: { place: { price: '3 tỷ' } }
  };
  await assert.rejects(
    () => assertRealEstateReviewer(contribution, { role: 'CTV' }, fakeDb('bat-dong-san')),
    (error) => error.statusCode === 403
  );
});

test('Admin can review structured numeric property price requests', async () => {
  const contribution = {
    type: 'UPDATE_PRICE',
    place_id: 101,
    payload: { place: { realEstatePriceVnd: 3200000000 } }
  };
  const result = await assertRealEstateReviewer(contribution, { role: 'ADMIN' }, fakeDb('bat-dong-san'));
  assert.equal(result, true);
});

test('Other location categories retain normal price moderation', async () => {
  const contribution = {
    type: 'UPDATE_PRICE',
    place_id: 101,
    payload: { place: { price: '30.000đ' } }
  };
  const result = await assertRealEstateReviewer(contribution, { role: 'CTV' }, fakeDb('cafe'));
  assert.equal(result, false);
});

test('CTV cannot approve pre-consent legacy property submissions', async () => {
  const contribution = {
    type: 'CREATE_PLACE',
    payload: { place: { name: 'Căn hộ cũ', categorySlug: 'bat-dong-san' } }
  };
  await assert.rejects(
    () => assertRealEstateReviewer(contribution, { role: 'CTV' }, fakeDb('bat-dong-san')),
    (error) => error.statusCode === 403
  );
});
