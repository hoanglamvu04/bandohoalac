import assert from 'node:assert/strict';
import test from 'node:test';
import { SERVICE_AREA_ZONES } from '../src/config/mapCoverage.js';
import { tripDirectionsBodySchema } from '../src/validators/directions.validators.js';

const validStops = [
  {
    id: '101',
    name: 'Nhà hàng Hòa Lạc',
    lng: SERVICE_AREA_ZONES[1].center[0],
    lat: SERVICE_AREA_ZONES[1].center[1]
  },
  {
    id: '102',
    name: 'Cafe Xứ Đoài',
    lng: SERVICE_AREA_ZONES[0].center[0],
    lat: SERVICE_AREA_ZONES[0].center[1]
  }
];

test('trip directions accepts 2-12 stops inside the service coverage', () => {
  const result = tripDirectionsBodySchema.safeParse({
    stops: validStops,
    optimize: true,
    profile: 'driving'
  });

  assert.equal(result.success, true);
  assert.equal(result.data.stops.length, 2);
  assert.equal(result.data.optimize, true);
});

test('trip directions rejects fewer than two or more than twelve stops', () => {
  assert.equal(
    tripDirectionsBodySchema.safeParse({ stops: [validStops[0]] }).success,
    false
  );

  const tooManyStops = Array.from({ length: 13 }, (_, index) => ({
    ...validStops[index % validStops.length],
    id: 'place-' + index
  }));
  assert.equal(
    tripDirectionsBodySchema.safeParse({ stops: tooManyStops }).success,
    false
  );
});

test('trip directions rejects duplicate places and stops outside service coverage', () => {
  assert.equal(
    tripDirectionsBodySchema.safeParse({
      stops: [validStops[0], { ...validStops[1], id: validStops[0].id }]
    }).success,
    false
  );

  assert.equal(
    tripDirectionsBodySchema.safeParse({
      stops: [
        validStops[0],
        { id: 'outside', name: 'Ngoài vùng', lat: 21.5, lng: 105.9 }
      ]
    }).success,
    false
  );
});

test('trip directions only accepts the driving profile in this engine phase', () => {
  assert.equal(
    tripDirectionsBodySchema.safeParse({
      stops: validStops,
      profile: 'walking'
    }).success,
    false
  );
});
