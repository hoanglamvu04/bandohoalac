import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCollectionItemSchema,
  createCollectionSchema,
  updateCollectionSchema
} from '../src/validators/collection.validators.js';

test('collection creation trims title and defaults to private', () => {
  const result = createCollectionSchema.parse({
    title: '  Cafe học tập tại Hòa Lạc  ',
    description: '  Những góc yên tĩnh  '
  });

  assert.equal(result.title, 'Cafe học tập tại Hòa Lạc');
  assert.equal(result.description, 'Những góc yên tĩnh');
  assert.equal(result.visibility, 'PRIVATE');
});

test('collection visibility accepts only public or private', () => {
  assert.equal(createCollectionSchema.safeParse({
    title: 'Điểm check-in',
    visibility: 'PUBLIC'
  }).success, true);
  assert.equal(createCollectionSchema.safeParse({
    title: 'Điểm check-in',
    visibility: 'UNLISTED'
  }).success, false);
});

test('collection update must contain at least one editable field', () => {
  assert.equal(updateCollectionSchema.safeParse({}).success, false);
  assert.equal(updateCollectionSchema.safeParse({ visibility: 'PUBLIC' }).success, true);
});

test('collection items require a positive place id', () => {
  assert.equal(addCollectionItemSchema.safeParse({ placeId: 42 }).success, true);
  assert.equal(addCollectionItemSchema.safeParse({ placeId: 0 }).success, false);
});
