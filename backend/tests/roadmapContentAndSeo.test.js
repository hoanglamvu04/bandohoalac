import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHousingDraft} from '../../frontend/src/lib/housingDraftAssistant.js';
import {csvCell,seoAuditCsv,filterSeoPages,isIndexEligible} from '../../frontend/src/lib/localSeoAudit.js';
import {classifyPriceRatio,getHousingPriceReference} from '../src/services/housingDiscovery.service.js';
test('local listing draft uses entered facts only, preserves free utility and excludes contact',()=>{
 const draft=buildHousingDraft({transactionType:'RENT',propertyType:'HOUSE',areaM2:'25',priceVnd:'2000000',electricityPricePerKwh:'0',phone:'PRIVATE123',contactName:'PRIVATE123',address:'PRIVATE123',details:{legalClaim:'CERTIFICATE_REPORTED'},amenities:{hasParking:'true'}});
 assert.match(draft.text,/2\.000\.000/);assert.match(draft.text,/Điện: 0/);assert.match(draft.text,/Chỗ gửi xe/);assert.doesNotMatch(draft.text,/PRIVATE123|đã xác minh|có giấy chứng nhận/i);
 assert.ok(draft.missing.includes('Tiền cọc'));
});
test('SEO audit is conservative and CSV formula-safe',()=>{
 const item={slug:'test',title:'Nhà ở',status:'PUBLISHED',quality:{ready:true,placeCount:5},minPlaceCount:5,mapSupported:true,editorialReviewedAt:'2026-01-01',canPublish:true};
 assert.equal(isIndexEligible(item),true);assert.equal(isIndexEligible({...item,editorialReviewedAt:null}),false);
 assert.equal(filterSeoPages([item],{query:'nha o',gate:'INDEX_ELIGIBLE'}).length,1);
 assert.equal(csvCell(' =1+1'),"\"' =1+1\"");assert.equal(csvCell('A"B'),'"A""B"');
 assert.match(seoAuditCsv([{...item,title:'=HYPERLINK("x")'}]),/'=HYPERLINK/);
});
test('asking-price reference requires adequate sample; flags are not valuation',async()=>{
 assert.equal(classifyPriceRatio(50,100,7).status,'INSUFFICIENT_SAMPLE');
 assert.equal(classifyPriceRatio(49,100,8).status,'REVIEW_LOW');
 assert.equal(classifyPriceRatio(201,100,8).status,'REVIEW_HIGH');
 assert.equal(classifyPriceRatio(100,100,8).status,'WITHIN_REFERENCE_BAND');
 assert.equal(classifyPriceRatio(100,0,10).status,'INSUFFICIENT_SAMPLE');
 const x=await getHousingPriceReference('1',{query:async(sql,args)=>{assert.match(sql,/external_source IS NULL/);assert.match(sql,/demo-thach-that-/);assert.match(sql,/ST_DWithin/);assert.match(sql,/LIMIT 100/);assert.deepEqual(args,['1']);return {rows:[{amount:250,median:100,sample_count:10,listing_type:'SALE'}]};}});
 assert.equal(x.status,'REVIEW_HIGH');assert.equal(x.unit,'VND_PER_M2');
});
