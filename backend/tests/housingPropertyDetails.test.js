import test from 'node:test';
import assert from 'node:assert/strict';
import {propertyDetailsSchema} from '../src/validators/propertyDetails.validators.js';
import {realEstateSubmissionSchema} from '../src/validators/contribution.validators.js';
import {getSimilarHousing,getHousingHistory} from '../src/services/housingDiscovery.service.js';
import {listHousingListings} from '../src/services/housing.service.js';
import {housingListQuerySchema,savedHousingFiltersSchema} from '../src/validators/housing.validators.js';

const base={transactionType:'RENT',propertyType:'HOUSE',areaM2:30,monthlyRentVnd:2500000,contactName:'QA test',publicContactConsent:true};
test('structured claims and subtype validation do not imply verification',()=>{
 assert.equal(realEstateSubmissionSchema.safeParse({...base,details:{subtype:'ROOM',floors:2,bedrooms:0,legalClaim:'CERTIFICATE_REPORTED'},hasParking:false}).success,true);
 assert.equal(realEstateSubmissionSchema.safeParse({...base,details:{subtype:'OFFICE'}}).success,false);
 assert.equal(realEstateSubmissionSchema.safeParse({...base,details:{verified:true}}).success,false);
 assert.equal(realEstateSubmissionSchema.safeParse({...base,propertyType:'LAND',details:{bedrooms:2}}).success,false);
 assert.equal(propertyDetailsSchema.safeParse({accessWidthM:-1}).success,false);
});
test('related and history SQL only expose public active non-demo listing data',async()=>{
 const db={query:async(sql,params)=>{assert.deepEqual(params,['42']);assert.match(sql,/p.status='PUBLISHED'/);assert.match(sql,/p.external_source IS NULL/);assert.match(sql,/h.listing_status='ACTIVE'/);return {rows:[]};}};
 assert.deepEqual((await getSimilarHousing('42',db)).items,[]);
 assert.deepEqual((await getHousingHistory('42',db)).items,[]);
 await assert.rejects(getSimilarHousing('42;DROP',db),e=>e.statusCode===400);
});
test('subtype and furnishing filters are allowlisted and parameterized',async()=>{
 assert.equal(housingListQuerySchema.safeParse({subtype:'ROOM',furnishing:'FULL'}).success,true);
 assert.equal(savedHousingFiltersSchema.safeParse({subtype:'ROOM',furnishing:'FULL'}).success,true);
 assert.equal(housingListQuerySchema.safeParse({subtype:'UNKNOWN'}).success,false);
 await listHousingListings({subtype:'ROOM',furnishing:'FULL'}, {query:async(sql,params)=>{
 assert.match(sql,/property_details->>'subtype' = \$1/);assert.match(sql,/property_details->>'furnishing' = \$2/);
 assert.deepEqual(params.slice(0,2),['ROOM','FULL']);return {rows:[]};}});
});
