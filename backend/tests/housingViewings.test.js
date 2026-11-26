import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool} from '../src/database/pool.js';
import {createApp} from '../src/app.js';
import {createHousingViewing,listHousingViewings,manageHousingViewing,validateViewingTime} from '../src/services/housingViewings.service.js';
import {managePropertyListing} from '../src/services/housingLifecycle.service.js';
import {createHousingViewingSchema} from '../src/validators/housing.validators.js';

test('viewing time must be a canonical future half-hour UTC timestamp; no PII fields accepted',()=>{
  const now=Date.parse('2026-11-27T00:00:00.000Z');
  assert.equal(validateViewingTime('2026-11-27T01:00:00.000Z',now),'2026-11-27T01:00:00.000Z');
  for(const v of ['2026-11-27T00:00:00.000Z','2026-11-27T01:15:00.000Z','2026-12-28T01:00:00.000Z','2026-11-31T01:00:00.000Z'])
    assert.throws(()=>validateViewingTime(v,now),e=>e.statusCode===400);
  assert.equal(createHousingViewingSchema.safeParse({startsAt:'2026-11-27T01:00:00.000Z',phone:'12345'}).success,false);
});

test('viewing routes require auth',async()=>{
  const server=createApp().listen(0);
  try{
    await new Promise(resolve=>server.once('listening',resolve));
    const url='http://127.0.0.1:'+server.address().port+'/api/housing/';
    for(const [path,method] of [['viewings','GET'],['1/viewings','POST'],['viewings/1','PATCH']]){
      const response=await fetch(url+path,{method});
      assert.equal(response.status,401);
    }
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('PG integration: ownership, duplicate prevention, transitions, privacy, closing cancels future bookings',async(t)=>{
  if(process.env.NODE_ENV!=='test'||!process.env.DATABASE_URL){t.skip('requires isolated DB');return;}
  const token=randomUUID(),users=[];let place;
  try{
    for(const role of ['owner','buyer','stranger']){
      const {rows:[u]}=await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,'test-only','USER') RETURNING id",[role,role+'-'+token+'@example.invalid']);
      users.push(u.id);
    }
    const [owner,buyer,stranger]=users;
    const {rows:[p]}=await pool.query(`INSERT INTO places(name,slug,category_id,location,status,source,created_by)
      VALUES('Viewing QA',$1,(SELECT id FROM categories WHERE slug='bat-dong-san'),ST_SetSRID(ST_MakePoint(105.52522,21.01354),4326),'PUBLISHED','USER',$2) RETURNING id`,['viewing-'+token,owner]);
    place=p.id;
    await pool.query("INSERT INTO housing_listings(place_id,listing_type,property_type,monthly_rent,availability_status,listing_status,expires_at) VALUES($1,'RENT','HOUSE',2000000,'AVAILABLE','ACTIVE',NOW()+INTERVAL '30 days')",[place]);
    const slot=new Date(Math.ceil((Date.now()+7200000)/1800000)*1800000).toISOString();
    const request=await createHousingViewing(place,buyer,slot);
    assert.equal(request.status,'PENDING');
    assert.equal(request.direction,'OUTGOING');
    assert.equal('recipientId' in request,false);
    assert.equal('requesterId' in request,false);
    await assert.rejects(createHousingViewing(place,owner,slot),e=>e.statusCode===409);
    await assert.rejects(createHousingViewing(place,buyer,slot),e=>e.statusCode===409);
    assert.equal((await listHousingViewings(stranger)).length,0);
    await assert.rejects(manageHousingViewing(request.id,stranger,'ACCEPT'),e=>e.statusCode===404);
    await assert.rejects(manageHousingViewing(request.id,buyer,'ACCEPT'),e=>e.statusCode===409);
    const accepted=await manageHousingViewing(request.id,owner,'ACCEPT');
    assert.equal(accepted.status,'ACCEPTED');
    await managePropertyListing(place,{id:owner,role:'USER'},'CONFIRM_ACTIVE',{availableRooms:0});
    assert.equal((await listHousingViewings(buyer))[0].status,'CANCELLED');
    await assert.rejects(createHousingViewing(place,stranger,slot),e=>e.statusCode===404);
  }finally{
    if(place)await pool.query('DELETE FROM places WHERE id=$1',[place]);
    for(const u of users)await pool.query('DELETE FROM users WHERE id=$1',[u]);
  }
});
