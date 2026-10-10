import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORE_SERVICE_AREAS,
  SERVICE_AREA_GEOMETRY,
  SERVICE_AREA_ZONES,
  isInsideServiceCoverage,
  serviceZoneForPoint
} from '../src/config/mapCoverage.js';

test('coverage is represented as nine distinct service zones', () => {
  assert.equal(CORE_SERVICE_AREAS.length, 9);
  assert.equal(SERVICE_AREA_ZONES.length, 9);
  assert.equal(SERVICE_AREA_GEOMETRY.type, 'MultiPolygon');
  assert.equal(SERVICE_AREA_GEOMETRY.coordinates.length, 9);
});

test('every configured commune center is inside coverage', () => {
  for (const zone of SERVICE_AREA_ZONES) {
    assert.equal(isInsideServiceCoverage(zone.center[0], zone.center[1]), true, zone.name);
    assert.equal(serviceZoneForPoint(zone.center[0], zone.center[1])?.id, zone.id);
  }
});

test('north-east spill area is not accepted only because it was inside the old envelope', () => {
  // Representative point toward the Đan Phượng/Phúc Thọ side which used to
  // fall inside the old single large polygon.
  assert.equal(isInsideServiceCoverage(105.675, 21.105), false);
});

test('far eastern Hoài Đức side is outside service coverage', () => {
  assert.equal(isInsideServiceCoverage(105.705, 21.025), false);
});
