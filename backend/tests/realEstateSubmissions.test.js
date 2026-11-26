import test from 'node:test';
import assert from 'node:assert/strict';
import { createContributionSchema } from '../src/validators/contribution.validators.js';

const base = {
  type: 'CREATE_PLACE',
  location: { lat: 21.01354, lng: 105.52522 },
  place: {
    name: 'Nhà phố thử nghiệm Hòa Lạc',
    categorySlug: 'bat-dong-san',
    address: 'Thạch Thất, Hà Nội',
    phone: '0987654321',
    realEstate: {
      transactionType: 'SALE',
      propertyType: 'HOUSE',
      areaM2: 90,
      totalPriceVnd: 3500000000,
      contactName: 'Người đăng thử nghiệm',
      publicContactConsent: true
    }
  }
};

function validate(mutator) {
  const data = structuredClone(base);
  mutator?.(data);
  return createContributionSchema.safeParse(data);
}

test('sale submission accepts structured price, category and map location', () => {
  const result = validate();
  assert.equal(result.success, true);
  assert.equal(result.data.place.realEstate.totalPriceVnd, 3500000000);
});

test('rental submission requires a monthly rental amount', () => {
  const invalid = validate((data) => {
    data.place.realEstate.transactionType = 'RENT';
    delete data.place.realEstate.totalPriceVnd;
  });
  assert.equal(invalid.success, false);

  const valid = validate((data) => {
    data.place.realEstate.transactionType = 'RENT';
    delete data.place.realEstate.totalPriceVnd;
    data.place.realEstate.monthlyRentVnd = 2500000;
  });
  assert.equal(valid.success, true);
});

test('property submission cannot omit price, address or contact phone', () => {
  assert.equal(validate((data) => { delete data.place.realEstate.totalPriceVnd; }).success, false);
  assert.equal(validate((data) => { delete data.place.address; }).success, false);
  assert.equal(validate((data) => { delete data.place.phone; }).success, false);
});

test('property contact requires explicit public display consent', () => {
  assert.equal(validate((data) => { delete data.place.realEstate.publicContactConsent; }).success, false);
  assert.equal(validate((data) => { data.place.realEstate.publicContactConsent = false; }).success, false);
  assert.equal(validate((data) => { data.place.realEstate.publicContactConsent = true; }).success, true);
});

test('generic property submissions cannot bypass required real estate details', () => {
  assert.equal(validate((data) => { delete data.place.realEstate; }).success, false);
});

test('property details require the real estate category and create-place workflow', () => {
  assert.equal(validate((data) => { data.place.categorySlug = 'cafe'; }).success, false);
  assert.equal(validate((data) => {
    data.type = 'UPDATE_PLACE';
    data.placeId = 42;
  }).success, false);
});

test('rejects out-of-area pins and unrealistic monetary values', () => {
  assert.equal(validate((data) => { data.location.lat = 10; }).success, false);
  assert.equal(validate((data) => { data.place.realEstate.totalPriceVnd = -1; }).success, false);
  assert.equal(validate((data) => { data.place.realEstate.areaM2 = 0; }).success, false);
  assert.equal(validate((data) => { data.place.realEstate.areaM2 = 100000; }).success, false);
  assert.equal(validate((data) => { delete data.place.realEstate.contactName; }).success, false);
});

test('advertiser role is self-reported and rental fees preserve explicit zero', () => {
  const valid = validate((data) => {
    const e = data.place.realEstate;
    e.transactionType = 'RENT'; delete e.totalPriceVnd;
    Object.assign(e, { monthlyRentVnd:2900000, advertiserRole:'BROKER', depositAmount:0, electricityPricePerKwh:3500, availableRooms:0 });
  });
  assert.equal(valid.success,true);
  assert.equal(valid.data.place.realEstate.depositAmount,0);
  assert.equal(valid.data.place.realEstate.advertiserRole,'BROKER');
  assert.equal(validate((d)=>{d.place.realEstate.advertiserRole='VERIFIED_OWNER';}).success,false);
  assert.equal(validate((d)=>{d.place.realEstate.depositAmount=0;}).success,false);
});
