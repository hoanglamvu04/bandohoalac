import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partnerHousingSchema } from '../src/validators/housing.validators.js';

test('Housing V3: rejects invalid available room counts', () => {
  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'AVAILABLE', availableRooms: 0
  }).success, false);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'LIMITED', availableRooms: 0
  }).success, false);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'FULL', availableRooms: 3
  }).success, false);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'AVAILABLE', availableRooms: 3, totalRooms: 2
  }).success, false);
});

test('Housing V3: valid counts and unknown room count remain editable', () => {
  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'AVAILABLE', availableRooms: 1, totalRooms: 4
  }).success, true);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'FULL', availableRooms: 0, totalRooms: 4
  }).success, true);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'AVAILABLE', availableRooms: null, totalRooms: null
  }).success, true);

  assert.equal(partnerHousingSchema.safeParse({
    availabilityStatus: 'UNKNOWN', availableRooms: 0
  }).success, true);
});
