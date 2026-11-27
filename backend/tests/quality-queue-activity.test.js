import test from 'node:test';
import assert from 'node:assert/strict';
import { filterQualityQueue, qualityQueueCsv } from '../../frontend/src/lib/qualityQueue.js';
import { localActivityItems, validActivityBounds } from '../../frontend/src/lib/localActivity.js';
test('quality queue filters combined criteria and exports neutralized formula values',()=>{
 const rows=[{id:1,name:'Hòa Lạc',categorySlug:'cafe',triagePriority:'HIGH',issues:['MISSING_CONTACT']},{id:2,name:'=1+1',categorySlug:'food',triagePriority:'LOW',issues:['MISSING_IMAGES']}];
 assert.deepEqual(filterQualityQueue(rows,{query:'hoa lac',priority:'HIGH',issue:'MISSING_CONTACT'}).map(x=>x.id),[1]);
 assert.equal(filterQualityQueue(rows,{category:'food',priority:'HIGH'}).length,0);
 assert.match(qualityQueueCsv(rows),/"'=1\+1"/);
});
test('area feed rejects invalid bounds, old and inactive entries',()=>{
 assert.equal(validActivityBounds({west:0,east:10,south:0,north:2}),null);
 assert.deepEqual(validActivityBounds({west:105.4,east:105.6,south:20.9,north:21}),{west:105.4,east:105.6,south:20.9,north:21});
 const now=Date.parse('2026-11-27T12:00:00Z');
 const feature=(id,properties)=>({id,properties});
 const data={features:[feature(1,{layerType:'EVENT',validFrom:'2026-11-28T00:00:00Z'}),feature(2,{layerType:'FLOOD',validUntil:'2026-11-26T00:00:00Z'}),feature(3,{layerType:'ALERT',status:'DRAFT'}),feature(4,{layerType:'ALERT'}),feature(4,{layerType:'ALERT'})]};
 assert.deepEqual(localActivityItems(data,'ALL',now).map(x=>x.id),[1,4]);
 assert.deepEqual(localActivityItems(data,'ALERT',now).map(x=>x.id),[4]);
});
