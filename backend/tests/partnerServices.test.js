import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCatalog,serviceId} from '../src/services/partnerServices.service.js';
import {catalogServiceSchema,serviceAppointmentSchema,serviceAppointmentActionSchema} from '../src/validators/partnerServices.validators.js';
test('catalog schema rejects negative price, extra owner and contact fields',()=>{
 assert.equal(catalogServiceSchema.safeParse({title:'Dịch vụ',priceVnd:null}).success,true);
 assert.equal(catalogServiceSchema.safeParse({title:'Dịch vụ',priceVnd:-1}).success,false);
 assert.equal(catalogServiceSchema.safeParse({title:'Dịch vụ',priceVnd:10,ownerId:2}).success,false);
 assert.equal(serviceAppointmentSchema.safeParse({startsAt:new Date().toISOString(),phone:'123'}).success,false);
 assert.equal(serviceAppointmentActionSchema.safeParse({action:'PAID'}).success,false);
 assert.throws(()=>serviceId('1 OR 1=1'));
});
test('public catalog requires published active non-housing partner and never maps PII',async()=>{
 const result=await publicCatalog('12',{query:async(sql,args)=>{
 assert.match(sql,/pp.status='ACTIVE'/);assert.match(sql,/p.status='PUBLISHED'/);assert.match(sql,/s.active=true/);assert.match(sql,/bat-dong-san/);assert.deepEqual(args,['12']);
 return {rows:[{id:1,place_id:12,title:'Test',description:'',price_vnd:null,active:true,contact_phone:'private'}]};
 }});
 assert.equal(result.items[0].priceVnd,null);assert.equal('contact_phone' in result.items[0],false);
});
