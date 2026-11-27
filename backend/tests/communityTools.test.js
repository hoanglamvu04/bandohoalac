import test from 'node:test';
import assert from 'node:assert/strict';
import {roomProposalSchema,roomTypesSchema,qaPostSchema,qaReportSchema,qaReviewSchema} from '../src/validators/communityTools.validators.js';
import {projectRoomTypes} from '../src/services/communityTools.service.js';
const type=(label,price,available=1)=>({label,monthlyRentVnd:price,depositVnd:null,areaM2:20,totalRooms:2,availableRooms:available});
test('catalog projects the cheapest available type, not an unavailable teaser price',()=>{
 const x=projectRoomTypes([type('A1',1000000,0),type('B1',2000000,1)]);
 assert.equal(x.representative.label,'B1');assert.equal(x.totalRooms,4);assert.equal(x.availableRooms,1);assert.equal(x.availabilityStatus,'AVAILABLE');
 const full=projectRoomTypes([type('A1',1000000,0),type('B1',2000000,0)]);
 assert.equal(full.representative.label,'A1');assert.equal(full.availabilityStatus,'FULL');
});
test('catalog rejects duplicate names, overbooking, unbounded size and invalid price',()=>{
 for(const types of [[type('A1',1000000),type('a1',2000000)],[type('A1',1000000,3)],[type('A1',0)],Array.from({length:21},(_,i)=>type('Room '+i,1000000))])assert.equal(roomTypesSchema.safeParse(types).success,false);
 assert.equal(roomProposalSchema.safeParse({baseVersion:0,types:[type('A1',1000000)],status:'APPROVED'}).success,false);
});
test('QA submissions cannot self-publish, choose invalid parents or pass unknown review commands',()=>{
 assert.equal(qaPostSchema.safeParse({body:'Cửa hàng mở cửa lúc nào?'}).success,true);
 assert.equal(qaPostSchema.safeParse({body:'Cửa hàng mở cửa lúc nào?',status:'PUBLISHED'}).success,false);
 assert.equal(qaPostSchema.safeParse({body:'Cửa hàng mở cửa lúc nào?',parentId:'0'}).success,false);
 assert.equal(qaReportSchema.safeParse({reason:'PRIVATE_INFO'}).success,true);
 assert.equal(qaReviewSchema.safeParse({action:'PUBLISH_ALL'}).success,false);
});

import {listHousingListings} from '../src/services/housing.service.js';
test('room criteria match one type; availability applies to the matching type',async()=>{
 const db={query:async(sql,args)=>{assert.match(sql,/EXISTS \(SELECT 1 FROM jsonb_array_elements\(hl.room_types\) rt WHERE/);assert.ok(sql.includes("(rt->>'monthlyRentVnd')::numeric <= $1"));assert.ok(sql.includes("(rt->>'areaM2')::numeric >= $2"));assert.ok(sql.includes("(rt->>'availableRooms')::int>0"));assert.deepEqual(args.slice(0,2),[3000000,25]);return {rows:[]};}};
 await listHousingListings({maxRent:'3000000',minArea:'25',availableOnly:'true'},db);
});
