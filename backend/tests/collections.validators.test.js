import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCollectionPlaceSchema,
  createCollectionSchema,
  replaceCollectionPlacesSchema,
  updateCollectionSchema
} from '../src/validators/collections.validators.js';

test('collection creation accepts private and public visibility', () => {
  const privateResult = createCollectionSchema.safeParse({
    title: 'Cafe học tập tại Hòa Lạc'
  });
  const publicResult = createCollectionSchema.safeParse({
    title: 'Quán ăn ngon dưới 100K',
    description: 'Danh sách do cộng đồng gợi ý.',
    visibility: 'PUBLIC'
  });

  assert.equal(privateResult.success, true);
  assert.equal(privateResult.data.visibility, 'PRIVATE');
  assert.equal(publicResult.success, true);
  assert.equal(publicResult.data.visibility, 'PUBLIC');
});

test('collection creation rejects short titles and unsupported visibility', () => {
  assert.equal(createCollectionSchema.safeParse({ title: 'A' }).success, false);
  assert.equal(
    createCollectionSchema.safeParse({ title: 'Danh sách', visibility: 'UNLISTED' }).success,
    false
  );
});

test('collection updates require at least one valid field', () => {
  assert.equal(updateCollectionSchema.safeParse({}).success, false);
  assert.equal(updateCollectionSchema.safeParse({ description: 'Cuối tuần' }).success, true);
});

test('collection place updates reject duplicates and more than 100 places', () => {
  assert.equal(replaceCollectionPlacesSchema.safeParse({ placeIds: [1, 2, 3] }).success, true);
  assert.equal(replaceCollectionPlacesSchema.safeParse({ placeIds: [1, 1] }).success, false);
  assert.equal(
    replaceCollectionPlacesSchema.safeParse({
      placeIds: Array.from({ length: 101 }, (_, index) => index + 1)
    }).success,
    false
  );
});

test('adding a collection place requires a positive integer ID', () => {
  assert.equal(addCollectionPlaceSchema.safeParse({ placeId: 10 }).success, true);
  assert.equal(addCollectionPlaceSchema.safeParse({ placeId: 0 }).success, false);
  assert.equal(addCollectionPlaceSchema.safeParse({ placeId: 'abc' }).success, false);
});
