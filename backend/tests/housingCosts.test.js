import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateHousingCosts } from '../../frontend/src/lib/housingCosts.js';

test('rental estimate uses actual quantities and includes deposit once',()=>{
  const result=estimateHousingCosts({monthlyRent:2900000,depositAmount:2900000,electricityPricePerKwh:3500,waterPricePerPersonMonth:100000,parkingFeeMonthly:100000},{people:2,kwh:80,vehicles:1});
  assert.equal(result.knownMonthly,3480000);
  assert.equal(result.knownFirstMonth,6380000);
  assert.deepEqual(result.missingFirstMonth,[]);
});
test('unknown and explicit free fees remain distinct; zero use needs no unit price',()=>{
  const result=estimateHousingCosts({monthlyRent:2000000,depositAmount:0,electricityPricePerKwh:null,waterPricePerPersonMonth:0},{people:1,kwh:80,vehicles:0});
  assert.equal(result.knownFirstMonth,2000000);
  assert.deepEqual(result.missingFirstMonth,['Tiền điện']);
  assert.equal(estimateHousingCosts({}, {people:0,kwh:80,vehicles:1}),null);
});
