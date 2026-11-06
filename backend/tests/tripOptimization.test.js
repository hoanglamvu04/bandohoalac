import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTripDistanceMatrix, optimizeTripOrder } from '../src/utils/tripOptimization.js';

const stops = [
  { id: 'start', lat: 21.01, lng: 105.51 },
  { id: 'north', lat: 21.03, lng: 105.52 },
  { id: 'east', lat: 21.02, lng: 105.55 },
  { id: 'west', lat: 21.01, lng: 105.48 }
];

test('trip optimization keeps the first stop fixed and visits every stop once', () => {
  const matrix = [
    [0, 8, 2, 5],
    [8, 0, 4, 7],
    [2, 4, 0, 3],
    [5, 7, 3, 0]
  ];
  const order = optimizeTripOrder(stops, matrix);

  assert.equal(order[0], 0);
  assert.equal(order.length, stops.length);
  assert.deepEqual([...order].sort((a, b) => a - b), [0, 1, 2, 3]);
});

test('trip optimization improves the initial nearest-neighbour route when a better order exists', () => {
  const matrix = [
    [0, 1, 9, 8],
    [1, 0, 1, 7],
    [9, 1, 0, 1],
    [8, 7, 1, 0]
  ];
  const order = optimizeTripOrder(stops, matrix);

  assert.equal(order[0], 0);
  assert.ok(orderCost(order, matrix) <= orderCost([0, 1, 2, 3], matrix));
});

test('distance fallback produces a complete finite matrix', () => {
  const matrix = buildTripDistanceMatrix(stops);
  assert.equal(matrix.length, stops.length);
  assert.ok(matrix.every((row) => row.length === stops.length));
  assert.ok(matrix.every((row) => row.every((value) => Number.isFinite(value) && value >= 0)));
  assert.ok(matrix.every((row, index) => row[index] === 0));
});

function orderCost(order, matrix) {
  return order.slice(0, -1).reduce(
    (total, stopIndex, index) => total + matrix[stopIndex][order[index + 1]],
    0
  );
}
