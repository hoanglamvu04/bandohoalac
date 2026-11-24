import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHousingAskingPriceInsights, getHousingNearbyAmenities,
  classifyQuotedUnitPrice, MIN_VISIBLE_MARKET_SAMPLE,
  MAX_AMENITY_CANDIDATES
} from '../src/services/housingInsights.service.js';
import { marketInsightsQuerySchema, housingAmenitiesQuerySchema } from '../src/validators/housing.validators.js';

test('market query validates full, bounded map viewport and disallows private fields', () => {
  assert.equal(marketInsightsQuerySchema.parse({}).listingType, 'SALE');
  assert.equal(marketInsightsQuerySchema.safeParse({
    listingType:'RENT', propertyType:'APARTMENT',
    west:'105.5', east:'105.6', south:'21.0', north:'21.1'
  }).success, true);
  for (const bad of [
    { north:'21.1' }, { west:'105.5', east:'105.6', south:'21.0' },
    { west:'105.7', east:'105.6', south:'21.0', north:'21.1' },
    { west:'105', east:'106', south:'21.0', north:'21.1' },
    { lat:'21.01' }, { lng:'105.52' }, { phone:'0988888888' },
    { token:'secret' }, { listingType:'SOLD' },
    { propertyType:'PRIVATE' }
  ]) assert.equal(marketInsightsQuerySchema.safeParse(bad).success, false, JSON.stringify(bad));
  assert.equal(housingAmenitiesQuerySchema.parse({}).radius, '1000');
  for (const bad of [{ radius:'300' }, { radius:'5000' }, { lat:'21.01' }])
    assert.equal(housingAmenitiesQuerySchema.safeParse(bad).success, false);
});

test('price distribution only counts active published property asking prices; suppresses small samples', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      assert.match(sql, /p.status = 'PUBLISHED'/);
      assert.match(sql, /hl.listing_status = 'ACTIVE'/);
      assert.match(sql, /hl.expires_at/);
      assert.match(sql, /PERCENTILE_CONT/);
      assert.match(sql, /ST_Intersects/);
      assert.doesNotMatch(sql, /SELECT .*phone|SELECT .*email/);
      return { rows:[{ sample_count:4, p25:'9000000', p50:'11000000', p75:'15000000' }] };
    }
  };
  const filters = marketInsightsQuerySchema.parse({
    listingType:'SALE', propertyType:'LAND',
    west:'105.5', east:'105.6', south:'21', north:'21.1'
  });
  const hidden = await getHousingAskingPriceInsights(filters, client);
  assert.equal(hidden.sampleCount, 4);
  assert.equal(hidden.sufficientSample, false);
  assert.equal(hidden.quartiles, null);
  assert.equal(hidden.unit, 'VND_PER_M2');
  assert.equal(hidden.areaBasis, 'MAP_VIEWPORT');
  assert.deepEqual(queries[0].params, ['SALE','LAND',105.5,21,105.6,21.1]);
  assert.equal(JSON.stringify(hidden).includes('phone'), false);
  assert.equal(JSON.stringify(hidden).includes('email'), false);
  assert.equal(MIN_VISIBLE_MARKET_SAMPLE,5);

  const enough = await getHousingAskingPriceInsights({ listingType:'RENT' }, {
    async query(sql, params) {
      assert.doesNotMatch(sql, /ST_Intersects/);
      assert.deepEqual(params,['RENT',null]);
      return { rows:[{ sample_count:6, p25:'70000', p50:'95000', p75:'120000' }] };
    }
  });
  assert.deepEqual(enough.quartiles, { p25:70000,median:95000,p75:120000 });
  assert.equal(enough.unit,'VND_PER_M2_PER_MONTH');
  assert.equal(classifyQuotedUnitPrice(250000,enough),'ABOVE_REFERENCE');
  assert.equal(classifyQuotedUnitPrice(20000,enough),'BELOW_REFERENCE');
  assert.equal(classifyQuotedUnitPrice(100000,enough),'WITHIN_REFERENCE');
  assert.equal(classifyQuotedUnitPrice(250000,hidden),'INSUFFICIENT');
});

test('public amenities are bounded, published-only and anchored to a public housing listing', async () => {
  const queries = [];
  const client = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (queries.length === 1) return { rows:[{ id:5 }] };
      assert.match(sql,/p.status = 'PUBLISHED'/);
      assert.match(sql,/anchor.status = 'PUBLISHED'/);
      assert.match(sql,/ST_DWithin/);
      assert.match(sql,/hl.listing_status = 'ACTIVE'/);
      assert.equal(params[2].includes('bat-dong-san'), false);
      return { rows:[
        { id:11, name:'Trường học', category_slug:'truong-hoc',category_name:'Giáo dục',distance_m:350 },
        { id:12, name:'Trạm y tế', category_slug:'y-te', category_name:'Y tế', distance_m:490 }
      ] };
    }
  };
  const result = await getHousingNearbyAmenities('5','500',client);
  assert.equal(result.radiusM,500);
  assert.equal(result.matchedCount,2);
  assert.equal(result.places[0].distanceM,350);
  assert.equal(result.categories.length,2);
  assert.equal(result.method,'STRAIGHT_LINE_DISTANCE');
  assert.equal(MAX_AMENITY_CANDIDATES,100);
  assert.equal(JSON.stringify(result).includes('location'),false);
  assert.equal(JSON.stringify(result).includes('phone'),false);
  assert.equal(JSON.stringify(result).includes('userId'),false);
  for(const invalid of ['0','-1','text','9999999999999999999999']) {
    await assert.rejects(()=>getHousingNearbyAmenities(invalid,'1000',client),
      (err)=>err.statusCode===400);
  }
  await assert.rejects(()=>getHousingNearbyAmenities('5','200',client),
    (err)=>err.statusCode===400);
  assert.equal(queries.length,2);
  await assert.rejects(()=>getHousingNearbyAmenities('7','1000',{
    async query() { return { rows:[] }; }
  }), (err)=>err.statusCode===404);
});
