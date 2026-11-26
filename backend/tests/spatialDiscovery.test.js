import test from 'node:test';
import assert from 'node:assert/strict';
import {areaSearchSchema,corridorSearchSchema,areaSummarySchema} from '../src/validators/spatialDiscovery.validators.js';
import {searchHousingArea,searchRouteCorridor,getAreaSummary,polygonForPoints} from '../src/services/spatialDiscovery.service.js';
const points=[[105.51,21.01],[105.52,21.01],[105.52,21.02]];
test('area input bounded and polygon closed; duplicate vertices rejected',()=>{
 assert.equal(areaSearchSchema.safeParse({points}).success,true);
 assert.equal(areaSearchSchema.safeParse({points:[[0,0],...points]}).success,false);
 assert.deepEqual(JSON.parse(polygonForPoints(points)).coordinates[0].at(-1),points[0]);
 assert.throws(()=>polygonForPoints([points[0],points[0],points[1]]));
 assert.equal(areaSearchSchema.safeParse({points,extra:true}).success,false);
});
test('area search applies spatial predicate before pagination',async()=>{
 const calls=[];const db={query:async(sql,args)=>{calls.push({sql,args});return {rows:calls.length===1?[{valid:true,area:120000}]:[]};}};
 const result=await searchHousingArea({points,filters:{listingType:'RENT'}},db);
 assert.equal(result.items.length,0);assert.match(calls[1].sql,/ST_Covers/);assert.match(calls[1].sql,/ST_Intersects/);assert.match(calls[1].sql,/LIMIT/);
 assert.equal(calls[1].args[2],'RENT');
 await assert.rejects(searchHousingArea({points},{query:async()=>({rows:[{valid:false,area:0}]})}),/Vùng phải/);
});
test('route corridor uses public POI and parameterized geography',async()=>{
 const coordinates=points.slice(0,2);assert.equal(corridorSearchSchema.safeParse({coordinates,distanceMeters:5000}).success,false);
 let n=0;const db={query:async(sql,args)=>{n++;if(n===1)return {rows:[{length:1000}]};assert.match(sql,/PUBLISHED/);assert.match(sql,/ST_DWithin/);assert.equal(args[1],500);return {rows:[{id:1,name:'Test',distance_m:25}]};}};
 assert.equal((await searchRouteCorridor({coordinates,distanceMeters:500},db)).items[0].distanceMeters,25);
});
test('viewport counts are bounded and do not include real estate or contact fields',async()=>{
 const bounds={west:105.51,south:21.01,east:105.52,north:21.02};
 assert.equal(areaSummarySchema.safeParse({...bounds,east:105.70}).success,false);
 const data=await getAreaSummary(bounds,{query:async(sql)=>{assert.match(sql,/p.status='PUBLISHED'/);assert.match(sql,/bat-dong-san/);return {rows:[{slug:'cafe',name:'Cafe',count:3}]};}});
 assert.equal(data.items[0].count,3);
});
