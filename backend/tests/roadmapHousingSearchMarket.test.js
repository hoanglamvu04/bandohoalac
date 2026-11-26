import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHousingIntent} from '../../frontend/src/lib/housingIntent.js';
import {rentalInvestment} from '../../frontend/src/lib/rentalInvestment.js';
import {validateSavedView} from '../../frontend/src/lib/mapSavedViews.js';
import {getMarketGrid,getMarketTrend,recordMarketMonthlySnapshot} from '../src/services/housingMarketGrid.service.js';
test('Vietnamese housing intent parses explicit budget and FPT radius without inventing a transaction',()=>{
 const x=parseHousingIntent('Phòng trọ dưới 2,9 triệu gần FPT khép kín');
 assert.deepEqual(x.filters,{listingType:'RENT',maxRent:'2900000',maxDistanceFpt:'3000',privateBathroom:'true'});
 assert.equal(x.q,'');
 assert.equal(parseHousingIntent('mua đất dưới 3 tỷ Thạch Hòa').filters.maxPrice,'3000000000');
 assert.equal(parseHousingIntent('quán ăn 2 triệu').recognized,false);
 assert.equal(parseHousingIntent('phòng trọ từ 4 triệu dưới 3 triệu').invalid,true);
 assert.equal(parseHousingIntent('phòng trọ không có chỗ để xe').filters.parking,undefined);
});
test('cash flow estimates include vacancy, negative net does not claim payback',()=>{
 const x=rentalInvestment({capital:3000000000,rooms:20,rent:3000000,occupancy:80,monthlyCosts:18000000});
 assert.equal(x.gross,48000000);assert.equal(x.net,30000000);
 assert.ok(Math.abs(x.paybackYears-8.333333333)<1e-6);
 assert.equal(rentalInvestment({capital:1,rooms:1,rent:0,occupancy:100,monthlyCosts:100}).paybackYears,null);
 assert.equal(rentalInvestment({capital:1,rooms:1,rent:1,occupancy:101,monthlyCosts:0}),null);
});
test('saved map views accept only bounded camera and explicit safe fields',()=>{
 const v=validateSavedView({id:'x',name:'Khu A',lng:105.5,lat:21.0,zoom:14,layers:['ROAD','BAD<>'],phone:'hidden'});
 assert.deepEqual(v.layers,['ROAD']);assert.equal('phone' in v,false);
 assert.equal(validateSavedView({...v,lng:0}),null);
});
test('market grid and snapshot exclude demo and suppress small samples',async()=>{
 const filters={listingType:'RENT',west:105.3,south:20.9,east:105.6,north:21.1};
 const db={query:async(sql,params)=>{assert.match(sql,/external_source IS NULL/);assert.match(sql,/HAVING COUNT\(\*\)>=\$8/);assert.equal(params[7],5);return {rows:[]};}};
 assert.deepEqual((await getMarketGrid(filters,db)).cells,[]);
 await assert.rejects(getMarketGrid({...filters,east:109},db),e=>e.statusCode===400);
 const trend=await getMarketTrend({listingType:'RENT'},{query:async()=>({rows:[{month:'2026-11',sample_count:2,median_vnd_m2:100000}]})});
 assert.equal(trend.items[0].medianVndM2,null);
 const snapshot=await recordMarketMonthlySnapshot({query:async(sql,params)=>{assert.match(sql,/GROUPING SETS/);assert.match(sql,/ON CONFLICT/);assert.deepEqual(params,[5]);return {rowCount:14};}});
 assert.equal(snapshot.groups,14);
});
