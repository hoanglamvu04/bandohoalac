import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FOUNDATION_POI_CATEGORIES,
  foundationConfidenceForCategory
} from '../src/services/foundationPoi.service.js';

test('foundation POI policy prioritizes stable anchors over commercial POIs', () => {
  assert.ok(FOUNDATION_POI_CATEGORIES.includes('truong-hoc'));
  assert.ok(FOUNDATION_POI_CATEGORIES.includes('y-te'));
  assert.ok(FOUNDATION_POI_CATEGORIES.includes('cafe'));
  assert.ok(FOUNDATION_POI_CATEGORIES.includes('an-uong'));

  assert.equal(foundationConfidenceForCategory('truong-hoc'), 0.78);
  assert.equal(foundationConfidenceForCategory('y-te'), 0.80);
  assert.equal(foundationConfidenceForCategory('cafe'), 0.90);
  assert.equal(foundationConfidenceForCategory('an-uong'), 0.90);
  assert.equal(foundationConfidenceForCategory('unknown'), null);

  assert.ok(
    foundationConfidenceForCategory('truong-hoc') < foundationConfidenceForCategory('cafe')
  );
});
